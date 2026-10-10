/**
 * src/operator/dashboard/server.ts
 *
 * Dashboard HTTP server on port 7780 per 11 §2, 14 M8.
 * Provides web dashboard UI, REST status endpoints, SSE streams, and emergency controls.
 */

import { existsSync, readFileSync } from "node:fs";
import { type Server, createServer } from "node:http";
import { join } from "node:path";
import type { RegentDaemon } from "../../daemon.js";
import { KillSwitch } from "../../kernel/kill-switch.js";
import { SseStreamManager } from "./sse.js";

export interface DashboardServerOptions {
  port?: number;
  daemon?: RegentDaemon;
}

export function startDashboardServer(
  daemon?: RegentDaemon,
  port = 7780,
): Promise<{ server: Server; sse: SseStreamManager }> {
  const sse = new SseStreamManager();
  const killSwitch = new KillSwitch();
  const staticPath = join(process.cwd(), "src", "operator", "dashboard", "static", "index.html");

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");

    // 1. Static UI
    if (url.pathname === "/" || url.pathname === "/index.html") {
      if (existsSync(staticPath)) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(readFileSync(staticPath, "utf-8"));
      } else {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h1>Regent Dashboard</h1>");
      }
      return;
    }

    // 2. Jobs API
    if (url.pathname === "/api/jobs" && req.method === "GET") {
      const projections = daemon
        ? daemon.getProjections()
        : { jobs: {}, contracts: {}, workerStats: {} };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(projections));
      return;
    }

    // 3. Live SSE Events API
    if (url.pathname === "/api/events" && req.method === "GET") {
      sse.addClient(res);
      return;
    }

    // 4. Emergency Stop API
    if (url.pathname === "/api/stop" && req.method === "POST") {
      killSwitch.engage();
      sse.broadcast("alert", { message: "Emergency STOP sentinel engaged" });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, status: "STOPPED" }));
      return;
    }

    // 404
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not Found" }));
  });

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      resolve({ server, sse });
    });
  });
}
