/**
 * src/bridge/server.ts
 *
 * Streamable HTTP MCP server for Regent Bridge per 06 §2.
 * Bound to 127.0.0.1 (loopback only) with 256-bit bearer token auth.
 */

import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { type Server, createServer } from "node:http";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import type { Ledger } from "../kernel/ledger.js";
import type { CorrelationIds, PermitArbiter } from "./permits.js";
import type { ProxyUser } from "./proxy-user.js";
import type { BridgeReportsStore } from "./reports.js";
import { AskInput, PermitInput, ReportInput } from "./schemas.js";

export interface BridgeDeps {
  token?: string;
  ledger: Ledger;
  permits: PermitArbiter;
  proxyUser: ProxyUser;
  reports: BridgeReportsStore;
  renderContract?: (ids: CorrelationIds) => Promise<string>;
  onEvidenceRequest?: (
    ids: CorrelationIds,
    kind: string,
    target: string,
  ) => Promise<Record<string, unknown>>;
}

export function getOrCreateBridgeToken(): string {
  const userHome = process.env.USERPROFILE || process.env.HOME || "C:/Users/sanis";
  const tokenDir = join(userHome, ".regent");
  const tokenPath = join(tokenDir, "token");

  if (existsSync(tokenPath)) {
    try {
      const tok = readFileSync(tokenPath, "utf-8").trim();
      if (tok.length >= 32) return tok;
    } catch {}
  }

  if (!existsSync(tokenDir)) {
    mkdirSync(tokenDir, { recursive: true });
  }

  const newToken = randomBytes(32).toString("hex");
  writeFileSync(tokenPath, `${newToken}\n`, { encoding: "utf-8" });
  return newToken;
}

const text = (t: string) => ({
  content: [{ type: "text" as const, text: t }],
});

