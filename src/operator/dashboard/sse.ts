/**
 * src/operator/dashboard/sse.ts
 *
 * Server-Sent Events (SSE) broadcast stream for live dashboard updates per 11 §2.
 */

import type { ServerResponse } from "node:http";

export class SseStreamManager {
  private clients: Set<ServerResponse> = new Set();

  addClient(res: ServerResponse): void {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    res.write("event: connected\ndata: {}\n\n");
    this.clients.add(res);

    res.on("close", () => {
      this.clients.delete(res);
    });
  }

  broadcast(eventType: string, data: unknown): void {
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(payload);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  clientCount(): number {
    return this.clients.size;
  }
}
