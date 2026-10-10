/**
 * src/judge/calibration.ts
 *
 * Golden set calibration tooling per 08 §7.
 */

import type { Verdict } from "../schemas/verdict.js";

export interface GoldenLabel {
  attemptId: string;
  expectedDecision: "APPROVE" | "REVISE";
  expectedScoreRange: [number, number];
}

export interface CalibrationReport {
  total: number;
  agreementRate: number;
  meanDeviation: number;
  flaggedOutliers: string[];
}

export function evaluateCalibration(
  verdicts: Array<{ label: GoldenLabel; actual: Verdict }>,
): CalibrationReport {
  let agreements = 0;
  let totalDev = 0;
  const flaggedOutliers: string[] = [];

  for (const { label, actual } of verdicts) {
    if (label.expectedDecision === actual.decision) {
      agreements++;
    }

    const [minScore, maxScore] = label.expectedScoreRange;
    const midExpected = (minScore + maxScore) / 2;
    const dev = Math.abs(actual.composite - midExpected);
    totalDev += dev;

    if (actual.composite < minScore - 1.0 || actual.composite > maxScore + 1.0) {
      flaggedOutliers.push(
        `${label.attemptId}: actual ${actual.composite} outside expected range [${minScore}, ${maxScore}]`,
      );
    }
  }

  return {
    total: verdicts.length,
    agreementRate: verdicts.length > 0 ? agreements / verdicts.length : 1.0,
    meanDeviation: verdicts.length > 0 ? Math.round((totalDev / verdicts.length) * 100) / 100 : 0,
    flaggedOutliers,
  };
}
