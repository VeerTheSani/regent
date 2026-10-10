/**
 * src/kernel/router.ts
 *
 * Model call routing and tracking per 12 §4.
 */

import type { Ledger } from "./ledger.js";

export interface ModelCallRecord {
  jobId?: string;
  ctrId?: string;
  purpose: string; // 'judge' | 'triage' | 'plan' | 'interpret'
  provider: string;
  model: string;
  servedBy?: string;
  tier?: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  usd: number;
  latencyMs: number;
  ok: boolean;
  error?: string;
  promptHash?: string;
}

export class ModelRouter {
  constructor(private readonly ledger: Ledger) {}

  recordCall(call: ModelCallRecord): void {
    const ts = new Date().toISOString();
    // Record budget charge in ledger
    if (call.usd > 0) {
      this.ledger.append({
        type: "budget.charged",
        ts,
        jobId: call.jobId,
        ctrId: call.ctrId,
        actor: `model:${call.provider}/${call.model}`,
        payload: {
          usd: call.usd,
          purpose: call.purpose,
          inputTokens: call.inputTokens,
          outputTokens: call.outputTokens,
        },
      });
    }
  }
}
