/**
 * src/kernel/ledger.ts
 *
 * Append-only SQLite WAL ledger using Node 24 native node:sqlite.
 * Supports idempotent appends via idem_key and structured event reading.
 */

import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync, type StatementSync } from "node:sqlite";

// Suppress experimental warning for node:sqlite
const originalEmitWarning = process.emitWarning;
process.emitWarning = (warning, ...args: unknown[]) => {
  if (typeof warning === "string" && warning.includes("SQLite is an experimental feature")) {
    return;
  }
  if (
    typeof warning === "object" &&
    warning !== null &&
    "name" in warning &&
    warning.name === "ExperimentalWarning" &&
    "message" in warning &&
    typeof warning.message === "string" &&
    warning.message.includes("SQLite is an experimental feature")
  ) {
    return;
  }
  return Reflect.apply(originalEmitWarning, process, [warning, ...args]);
};

export interface LedgerEventInput {
  type: string;
  ts?: string;
  jobId?: string;
  ctrId?: string;
  attempt?: number;
  actor: string;
  idemKey?: string;
  payload: Record<string, unknown>;
}

export interface LedgerEvent {
  seq: number;
  ts: string;
  type: string;
  jobId?: string;
  ctrId?: string;
  attempt?: number;
  actor: string;
  idemKey?: string;
  payload: Record<string, unknown>;
}

export interface AppendResult {
  seq: number;
  duplicate: boolean;
}

export class Ledger {
  private db: DatabaseSync;
  private insertStmt!: StatementSync;
  private findIdemStmt!: StatementSync;

  constructor(dbPath = ":memory:") {
    if (dbPath !== ":memory:") {
      const dir = dirname(dbPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new DatabaseSync(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA synchronous = NORMAL;");

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        seq        INTEGER PRIMARY KEY AUTOINCREMENT,
        ts         TEXT    NOT NULL,
        type       TEXT    NOT NULL,
        job_id     TEXT,
        ctr_id     TEXT,
        attempt    INTEGER,
        actor      TEXT    NOT NULL,
        idem_key   TEXT    UNIQUE,
        payload    TEXT    NOT NULL
      );
      CREATE INDEX IF NOT EXISTS events_job ON events(job_id, seq);
      CREATE INDEX IF NOT EXISTS events_type ON events(type, seq);

      CREATE TABLE IF NOT EXISTS model_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT,
        job_id TEXT,
        ctr_id TEXT,
        purpose TEXT,
        provider TEXT,
        model TEXT,
        served_by TEXT,
        tier TEXT,
        input_tokens INTEGER,
        output_tokens INTEGER,
        cache_read_tokens INTEGER,
        usd REAL,
        latency_ms INTEGER,
        ok INTEGER,
        error TEXT,
        prompt_hash TEXT
      );

      CREATE TABLE IF NOT EXISTS jobs_view (
        job_id TEXT PRIMARY KEY,
        status TEXT,
        spent_usd REAL,
        started TEXT,
        updated TEXT,
        brief_version INTEGER
      );

      CREATE TABLE IF NOT EXISTS contracts_view (
        ctr_id TEXT PRIMARY KEY,
        job_id TEXT,
        status TEXT,
        attempt INTEGER,
        rung INTEGER,
        best_score REAL,
        spent_usd REAL
      );

      CREATE TABLE IF NOT EXISTS worker_stats (
        worker TEXT,
        kind TEXT,
        project TEXT,
        alpha REAL,
        beta REAL,
        cost_sum REAL,
        cost_n INTEGER,
        minutes_sum REAL,
        claim_mismatches INTEGER,
        PRIMARY KEY (worker, kind, project)
      );
    `);

    this.insertStmt = this.db.prepare(`
      INSERT INTO events (ts, type, job_id, ctr_id, attempt, actor, idem_key, payload)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.findIdemStmt = this.db.prepare(`
      SELECT seq FROM events WHERE idem_key = ?
    `);
  }

  append(ev: LedgerEventInput): AppendResult {
    const ts = ev.ts ?? new Date().toISOString();
    const payloadStr = JSON.stringify(ev.payload);

    if (ev.idemKey) {
      const existing = this.findIdemStmt.get(ev.idemKey) as { seq: number } | undefined;
      if (existing) {
        return { seq: existing.seq, duplicate: true };
      }
    }

    try {
      const res = this.insertStmt.run(
        ts,
        ev.type,
        ev.jobId ?? null,
        ev.ctrId ?? null,
        ev.attempt ?? null,
        ev.actor,
        ev.idemKey ?? null,
        payloadStr,
      );

      return { seq: Number(res.lastInsertRowid), duplicate: false };
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      if (
        ev.idemKey &&
        (errMessage.includes("UNIQUE") || errMessage.includes("SQLITE_CONSTRAINT"))
      ) {
        const existing = this.findIdemStmt.get(ev.idemKey) as { seq: number } | undefined;
        if (existing) {
          return { seq: existing.seq, duplicate: true };
        }
      }
      throw err;
    }
  }

  read(jobId?: string, fromSeq = 0): LedgerEvent[] {
    let query = "SELECT * FROM events WHERE seq >= ?";
    const params: (string | number)[] = [fromSeq];

    if (jobId) {
      query += " AND job_id = ?";
      params.push(jobId);
    }
    query += " ORDER BY seq ASC";

    const rows = this.db.prepare(query).all(...params) as Array<{
      seq: number;
      ts: string;
      type: string;
      job_id: string | null;
      ctr_id: string | null;
      attempt: number | null;
      actor: string;
      idem_key: string | null;
      payload: string;
    }>;

    return rows.map((r) => ({
      seq: Number(r.seq),
      ts: r.ts,
      type: r.type,
      jobId: r.job_id ?? undefined,
      ctrId: r.ctr_id ?? undefined,
      attempt: r.attempt ?? undefined,
      actor: r.actor,
      idemKey: r.idem_key ?? undefined,
      payload: JSON.parse(r.payload),
    }));
  }

  close(): void {
    this.db.close();
  }
}
