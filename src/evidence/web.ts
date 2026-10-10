/**
 * src/evidence/web.ts
 *
 * Playwright web capture connecting over Chrome CDP (http://127.0.0.1:9222)
 * with fallback to headless launch per 07 §2.
 */

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { type Browser, type Page, chromium } from "playwright";

let sharedBrowser: Browser | undefined;

export async function getSharedBrowser(): Promise<Browser> {
  if (sharedBrowser?.isConnected()) {
    return sharedBrowser;
  }
  try {
    sharedBrowser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  } catch {
    const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
    if (existsSync(chromePath)) {
      sharedBrowser = await chromium.launch({
        executablePath: chromePath,
        headless: true,
      });
    } else {
      sharedBrowser = await chromium.launch({ headless: true });
    }
  }
  return sharedBrowser;
}

export interface VisualTarget {
  name: string;
  url: string;
  viewport?: { width: number; height: number };
  selector?: string;
  waitFor?: string;
}

export interface WebCapture {
  name: string;
  png: string;
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  url: string;
  viewport: { width: number; height: number };
  title: string;
}

/**
 * Settles rendering work: fonts loaded, and up to 3 seconds for animations/canvas to stabilize.
 */
async function settle(page: Page): Promise<void> {
  try {
    await page.evaluate(() => {
      const g = globalThis as unknown as {
        document?: { fonts?: { ready?: Promise<void> } };
      };
      return g.document?.fonts?.ready;
    });
  } catch {}

  let prev = "";
  for (let i = 0; i < 6; i++) {
    try {
      const shot = (await page.screenshot({ type: "jpeg", quality: 30 })).toString("base64");
      if (shot === prev) return;
      prev = shot;
      await page.waitForTimeout(500);
    } catch {
      break;
    }
  }
}

export async function captureWeb(t: VisualTarget, outDir: string): Promise<WebCapture> {
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const browser = await getSharedBrowser();
  const viewport = t.viewport ?? { width: 1280, height: 720 };
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("console", (m) => {
    if (m.type() === "error") {
      consoleErrors.push(m.text());
    }
  });

  page.on("pageerror", (e) => {
    pageErrors.push(String(e));
  });

  page.on("requestfailed", (r) => {
    failedRequests.push(`${r.method()} ${r.url()} ${r.failure()?.errorText ?? ""}`);
  });

  page.on("response", (r) => {
    if (r.status() >= 500) {
      failedRequests.push(`${r.status()} ${r.url()}`);
    }
  });

  const png = join(outDir, `${t.name}.png`);

  try {
    await page.goto(t.url, { waitUntil: "load", timeout: 30000 });
    if (t.waitFor) {
      await page.waitForSelector(t.waitFor, { timeout: 15000 });
    }
    await settle(page);

    if (t.selector) {
      await page.locator(t.selector).screenshot({ path: png });
    } else {
      await page.screenshot({ path: png, fullPage: true });
    }

    const title = await page.title();
    return {
      name: t.name,
      png,
      consoleErrors,
      pageErrors,
      failedRequests,
      url: page.url(),
      viewport,
      title,
    };
  } finally {
    // Only close the per-contract Context, never close the shared CDP browser!
    await ctx.close();
  }
}
