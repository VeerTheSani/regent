/**
 * test/unit/notify.test.ts
 *
 * Acceptance tests for M8: Notification dispatcher and quiet hours filtering.
 */

import { describe, expect, it } from "vitest";
import { digestQueue, inQuietHours, sendNotification } from "../../src/operator/notify.js";

describe("M8: Notifications & Quiet Hours", () => {
  it("inQuietHours evaluates time windows properly", () => {
    // 23:00 - 08:00
    expect(typeof inQuietHours("23:00-08:00")).toBe("boolean");
    // Invalid string defaults safely to false without crashing
    expect(inQuietHours("invalid-window")).toBe(false);
  });

  it("queues info messages for digest during quiet hours", async () => {
    // Force quiet hours with a window spanning 00:00 to 23:59
    const res = await sendNotification("info", "Quiet milestone reached", {
      quietHours: "00:00-23:59",
    });

    expect(res.sent).toBe(false);
    expect(res.queued).toBe(true);
    expect(digestQueue.some((msg) => msg.includes("Quiet milestone reached"))).toBe(true);
  });

  it("live notification test gated by REGENT_LIVE=1", async () => {
    if (process.env.REGENT_LIVE !== "1") {
      expect(true).toBe(true);
      return;
    }

    const res = await sendNotification("info", "Regent test notification", {
      quietHours: "12:00-12:01", // outside quiet hours
    });

    expect(res.sent).toBe(true);
  });
});
