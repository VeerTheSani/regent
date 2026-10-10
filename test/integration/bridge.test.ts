/**
 * test/integration/bridge.test.ts
 *
 * Acceptance tests for M3: Regent Bridge (Streamable HTTP MCP Server).
 */

import type { Server } from "node:http";
import http from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PermitArbiter } from "../../src/bridge/permits.js";
import { ProxyUser } from "../../src/bridge/proxy-user.js";
import { BridgeReportsStore } from "../../src/bridge/reports.js";
import { startBridge } from "../../src/bridge/server.js";
import { Charter, type CharterRule } from "../../src/kernel/charter.js";
import { GrantStore } from "../../src/kernel/grants.js";
import { KillSwitch } from "../../src/kernel/kill-switch.js";
import { Ledger } from "../../src/kernel/ledger.js";

const TEST_PORT = 7781;
const TEST_TOKEN = "test-token-1234567890abcdef1234567890abcdef";

const RULES: CharterRule[] = [
  {
    level: "AX",
    action: "shell.exec",
    when: { commandMatches: ["(?i)rm\\s+-rf\\s+/(\\s|$)"] },
  },
  {
    level: "A4",
    action: "git.push",
    when: { branchMatches: ["main", "master"] },
  },
  {
    level: "A1",
    action: "fs.*",
    when: { insideAttemptDir: true },
  },
  {
    level: "A0",
    action: "fs.read",
  },
];

