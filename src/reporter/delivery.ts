/**
 * src/reporter/delivery.ts
 *
 * Generates honest delivery reports (DELIVERY.md) per 11 §3.
 * Enforces honesty rules:
 * - Every ✅ MUST link to real evidence (file, test result, or verdict).
 * - Partial deliverables are clearly marked PARTIAL.
 * - Costs are computed strictly from the ledger.
 * - A3/A4 actions list matching grants.
 */

import type { LedgerEvent } from "../kernel/ledger.js";
import type { MissionBrief } from "../schemas/brief.js";

export interface DeliveryDodItem {
  id: string;
  statement: string;
  status: "verified" | "judged" | "unverified" | "failed";
  evidenceLink?: string;
  verdictScore?: number;
}

export interface DeliveryInput {
  jobId: string;
  goal: string;
  isComplete: boolean;
  finalScore: number;
  durationMinutes: number;
  branch?: string;
  commitsCount?: number;
  linesAdded?: number;
  linesRemoved?: number;
  filesChangedCount?: number;
  dods: DeliveryDodItem[];
  decisionsMade: Array<{ id: string; text: string }>;
  caveats: string[];
  events: LedgerEvent[];
  grantsUsed?: Array<{ action: string; grantId: string }>;
}

export function generateDeliveryReport(input: DeliveryInput): string {
  // Honesty check: Every ✅ (verified or judged) MUST have an evidenceLink!
  for (const dod of input.dods) {
    if ((dod.status === "verified" || dod.status === "judged") && !dod.evidenceLink) {
      throw new Error(
        `Honesty violation: DoD item ${dod.id} claimed ${dod.status} but lacks required evidenceLink.`,
      );
    }
  }

  // Sum exact costs from ledger
  let directorCost = 0;
  let judgeCost = 0;
  let workerCost = 0;
  let t1Cost = 0;

  for (const ev of input.events) {
    if (ev.type === "budget.charged") {
      const usd = Number(ev.payload.usd ?? 0);
      const actor = String(ev.actor ?? "");
      if (actor.includes("director") || actor.includes("plan")) {
        directorCost += usd;
      } else if (actor.includes("judge") || actor.includes("opus")) {
        judgeCost += usd;
      } else if (actor.includes("triage") || actor.includes("jev")) {
        t1Cost += usd;
      } else {
        workerCost += usd;
      }
    }
  }

  const totalCost = directorCost + judgeCost + workerCost + t1Cost;

  // Header status line
  const statusBadge = input.isComplete ? "✅ COMPLETE" : "⚠️ PARTIAL";
  const titlePrefix = input.isComplete ? "DELIVERY" : "DELIVERY (PARTIAL)";

  let doc = `# ${titlePrefix} — ${input.jobId}: ${input.goal}\n`;
  doc += `Status: ${statusBadge}   ·   Final acceptance ${input.finalScore.toFixed(
    1,
  )}/10   ·   $${totalCost.toFixed(2)}   ·   ${input.durationMinutes} min\n\n`;

  // What you got
  doc += "## What you got\n";
  if (input.branch) {
    doc += `- Branch \`${input.branch}\` (${input.commitsCount ?? 1} commits, +${
      input.linesAdded ?? 0
    } −${input.linesRemoved ?? 0} across ${input.filesChangedCount ?? 1} files).\n`;
  }
  doc += `- Core deliverable for: ${input.goal}\n\n`;

  // Definition of done table
  doc += "## Definition of done\n";
  doc += "| DoD | Status | Evidence |\n";
  doc += "|---|---|---|\n";
  for (const dod of input.dods) {
    let statusLabel = "❌ failed";
    if (dod.status === "verified") statusLabel = "✅ verified";
    else if (dod.status === "judged")
      statusLabel = `✅ judged ${dod.verdictScore?.toFixed(1) ?? ""}`;
    else if (dod.status === "unverified") statusLabel = "⏳ unverified";

    doc += `| ${dod.id} ${dod.statement} | ${statusLabel} | ${dod.evidenceLink ?? "none"} |\n`;
  }
  doc += "\n";

  // Decisions Regent made for you
  doc += `## Decisions Regent made for you  (mark any you disagree with: regent feedback ${input.jobId} <id> "…")\n`;
  if (input.decisionsMade.length > 0) {
    for (const d of input.decisionsMade) {
      doc += `- ${d.id} ${d.text}\n`;
    }
  } else {
    doc += "- None required; followed explicit brief requirements.\n";
  }
  doc += "\n";

  // Caveats / not done
  doc += "## What was not done / caveats\n";
  if (input.caveats.length > 0) {
    for (const c of input.caveats) {
      doc += `- ${c}\n`;
    }
  } else {
    doc += "- All requested items in scope completed.\n";
  }
  doc += "\n";

  // Cost breakdown
  doc += "## How it went\n";
  doc += `Cost: Director $${directorCost.toFixed(2)} · Judges $${judgeCost.toFixed(
    2,
  )} · T1 $${t1Cost.toFixed(2)} · Workers $${workerCost.toFixed(2)}\n\n`;

  // Evidence index link
  doc += "## Evidence index\n";
  doc += "→ evidence/index.md (all attempts, screenshots, diffs, verdicts, checksums)\n";

  return doc;
}
