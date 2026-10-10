/**
 * src/engine/browser-driver.ts
 *
 * Live Chrome & Media Operator.
 * Adopts Hermes Agent browser_tool_cdp patterns: connects to live Chrome over CDP
 * (or launches instance), controls DOM elements, extracts content, and manipulates
 * media playback (such as video.playbackRate = 0.5) directly like a human.
 */

import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { type Browser, type BrowserContext, type Page, chromium } from "playwright";

export interface BrowserDriverOptions {
  cdpUrl?: string;
  headless?: boolean;
}

export interface MediaControlOptions {
  speed?: number;
  volume?: number;
  play?: boolean;
}

export interface MediaControlResult {
  found: boolean;
  speed: number;
  volume: number;
  paused: boolean;
}

export class ChromeBrowserDriver {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private activePage: Page | null = null;
  private cdpUrl: string;
  private headless: boolean;

  constructor(options: BrowserDriverOptions = {}) {
    this.cdpUrl = options.cdpUrl ?? "http://127.0.0.1:9222";
    this.headless = options.headless ?? process.env.REGENT_HEADLESS === "1";
  }

  /**
   * Connects to live user Chrome over CDP, or launches visible browser.
   */
  async ensureConnected(): Promise<BrowserContext> {
    if (this.context) return this.context;

    try {
      this.browser = await chromium.connectOverCDP(this.cdpUrl);
      const contexts = this.browser.contexts();
      this.context = contexts[0] ?? (await this.browser.newContext());
    } catch {
      const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
      if (existsSync(chromePath)) {
        this.browser = await chromium.launch({
          executablePath: chromePath,
          headless: this.headless,
          args: ["--autoplay-policy=no-user-gesture-required"],
        });
      } else {
        this.browser = await chromium.launch({
          headless: this.headless,
          args: ["--autoplay-policy=no-user-gesture-required"],
        });
      }
      this.context = await this.browser.newContext();
    }

    return this.context;
  }

  /**
   * Opens URL in tab and waits for network idle.
   */
  async openTab(url: string): Promise<Page> {
    const ctx = await this.ensureConnected();
    const page = await ctx.newPage();
    this.activePage = page;

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    return page;
  }

  /**
   * Returns current active page or creates new tab.
   */
  async getPage(): Promise<Page> {
    if (this.activePage && !this.activePage.isClosed()) {
      return this.activePage;
    }
    const ctx = await this.ensureConnected();
    const pages = ctx.pages();
    this.activePage = pages[pages.length - 1] ?? (await ctx.newPage());
    return this.activePage;
  }

  /**
   * Manipulates in-page HTML5 <video> / <audio> element properties (playbackRate, volume).
   */
  async controlMediaElement(options: MediaControlOptions = {}): Promise<MediaControlResult> {
    const page = await this.getPage();

    const result = await page.evaluate((opts) => {
      const media =
        (document.querySelector("video") as HTMLVideoElement | null) ||
        (document.querySelector("audio") as HTMLAudioElement | null);

      if (!media) {
        return { found: false, speed: 1.0, volume: 1.0, paused: true };
      }

      if (opts.speed !== undefined) {
        media.playbackRate = opts.speed;
      }
      if (opts.volume !== undefined) {
        media.volume = Math.max(0, Math.min(1, opts.volume));
      }
      if (opts.play === true) {
        media.play().catch(() => {});
      }

      return {
        found: true,
        speed: media.playbackRate,
        volume: media.volume,
        paused: media.paused,
      };
    }, options);

    return result;
  }

  /**
   * Extracts clean text content from the active page or a CSS selector.
   */
  async extractText(selector?: string): Promise<string> {
    const page = await this.getPage();
    if (selector) {
      const el = await page.$(selector);
      if (el) return (await el.innerText()).trim();
    }
    return page.evaluate(() => document.body.innerText.trim());
  }

  /**
   * Takes full-page or element screenshot.
   */
  async takeScreenshot(destPath: string, selector?: string): Promise<string> {
    const page = await this.getPage();
    const abs = resolve(destPath);
    const dir = dirname(abs);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    if (selector) {
      const el = await page.$(selector);
      if (el) {
        await el.screenshot({ path: abs });
        return abs;
      }
    }

    await page.screenshot({ path: abs, fullPage: false });
    return abs;
  }

  /**
   * Closes browser context and handles.
   */
  async close(): Promise<void> {
    try {
      if (this.context) await this.context.close();
      if (this.browser) await this.browser.close();
    } catch {}
    this.context = null;
    this.browser = null;
    this.activePage = null;
  }
}
