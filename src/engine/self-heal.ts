/**
 * src/engine/self-heal.ts
 *
 * Closed-Loop Self-Healing Engine.
 * Implements the Sense -> Decide -> Act -> Verify -> Self-Heal loop.
 * Intercepts errors during task execution, diagnoses root causes, selects alternative
 * strategies (e.g. from Shell -> Native Win32 -> Browser CDP -> Hermes Agent),
 * and retries automatically without dumping errors on the operator.
 */

export interface HealingTaskOptions {
  goal: string;
  maxRetries?: number;
  executeAttempt: (attempt: number, lastError?: string, diagnosis?: string) => Promise<string>;
}

export interface HealingResult {
  success: boolean;
  attempts: number;
  output: string;
  diagnoses: string[];
  error?: string;
}

export class SelfHealingEngine {
  /**
   * Diagnose failure patterns to choose a corrective strategy.
   */
  diagnoseFailure(errorMsg: string): string {
    const lower = errorMsg.toLowerCase();

    if (
      lower.includes("not recognized") ||
      lower.includes("syntax error") ||
      lower.includes("unexpected token")
    ) {
      return "Escaping or syntax issue: switch to direct Win32 ShellExecute or Polyglot runner";
    }
    if (lower.includes("access is denied") || lower.includes("0x80070005")) {
      return "Permission or elevation block: switch to direct user-session launcher or background browser";
    }
    if (lower.includes("timeout") || lower.includes("timed out")) {
      return "Process stall: terminate hanging process tree and re-dispatch with detached runner";
    }
    if (lower.includes("video") || lower.includes("audio") || lower.includes("media")) {
      return "Media playback issue: switch to in-page HTML5 DOM control via Chrome CDP";
    }

    return "General runtime failure: escalate to Hermes Agent for end-to-end multimodal execution";
  }

  /**
   * Executes an action inside an autonomous self-healing closed loop.
   */
  async executeWithHealing(options: HealingTaskOptions): Promise<HealingResult> {
    const maxRetries = options.maxRetries ?? 3;
    let lastError: string | undefined;
    let lastDiagnosis: string | undefined;
    const diagnoses: string[] = [];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const output = await options.executeAttempt(attempt, lastError, lastDiagnosis);
        return {
          success: true,
          attempts: attempt,
          output,
          diagnoses,
        };
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : String(err);
        lastDiagnosis = this.diagnoseFailure(lastError);
        diagnoses.push(`Attempt ${attempt} (${lastDiagnosis})`);
      }
    }

    return {
      success: false,
      attempts: maxRetries,
      output: "",
      diagnoses,
      error: lastError,
    };
  }
}
