/**
 * src/rune/interpreter.ts
 *
 * RUNE 2.0 (Regent Unified Native Execution) Interpreter.
 * Ultra-expressive, zero-overhead language providing full-metal host system control,
 * dynamic capability synthesis (on-the-fly C / C# Win32 compilation),
 * hardware I/O, window management, process inspection, and control flow.
 */

import spawn from "cross-spawn";
import { CapabilityRegistry } from "./capabilities.js";
import { RuneCompiler } from "./compiler.js";
import { RuneKernel } from "./kernel.js";
import { RuneRuntime } from "./runtime.js";

export interface RuneContext {
  vars: Map<string, string>;
  lastOutput: string;
}

export class RuneInterpreter {
  readonly runtime = new RuneRuntime();
  readonly kernel = new RuneKernel();
  readonly compiler = new RuneCompiler();
  readonly registry = new CapabilityRegistry();

  private context: RuneContext = {
    vars: new Map(),
    lastOutput: "",
  };

  /**
   * Run a full RUNE 2.0 script with blocks, control flow, and statements.
   */
  async run(script: string): Promise<string> {
    const sanitized = script.replace(/\r\n/g, "\n");
    const statements = this.parseStatements(sanitized);

    for (const stmt of statements) {
      await this.evalStatement(stmt);
    }

    return this.context.lastOutput;
  }

  /**
   * Parses script into top-level statements, handling nested { ... } blocks.
   */
  private parseStatements(script: string): string[] {
    const stmts: string[] = [];
    let current = "";
    let braceDepth = 0;
    let inQuotes = false;
    let quoteChar = "";

    for (let i = 0; i < script.length; i++) {
      const c = script[i];

      // Handle quotes
      if ((c === '"' || c === "'") && script[i - 1] !== "\\") {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = c;
        } else if (c === quoteChar) {
          inQuotes = false;
          quoteChar = "";
        }
      }

      if (!inQuotes) {
        if (c === "{") braceDepth++;
        else if (c === "}") braceDepth--;

        if ((c === "\n" || c === ";") && braceDepth === 0) {
          const trimmed = current.trim();
          if (trimmed.length > 0 && !trimmed.startsWith("#")) {
            stmts.push(trimmed);
          }
          current = "";
          continue;
        }
      }

      current += c;
    }

    const trimmed = current.trim();
    if (trimmed.length > 0 && !trimmed.startsWith("#")) {
      stmts.push(trimmed);
    }

