/**
 * test/unit/pixels.test.ts
 *
 * Acceptance tests for M4: Deterministic visual frame analysis and pixel diffing.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { diffAgainst, frameStats } from "../../src/evidence/pixels.js";

const TEST_DIR = join(process.cwd(), "test", "fixtures", "pixels");
if (!existsSync(TEST_DIR)) {
  mkdirSync(TEST_DIR, { recursive: true });
}

function createSolidPng(width: number, height: number, r: number, g: number, b: number): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

function createCheckerboardPng(width: number, height: number, blockSize: number): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      const cellX = Math.floor(x / blockSize);
      const cellY = Math.floor(y / blockSize);
      png.data[idx] = (cellX * 45) % 256;
      png.data[idx + 1] = (cellY * 55) % 256;
      png.data[idx + 2] = ((cellX + cellY) * 65) % 256;
      png.data[idx + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

describe("M4: Visual Frame Stats & Pixel Diffing", () => {
  it("frameStats on a solid PNG detects blank: true", () => {
    const solidPath = join(TEST_DIR, "solid-white.png");
    writeFileSync(solidPath, createSolidPng(100, 100, 255, 255, 255));

    const stats = frameStats(solidPath);
    expect(stats.blank).toBe(true);
    expect(stats.std).toBeLessThan(3);
    expect(stats.distinctColours).toBeLessThan(8);
  });

  it("frameStats on a generated checkerboard detects blank: false", () => {
    const checkerPath = join(TEST_DIR, "checkerboard.png");
    writeFileSync(checkerPath, createCheckerboardPng(100, 100, 10));

    const stats = frameStats(checkerPath);
    expect(stats.blank).toBe(false);
    expect(stats.std).toBeGreaterThan(10);
    expect(stats.distinctColours).toBeGreaterThanOrEqual(2);
  });

  it("diffAgainst on identical PNGs returns changedRatio: 0", () => {
    const imgA = join(TEST_DIR, "img-a.png");
    const imgB = join(TEST_DIR, "img-b.png");
    const diffOut = join(TEST_DIR, "diff-identical.png");

    const pngBuffer = createCheckerboardPng(80, 80, 8);
    writeFileSync(imgA, pngBuffer);
    writeFileSync(imgB, pngBuffer);

    const res = diffAgainst(imgA, imgB, diffOut);
    expect(res.comparable).toBe(true);
    if (res.comparable) {
      expect(res.changedRatio).toBe(0);
      expect(existsSync(diffOut)).toBe(true);
    }
  });

  it("diffAgainst detects differences when pixels differ", () => {
    const imgA = join(TEST_DIR, "img-diff-a.png");
    const imgB = join(TEST_DIR, "img-diff-b.png");
    const diffOut = join(TEST_DIR, "diff-modified.png");

    writeFileSync(imgA, createSolidPng(50, 50, 0, 0, 0));
    writeFileSync(imgB, createSolidPng(50, 50, 255, 255, 255));

    const res = diffAgainst(imgA, imgB, diffOut);
    expect(res.comparable).toBe(true);
    if (res.comparable) {
      expect(res.changedRatio).toBe(1.0); // 100% changed
    }
  });
});
