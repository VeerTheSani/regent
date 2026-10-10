/**
 * src/evidence/pixels.ts
 *
 * Deterministic visual frame analysis and pixel diffing per 07 §3.
 * Pure TypeScript using pngjs and pixelmatch (no native binaries).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

export interface FrameStats {
  mean: number;
  std: number;
  distinctColours: number;
  blank: boolean;
}

export type DiffResult =
  | { comparable: false }
  | { comparable: true; changedRatio: number; diffPng: string };

/**
 * Blank / near-uniform frame detection: luminance standard deviation and distinct-colour count.
 */
export function frameStats(pngPath: string): FrameStats {
  const buffer = readFileSync(pngPath);
  const img = PNG.sync.read(buffer);

  let sum = 0;
  let sumSq = 0;
  const colours = new Set<number>();
  const totalPixels = img.width * img.height;

  for (let i = 0; i < img.data.length; i += 4) {
    const r = img.data[i];
    const g = img.data[i + 1];
    const b = img.data[i + 2];

    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sum += y;
    sumSq += y * y;

    // Downsample color space to check distinct color variety
    if (colours.size < 4096 && (i / 4) % 7 === 0) {
      colours.add(((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3));
    }
  }

  const mean = sum / totalPixels;
  const std = Math.sqrt(Math.max(0, sumSq / totalPixels - mean * mean));
  const blank = std < 3 || colours.size < 8;

  return {
    mean,
    std,
    distinctColours: colours.size,
    blank,
  };
}

/**
 * Pixel diff vs a baseline; writes a diff PNG highlighting changes in red.
 */
export function diffAgainst(baselinePng: string, currentPng: string, outPng: string): DiffResult {
  const a = PNG.sync.read(readFileSync(baselinePng));
  const b = PNG.sync.read(readFileSync(currentPng));

  if (a.width !== b.width || a.height !== b.height) {
    return { comparable: false };
  }

  const diff = new PNG({ width: a.width, height: a.height });
  const changedPixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
    threshold: 0.1,
  });

  const outDir = dirname(outPng);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  writeFileSync(outPng, PNG.sync.write(diff));

  return {
    comparable: true,
    changedRatio: changedPixels / (a.width * a.height),
    diffPng: outPng,
  };
}