export function buildMcpServer(deps: BridgeDeps): {
  mcpServer: McpServer;
  transport: StreamableHTTPServerTransport;
  setContextCorrelation: (corr: Partial<CorrelationIds>) => void;
} {
  const mcpServer = new McpServer({ name: "regent", version: "1.0.0" });
  let activeCorrelation: Partial<CorrelationIds> = {};

  const setContextCorrelation = (corr: Partial<CorrelationIds>) => {
    activeCorrelation = { ...activeCorrelation, ...corr };
  };

  const resolveIds = (args: { job?: string; ctr?: string; attempt?: number }): CorrelationIds => {
    return {
      job: args.job ?? activeCorrelation.job ?? "default-job",
      ctr: args.ctr ?? activeCorrelation.ctr ?? "default-ctr",
      attempt: args.attempt ?? activeCorrelation.attempt ?? 1,
    };
  };

  // 1. regent_get_contract
  mcpServer.registerTool(
    "regent_get_contract",
    {
      description:
        "Call this FIRST. Returns your contract, acceptance criteria, critique from the previous attempt, and project rules.",
      inputSchema: {
        job: z.string().optional(),
        ctr: z.string().optional(),
        attempt: z.number().optional(),
      },
    },
    async (args) => {
      const ids = resolveIds(args);
      if (deps.renderContract) {
        return text(await deps.renderContract(ids));
      }
      return text(
        JSON.stringify({
          contract: { id: ids.ctr, job: ids.job, attempt: ids.attempt },
          instructions: "Execute contract requirements cleanly.",
        }),
      );
    },
  );

  // 2. regent_ask
  mcpServer.registerTool(
    "regent_ask",
    {
      description:
        "Ask the operator a question. Use this instead of asking in chat. You get an answer immediately in most cases.",
      inputSchema: AskInput,
    },
    async (args) => {
      const ids = resolveIds(args);
      const answer = await deps.proxyUser.answer(ids, {
        question: args.question,
        options: args.options,
        context: args.context,
        blocking: args.blocking,
      });
      return text(JSON.stringify(answer));
    },
  );

  // 3. regent_permit
  mcpServer.registerTool(
    "regent_permit",
    {
      description: "Permission arbiter for tool calls (used by --permission-prompt-tool).",
      inputSchema: PermitInput,
    },
    async (args) => {
      const ids = resolveIds(args);
      const decision = await deps.permits.decide(ids, {
        tool_name: args.tool_name,
        input: args.input as Record<string, unknown>,
        tool_use_id: args.tool_use_id,
      });
      return text(JSON.stringify(decision));
    },
  );

  // 4. regent_progress
  mcpServer.registerTool(
    "regent_progress",
    {
      description: "Report a progress milestone. Keeps your run alive.",
      inputSchema: {
        note: z.string(),
        percent: z.number().min(0).max(100).optional(),
        job: z.string().optional(),
        ctr: z.string().optional(),
        attempt: z.number().optional(),
      },
    },
    async (args) => {
      const ids = resolveIds(args);
      deps.ledger.append({
        type: "worker.event",
        jobId: ids.job,
        ctrId: ids.ctr,
        attempt: ids.attempt,
        actor: "worker",
        payload: { progress: args.note, percent: args.percent },
      });
      return text("ok");
    },
  );

  // 5. regent_request_evidence
  mcpServer.registerTool(
    "regent_request_evidence",
    {
      description:
        "Ask Regent to capture evidence for you: screenshot a URL, run an acceptance gate, or probe an endpoint.",
      inputSchema: {
        kind: z.enum(["screenshot", "gate", "http"]),
        target: z.string(),
        job: z.string().optional(),
        ctr: z.string().optional(),
        attempt: z.number().optional(),
      },
    },
    async (args) => {
      const ids = resolveIds(args);
      if (deps.onEvidenceRequest) {
        return text(JSON.stringify(await deps.onEvidenceRequest(ids, args.kind, args.target)));
      }
      return text(
        JSON.stringify({
          kind: args.kind,
          target: args.target,
          status: "captured",
        }),
      );
    },
  );

  // 6. regent_report
  mcpServer.registerTool(
    "regent_report",
    {
      description:
        "Call when you are done, blocked, or out of ideas. Be precise; Regent will verify everything you claim.",
      inputSchema: ReportInput,
    },
    async (args) => {
      const ids = resolveIds(args);
      deps.reports.put(ids, {
        summary: args.summary,
        filesChanged: args.filesChanged ?? [],
        verificationResults: args.verificationRun?.map((v) => ({
          command: v.command,
          exitCode: v.exitCode,
          passed: v.exitCode === 0,
        })),
        notes: args.openIssues,
      });
      return text("received — Regent will now verify your work");
    },
  );

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    enableJsonResponse: true,
  });

  mcpServer.connect(transport);

  return { mcpServer, transport, setContextCorrelation };
}

export function startBridge(deps: BridgeDeps, port = 7781): Promise<Server> {
  const token = deps.token ?? getOrCreateBridgeToken();
  const { transport, setContextCorrelation, mcpServer } = buildMcpServer({
    ...deps,
    token,
  });

  const server = createServer(async (req, res) => {
    // 1. Bearer Token Auth
    if (req.headers.authorization !== `Bearer ${token}`) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized: Invalid or missing Bearer token" }));
      return;
    }

    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== "/mcp") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not Found: Endpoint must be /mcp" }));
      return;
    }

    if (url.searchParams.has("job") || url.searchParams.has("ctr")) {
      setContextCorrelation({
        job: url.searchParams.get("job") ?? undefined,
        ctr: url.searchParams.get("ctr") ?? undefined,
        attempt: url.searchParams.has("attempt")
          ? Number(url.searchParams.get("attempt"))
          : undefined,
      });
    }

    await transport.handleRequest(req, res);
  });

  server.on("close", () => {
    try {
      transport.close();
      mcpServer.close();
    } catch {}
  });

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      resolve(server);
    });
  });
}
