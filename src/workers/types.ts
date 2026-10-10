/**
 * src/workers/types.ts
 *
 * Types and interfaces for the Regent worker fleet.
 */

export type WorkerId = "claude-code" | "hermes" | "vscode" | "chatbot" | "browser" | "shell";

export interface ProbeResult {
  available: boolean;
  version?: string;
  authOk?: boolean;
  notes: string[];
}

export type WorkerEvent =
  | { type: "started"; sessionId?: string; pid?: number }
  | { type: "text"; text: string }
  | { type: "tool_call"; name: string; input: unknown }
  | { type: "tool_result"; name: string; isError: boolean }
  | { type: "progress"; note: string; percent?: number }
  | { type: "cost"; usd: number }
  | { type: "stderr"; line: string }
  | { type: "heartbeat" };

export interface WorkerReport {
  summary: string;
  filesChanged: string[];
  verificationResults?: { command: string; exitCode: number; passed: boolean }[];
  notes?: string[];
}

export interface WorkResult {
  status: "completed" | "failed" | "timeout" | "budget_exceeded" | "cancelled" | "crashed";
  sessionId?: string; // for resume on the next attempt
  finalText: string; // worker's own summary — a CLAIM, not evidence
  reported?: WorkerReport; // from regent_report via the bridge, if called
  costUsd: number;
  durationMs: number;
  exitCode: number | null;
  rawLogPath: string; // full transcript in the attempt folder
}

export interface WorkRun {
  readonly events: AsyncIterable<WorkerEvent>;
  readonly result: Promise<WorkResult>;
  steer(message: string): Promise<boolean>;
  cancel(reason: string): Promise<void>;
}

export interface WorkLimits {
  maxUsd: number;
  maxMinutes: number;
  maxTurns?: number;
  stallMinutes?: number;
}

export interface BridgeConfig {
  url: string;
  token: string;
}

export interface WorkRequest {
  jobId: string;
  attempt: number;
  cwd: string;
  attemptDir: string;
  taskPrompt: string;
  systemPrompt?: string;
  limits: WorkLimits;
  bridge: BridgeConfig;
  env?: Record<string, string>;
  resumeSessionId?: string;
  modelOverride?: string;
  contract: {
    id: string;
    title: string;
    kind: string;
    scope?: string[];
    allowedTools?: string[];
  };
}

export interface WorkerAdapter {
  readonly id: WorkerId;
  probe(): Promise<ProbeResult>;
  start(req: WorkRequest): WorkRun;
}