    return stmts;
  }

  private async evalStatement(stmt: string): Promise<string> {
    const trimmed = stmt.trim();

    // 1. Dynamic Native Definition: native <name> { <c_code> }
    if (trimmed.startsWith("native ")) {
      const openBrace = trimmed.indexOf("{");
      const closeBrace = trimmed.lastIndexOf("}");
      if (openBrace === -1 || closeBrace === -1) {
        throw new Error("Syntax error: native <name> { <C/C# code> }");
      }
      const name = trimmed.slice(7, openBrace).trim();
      const code = trimmed.slice(openBrace + 1, closeBrace).trim();

      const compileRes = await this.compiler.compile(code);
      this.registry.register({
        name,
        params: [],
        body: code,
        kind: "native",
        compiledBinaryPath: compileRes.binaryPath,
      });

      const msg = `Synthesized native primitive: ${name} (compiled in ${compileRes.compileMs}ms)`;
      this.context.lastOutput = msg;
      return msg;
    }

    // 2. Dynamic Function Definition: def <name> <params...> { <body> }
    if (trimmed.startsWith("def ")) {
      const openBrace = trimmed.indexOf("{");
      const closeBrace = trimmed.lastIndexOf("}");
      if (openBrace === -1 || closeBrace === -1) {
        throw new Error("Syntax error: def <name> <params...> { <body> }");
      }
      const header = trimmed.slice(4, openBrace).trim();
      const parts = header.split(/\s+/);
      const name = parts[0];
      const params = parts.slice(1);
      const body = trimmed.slice(openBrace + 1, closeBrace).trim();

      this.registry.register({
        name,
        params,
        body,
        kind: "rune",
      });

      const msg = `Defined capability: ${name}`;
      this.context.lastOutput = msg;
      return msg;
    }

    // 3. Control Flow: loop <count> { <body> }
    if (trimmed.startsWith("loop ")) {
      const openBrace = trimmed.indexOf("{");
      const closeBrace = trimmed.lastIndexOf("}");
      const countExpr = trimmed.slice(5, openBrace).trim();
      const resolvedCount = Number.parseInt(
        this.interpolate(countExpr, this.context.lastOutput),
        10,
      );
      const body = trimmed.slice(openBrace + 1, closeBrace).trim();

      const subStmts = this.parseStatements(body);
      let last = "";
      for (let i = 0; i < resolvedCount; i++) {
        this.context.vars.set("i", String(i));
        for (const sub of subStmts) {
          last = await this.evalStatement(sub);
        }
      }
      return last;
    }

    // 4. Control Flow: if <cond> { <body> } [else { <elseBody> }]
    if (trimmed.startsWith("if ")) {
      const openBrace = trimmed.indexOf("{");
      const condExpr = trimmed.slice(3, openBrace).trim();
      const resolvedCond = this.interpolate(condExpr, this.context.lastOutput).trim();

      // Check condition (truthy: non-empty, != "0", != "false")
      const isTrue = resolvedCond !== "" && resolvedCond !== "0" && resolvedCond !== "false";

      let elseIdx = trimmed.indexOf("} else {", openBrace);
      if (elseIdx === -1) elseIdx = trimmed.indexOf("}else{", openBrace);

      if (elseIdx !== -1) {
        const bodyTrue = trimmed.slice(openBrace + 1, elseIdx).trim();
        const closeBrace = trimmed.lastIndexOf("}");
        const bodyFalse = trimmed.slice(trimmed.indexOf("{", elseIdx) + 1, closeBrace).trim();

        const activeBody = isTrue ? bodyTrue : bodyFalse;
        const subStmts = this.parseStatements(activeBody);
        let last = "";
        for (const sub of subStmts) {
          last = await this.evalStatement(sub);
        }
        return last;
      }

      if (isTrue) {
        const closeBrace = trimmed.lastIndexOf("}");
        const body = trimmed.slice(openBrace + 1, closeBrace).trim();
        const subStmts = this.parseStatements(body);
        let last = "";
        for (const sub of subStmts) {
          last = await this.evalStatement(sub);
        }
        return last;
      }

      return this.context.lastOutput;
    }

    // 5. Standard Pipelines
    return this.evalPipeline(trimmed);
  }

  private async evalPipeline(line: string): Promise<string> {
    const pipeSegments = line.split("|").map((s) => s.trim());
    let currentInput = this.context.lastOutput;

    for (const segment of pipeSegments) {
      currentInput = await this.evalSegment(segment, currentInput);
    }

    this.context.lastOutput = currentInput;
    return currentInput;
  }

  private async evalSegment(segment: string, pipeInput: string): Promise<string> {
    const resolved = this.interpolate(segment, pipeInput);
    const tokens = this.tokenize(resolved);
    if (tokens.length === 0) return pipeInput;

    const cmd = tokens[0].toLowerCase();
    const args = tokens.slice(1);

    // Check user-defined dynamic capabilities first
    const custom = this.registry.get(cmd);
    if (custom) {
      if (custom.kind === "native" && custom.compiledBinaryPath) {
        const bin = custom.compiledBinaryPath;
        return new Promise((resolve, reject) => {
          const child = spawn(bin, args, {
            stdio: ["ignore", "pipe", "pipe"],
          });
          let out = "";
          let err = "";
          child.stdout?.on("data", (d) => {
            out += d.toString();
          });
          child.stderr?.on("data", (d) => {
            err += d.toString();
          });
          child.on("close", (code) => {
            if (code === 0) resolve(out.trim());
            else reject(new Error(err.trim() || out.trim()));
          });
          child.on("error", reject);
        });
      }

      // RUNE macro
      const macroContext: Record<string, string> = {};
      for (let i = 0; i < custom.params.length; i++) {
        macroContext[custom.params[i]] = args[i] ?? "";
      }
      for (const [k, v] of Object.entries(macroContext)) {
        this.context.vars.set(k, v);
      }
      return this.run(custom.body);
    }

    switch (cmd) {
      // --- BROWSER & MEDIA PRIMITIVES ---
      case "browser.open":
      case "open": {
        const url = args.join(" ");
        const out = await this.runtime.openUrl(url);
        return out || `Opened ${url}`;
      }
      case "media.play":
      case "audio.play": {
        const query = args.join(" ");
        const out = await this.runtime.playMedia(query);
        return out || `Playing ${query}`;
      }

      // --- LOW-LEVEL KERNEL: Hardware Mouse ---
      case "mouse.move": {
        const x = Number.parseFloat(args[0]);
        const y = Number.parseFloat(args[1]);
        await this.kernel.mouseMove(x, y);
        return `Mouse moved to ${x}, ${y}`;
      }
      case "mouse.click": {
        const btn = (args[0] ?? "left") as "left" | "right" | "middle";
        await this.kernel.mouseClick(btn);
        return `Mouse clicked ${btn}`;
      }

      // --- LOW-LEVEL KERNEL: Keyboard ---
      case "key.type": {
        const text = args.join(" ");
        await this.kernel.keyType(text);
        return `Typed: ${text}`;
      }
      case "key.press": {
        const key = args[0] ?? "ENTER";
        await this.kernel.keyPress(key);
        return `Pressed: ${key}`;
      }

      // --- LOW-LEVEL KERNEL: Window Management ---
      case "win.list": {
        const windows = await this.kernel.listWindows();
        return JSON.stringify(windows, null, 2);
      }
      case "win.move": {
        const title = args[0];
        const x = Number.parseInt(args[1], 10);
        const y = Number.parseInt(args[2], 10);
        const w = Number.parseInt(args[3], 10);
        const h = Number.parseInt(args[4], 10);
        const ok = await this.kernel.setWindowRect(title, x, y, w, h);
        return ok ? `Window ${title} moved` : `Window not found: ${title}`;
      }
      case "win.close": {
        const title = args[0];
        const ok = await this.kernel.closeWindow(title);
        return ok ? `Window ${title} closed` : `Window not found: ${title}`;
      }

      // --- LOW-LEVEL KERNEL: Process Introspection & Kill ---
      case "sys.ps": {
        const limit = args[0] ? Number.parseInt(args[0], 10) : 25;
        const procs = await this.kernel.listProcesses(limit);
        return JSON.stringify(procs, null, 2);
      }
      case "sys.kill": {
        const target = args[0];
        const pid = Number.parseInt(target, 10);
        const ok = await this.kernel.killProcess(Number.isNaN(pid) ? target : pid);
        return ok ? `Terminated: ${target}` : `Failed to terminate: ${target}`;
      }

      // --- LOW-LEVEL KERNEL: Display & Audio ---
      case "display.info": {
        const info = await this.kernel.getDisplayInfo();
        return JSON.stringify(info);
      }
      case "audio.beep": {
        const freq = args[0] ? Number.parseInt(args[0], 10) : 800;
        const dur = args[1] ? Number.parseInt(args[1], 10) : 250;
        await this.kernel.beep(freq, dur);
        return `Beep ${freq}Hz`;
      }

      // --- DESKTOP AUTOMATION ---
      case "wallpaper": {
        const imagePath = args.join(" ");
        await this.runtime.setWallpaper(imagePath);
        return `Wallpaper updated to ${imagePath}`;
      }
      case "snap":
      case "screenshot": {
        const dest = args[0] ?? "screenshot.png";
        const saved = await this.runtime.screenshot(dest);
        return `Screenshot captured: ${saved}`;
      }
      case "notify": {
        const title = args[0] ?? "Rune Notification";
        const msg = args.slice(1).join(" ") || "Action complete";
        await this.runtime.notify(title, msg);
        return `Notification sent: ${title}`;
      }
      case "clip": {
        if (args.length > 0) {
          return this.runtime.clipboard(args.join(" "));
        }
        return this.runtime.clipboard();
      }
      case "focus": {
        const target = args.join(" ");
        const focused = await this.runtime.focusWindow(target);
        return focused ? `Focused: ${target}` : `Window not found: ${target}`;
      }

      // --- NETWORK & FILESYSTEM ---
      case "fetch":
      case "download": {
        let url = args[0];
        let dest = args[1];
        if (args.includes("->")) {
          const idx = args.indexOf("->");
          url = args.slice(0, idx).join(" ");
          dest = args.slice(idx + 1).join(" ");
        }
        if (!url || !dest) throw new Error("fetch requires: fetch <url> -> <dest>");
        const bytes = await this.runtime.fetchToFile(url, dest);
        return `Downloaded ${bytes} bytes to ${dest}`;
      }
      case "get": {
        const url = args.join(" ");
        return this.runtime.fetchText(url);
      }
      case "write": {
        const dest = args[0];
        const text = args.slice(1).join(" ");
        this.runtime.writeFile(dest, text);
        return `Wrote to ${dest}`;
      }
      case "read": {
        const src = args[0];
        return this.runtime.readFile(src);
      }
      case "print":
      case "echo": {
        const text = args.join(" ");
        console.log(text);
        return text;
      }
      case "let": {
        const eqIdx = args.indexOf("=");
        if (eqIdx === -1) throw new Error("let requires: let <name> = <value>");
        const name = args.slice(0, eqIdx).join("").trim();
        const value = args
          .slice(eqIdx + 1)
          .join(" ")
          .trim();
        this.context.vars.set(name, value);
        return value;
      }
      case "exec":
      case "sh":
      case "cmd": {
        return this.runtime.exec(args.join(" "));
      }

      default: {
        return this.runtime.exec(resolved);
      }
    }
  }

  private interpolate(text: string, pipeInput: string): string {
    let out = text.replace(/\$out/g, pipeInput);
    for (const [k, v] of this.context.vars.entries()) {
      out = out.replace(new RegExp(`\\$${k}\\b`, "g"), v);
      out = out.replace(new RegExp(`\\$\\{${k}\\}`, "g"), v);
    }
    return out;
  }

  private tokenize(line: string): string[] {
    const tokens: string[] = [];
    let current = "";
    let inQuotes = false;
    let quoteChar = "";

    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if ((c === '"' || c === "'") && line[i - 1] !== "\\") {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = c;
        } else if (c === quoteChar) {
          inQuotes = false;
          quoteChar = "";
        }
      } else if (c === " " && !inQuotes) {
        if (current.length > 0) {
          tokens.push(current);
          current = "";
        }
      } else {
        current += c;
      }
    }
    if (current.length > 0) tokens.push(current);
    return tokens;
  }
}
