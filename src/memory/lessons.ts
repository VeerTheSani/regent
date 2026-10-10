/**
 * src/memory/lessons.ts
 *
 * Durable lesson repository per 10 §4 (~/.regent/memory/lessons.jsonl).
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface Lesson {
  id: string;
  scope: {
    project?: string;
    kind?: string;
  };
  observation: string;
  evidence: string[];
  change: {
    target: string;
    add: string;
  };
  confidence: number;
  created: string;
  uses: number;
  helped: number;
}

export class LessonStore {
  readonly filePath: string;

  constructor(filePath?: string) {
    if (filePath) {
      this.filePath = filePath;
    } else {
      const userHome = process.env.USERPROFILE || process.env.HOME || "C:/Users/sanis";
      this.filePath = join(userHome, ".regent", "memory", "lessons.jsonl");
    }

    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  saveLesson(lesson: Lesson): void {
    appendFileSync(this.filePath, `${JSON.stringify(lesson)}\n`, "utf-8");
  }

  getLessons(scope: { project?: string; kind?: string }): Lesson[] {
    if (!existsSync(this.filePath)) return [];

    const lines = readFileSync(this.filePath, "utf-8").trim().split("\n");
    const matched: Lesson[] = [];

    for (const l of lines) {
      if (!l.trim()) continue;
      try {
        const item = JSON.parse(l) as Lesson;
        if (scope.project && item.scope.project && item.scope.project !== scope.project) {
          continue;
        }
        if (scope.kind && item.scope.kind && item.scope.kind !== scope.kind) {
          continue;
        }
        matched.push(item);
      } catch {}
    }

    return matched;
  }
}
