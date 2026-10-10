/**
 * src/workers/spawn.ts
 *
 * Process spawning using cross-spawn (Windows .cmd shim resolution, no shell: true)
 * and tree-kill on cancellation/timeout.
 */

import type { ChildProcess } from "node:child_process";
import spawn from "cross-spawn";
import treeKill from "tree-kill";

export interface SpawnTreeOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

export interface TreeProcess {
  child: ChildProcess;
  killTree(signal?: string): Promise<void>;
}

export function spawnTree(
  command: string,
  args: string[],
  options: SpawnTreeOptions = {},
): TreeProcess {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    windowsHide: true,
  });

  const killTree = (signal = "SIGKILL"): Promise<void> => {
    return new Promise((resolve) => {
      if (!child.pid) {
        resolve();
        return;
      }
      treeKill(child.pid, signal, () => {
        resolve();
      });
    });
  };

  if (options.timeoutMs && options.timeoutMs > 0) {
    const timer = setTimeout(() => {
      killTree("SIGKILL").catch(() => {});
    }, options.timeoutMs);

    child.on("close", () => {
      clearTimeout(timer);
    });
  }

  return { child, killTree };
}