describe("M3: Regent Bridge (MCP Server)", () => {
  let server: Server;
  let ledger: Ledger;
  let grants: GrantStore;
  let reports: BridgeReportsStore;
  let client: Client;
  let clientTransport: StreamableHTTPClientTransport;

  beforeAll(async () => {
    ledger = new Ledger(":memory:");
    grants = new GrantStore();
    reports = new BridgeReportsStore();
    const killSwitch = new KillSwitch("C:/non-existent-stop");
    const charter = new Charter(RULES, grants, killSwitch);

    const permits = new PermitArbiter(charter, ledger, (ids) => ({
      workspaceRoots: ["C:/projects/app"],
      attemptDir: `C:/projects/app/.regent/${ids.ctr}-${ids.attempt}`,
    }));

    const proxyUser = new ProxyUser(ledger);

    server = await startBridge(
      {
        token: TEST_TOKEN,
        ledger,
        permits,
        proxyUser,
        reports,
      },
      TEST_PORT,
    );

    // Initialize MCP Client
    client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
    clientTransport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${TEST_PORT}/mcp?job=job-m3&ctr=ctr-test&attempt=1`),
      {
        requestInit: {
          headers: {
            Authorization: `Bearer ${TEST_TOKEN}`,
          },
        },
      },
    );
    await client.connect(clientTransport);
  });

  afterAll(async () => {
    try {
      await clientTransport.close();
    } catch {}
    server.close();
    ledger.close();
  });

  it("loopback only: confirms server is bound to 127.0.0.1", () => {
    const addr = server.address();
    expect(addr).toBeDefined();
    if (typeof addr === "object" && addr !== null) {
      expect(addr.address).toBe("127.0.0.1");
      expect(addr.port).toBe(TEST_PORT);
    }
  });

  it("unauthenticated call returns 401 Unauthorized", async () => {
    const resStatus = await new Promise<number>((resolve) => {
      const req = http.request(
        `http://127.0.0.1:${TEST_PORT}/mcp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
        (res) => resolve(res.statusCode ?? 0),
      );
      req.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }));
      req.end();
    });

    expect(resStatus).toBe(401);
  });

  it("lists all 6 registered Regent tools via tools/list", async () => {
    const toolsResult = await client.listTools();
    const toolNames = toolsResult.tools.map((t) => t.name);

    expect(toolNames).toContain("regent_get_contract");
    expect(toolNames).toContain("regent_ask");
    expect(toolNames).toContain("regent_permit");
    expect(toolNames).toContain("regent_progress");
    expect(toolNames).toContain("regent_request_evidence");
    expect(toolNames).toContain("regent_report");
  });

  it("calls regent_get_contract successfully", async () => {
    const res = await client.callTool({
      name: "regent_get_contract",
      arguments: { job: "job-m3", ctr: "ctr-get", attempt: 1 },
    });

    const content = res.content as Array<{ type: string; text: string }>;
    expect(content).toBeDefined();
    expect(content[0].text).toContain("ctr-get");
  });

  it("calls regent_ask and gets Proxy-User fact/decision", async () => {
    const res = await client.callTool({
      name: "regent_ask",
      arguments: {
        question: "Should we use Biome or Prettier?",
        job: "job-m3",
        ctr: "ctr-ask",
        attempt: 1,
      },
    });

    const content = res.content as Array<{ type: string; text: string }>;
    expect(content).toBeDefined();
    const parsed = JSON.parse(content[0].text);
    expect(parsed.kind).toBe("fact");
    expect(parsed.answer).toContain("Biome");
  });

  it("calls regent_progress and appends to ledger", async () => {
    const res = await client.callTool({
      name: "regent_progress",
      arguments: {
        note: "Completed initial file parsing",
        percent: 45,
        job: "job-m3",
        ctr: "ctr-prog",
        attempt: 1,
      },
    });

    const content = res.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toBe("ok");

    const events = ledger.read("job-m3");
    const progEvent = events.find((e) => e.payload.progress === "Completed initial file parsing");
    expect(progEvent).toBeDefined();
    expect(progEvent?.payload.percent).toBe(45);
  });

  it("calls regent_request_evidence and receives response", async () => {
    const res = await client.callTool({
      name: "regent_request_evidence",
      arguments: {
        kind: "http",
        target: "http://127.0.0.1:8080/health",
        job: "job-m3",
        ctr: "ctr-ev",
        attempt: 1,
      },
    });

    const content = res.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain("captured");
  });

  it("calls regent_report and registers report", async () => {
    const res = await client.callTool({
      name: "regent_report",
      arguments: {
        status: "done",
        summary: "Implemented all feature tests",
        filesChanged: ["src/app.ts"],
        verificationRun: [{ command: "npm test", exitCode: 0 }],
        job: "job-m3",
        ctr: "ctr-rep",
        attempt: 1,
      },
    });

    const content = res.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain("received");

    const report = reports.take("job-m3", "ctr-rep", 1);
    expect(report).toBeDefined();
    expect(report?.summary).toBe("Implemented all feature tests");
    expect(report?.filesChanged).toContain("src/app.ts");
  });

  it("regent_permit: rm -rf / => deny (AX)", async () => {
    const res = await client.callTool({
      name: "regent_permit",
      arguments: {
        tool_name: "Bash",
        input: { command: "rm -rf /" },
        job: "job-m3",
        ctr: "ctr-permit",
        attempt: 1,
      },
    });

    const content = res.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.behavior).toBe("deny");
    expect(parsed.message).toContain("forbidden by charter");
  });

  it("regent_permit: Write inside attempt dir => allow (A1)", async () => {
    const res = await client.callTool({
      name: "regent_permit",
      arguments: {
        tool_name: "Write",
        input: {
          path: "C:/projects/app/.regent/ctr-permit-1/temp.txt",
          content: "hello",
        },
        job: "job-m3",
        ctr: "ctr-permit",
        attempt: 1,
      },
    });

    const content = res.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.behavior).toBe("allow");
  });

  it("regent_permit: git push origin main => deny with message not to retry", async () => {
    const res = await client.callTool({
      name: "regent_permit",
      arguments: {
        tool_name: "Bash",
        input: { command: "git push origin main" },
        job: "job-m3",
        ctr: "ctr-permit",
        attempt: 1,
      },
    });

    const content = res.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.behavior).toBe("deny");
    expect(parsed.message).toContain("operator approval");
    expect(parsed.message).toContain("Do not retry");
  });
});
