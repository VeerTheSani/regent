/**
 * src/evidence/manifest.ts
 *
 * Generates sha256 checksum manifests and index.md for attempt evidence bundles per 07 §5.
 */

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

export interface ManifestFileEntry {
  path: string;
  sha256: string;
  sizeBytes: number;
}

export interface EvidenceManifest {
  jobId: string;
  ctrId: string;
  attempt: number;
  timestamp: string;
  files: ManifestFileEntry[];
}

export function buildEvidenceManifest(
  attemptDir: string,
  ids: { jobId: string; ctrId: string; attempt: number },
): EvidenceManifest {
  const fileEntries: ManifestFileEntry[] = [];

  function scan(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const fullPath = join(dir, ent.name);
      if (ent.isDirectory()) {
        scan(fullPath);
      } else if (ent.isFile() && ent.name !== "manifest.json" && ent.name !== "index.md") {
        const buffer = readFileSync(fullPath);
        const hash = createHash("sha256").update(buffer).digest("hex");
        const stat = statSync(fullPath);
        fileEntries.push({
          path: relative(attemptDir, fullPath).replace(/\\/g, "/"),
          sha256: hash,
          sizeBytes: stat.size,
        });
      }
    }
  }

  scan(attemptDir);

  const manifest: EvidenceManifest = {
    jobId: ids.jobId,
    ctrId: ids.ctrId,
    attempt: ids.attempt,
    timestamp: new Date().toISOString(),
    files: fileEntries,
  };

  // Write manifest.json
  const manifestPath = join(attemptDir, "manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

  // Write index.md
  let indexMd = `# Evidence Bundle: ${ids.ctrId} (Attempt ${ids.attempt})\n\n`;
  indexMd += `**Job**: \`${ids.jobId}\`  \n`;
  indexMd += `**Captured**: ${manifest.timestamp}  \n`;
  indexMd += `**Artifacts Count**: ${fileEntries.length}  \n\n`;
  indexMd += "| File | Size | SHA-256 |\n";
  indexMd += "|---|---|---|\n";
  for (const f of fileEntries) {
    indexMd += `| \`${f.path}\` | ${f.sizeBytes} B | \`${f.sha256.slice(0, 16)}...\` |\n`;
  }

  const indexPath = join(attemptDir, "index.md");
  writeFileSync(indexPath, indexMd, "utf-8");

  return manifest;
}
