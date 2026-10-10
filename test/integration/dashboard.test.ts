/**
 * test/integration/dashboard.test.ts
 *
 * Acceptance tests for M8 Dashboard server:
 * - GET /api/jobs returns JSON
 * - SSE connects and receives a broadcast event
 * - POST /api/stop engages emergency kill switch
 */

import type { Server } from "node:http";
import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { KillSwitch } from "../../src/kernel/kill-switch.js";
import { startDashboardServer } from "../../src/operator/dashboard/server.js";
import type { SseStreamManager } from "../../src/operator/dashboard/sse.js";

const TEST_PORT = 7785;

describe("M8: Dashboard Server & SSE Streams", () => {
  let server: Server;
  let sse: SseStreamManager;
  const killSwitch = new KillSwitch();

  beforeAll(async () => {
    killSwitch.disengage();
    const res = await startDashboardServer(undefined, TEST_PORT);
    server = res.server;
    sse = res.sse;
  });

  afterAll(() => {
    server.close();
    killSwitch.disengage();
  });

  it("GET /api/jobs returns JSON projections", async () => {
    const res = await new Promise<{
      status: number;
      body: { jobs?: Record<string, unknown> };
    }>((resolve) => {
      http.get(`http://127.0.0.1:${TEST_PORT}/api/jobs`, (r) => {
        let d = "";
        r.on("data", (c) => {
          d += c;
        });
        r.on("end", () => resolve({ status: r.statusCode ?? 0, body: JSON.parse(d) }));
      });
    });

    expect(res.status).toBe(200);
    expect(res.body.jobs).toBeDefined();
  });

  it("GET /api/events connects SSE and receives broadcast event", async () => {
    let receivedEvent = "";

    await new Promise<void>((resolve) => {
      const req = http.get(`http://127.0.0.1:${TEST_PORT}/api/events`, (res) => {
        expect(res.statusCode).toBe(200);
        expect(res.headers["content-type"]).toBe("text/event-stream");

        res.on("data", (chunk) => {
          const text = chunk.toString();
          if (text.includes("test_update")) {
            receivedEvent = text;
            req.destroy();
            resolve();
          }
        });

        // Trigger broadcast after connection
        setTimeout(() => {
          sse.broadcast("test_update", { status: "active", jobId: "job-sse" });
        }, 100);
      });
    });

    expect(receivedEvent).toContain("test_update");
    expect(receivedEvent).toContain("job-sse");
  });

  it("POST /api/stop engages emergency kill switch", async () => {
    expect(killSwitch.engaged()).toBe(false);

    const res = await new Promise<{
      status: number;
      body: { ok?: boolean; status?: string };
    }>((resolve) => {
      const req = http.request(
        `http://127.0.0.1:${TEST_PORT}/api/stop`,
        { method: "POST" },
        (r) => {
          let d = "";
          r.on("data", (c) => {
            d += c;
          });
          r.on("end", () => resolve({ status: r.statusCode ?? 0, body: JSON.parse(d) }));
        },
      );
      req.end();
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(killSwitch.engaged()).toBe(true);

    killSwitch.disengage();
  });
});
