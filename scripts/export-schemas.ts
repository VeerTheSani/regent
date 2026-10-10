/**
 * scripts/export-schemas.ts
 *
 * Exports Zod schemas to JSON Schema files in schemas/*.json.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { zodToJsonSchema } from "zod-to-json-schema";
import { AskOutput, PermitOutput } from "../src/schemas/bridge.js";
import { MissionBrief } from "../src/schemas/brief.js";
import { Contract } from "../src/schemas/contract.js";
import { GraphPatch } from "../src/schemas/graph-patch.js";
import { Verdict } from "../src/schemas/verdict.js";

const OUT_DIR = join(process.cwd(), "schemas");
if (!existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR, { recursive: true });
}

const schemasToExport = [
  { name: "brief.json", schema: MissionBrief, title: "MissionBrief" },
  { name: "contract.json", schema: Contract, title: "Contract" },
  { name: "verdict.json", schema: Verdict, title: "Verdict" },
  { name: "graph-patch.json", schema: GraphPatch, title: "GraphPatch" },
  { name: "ask-output.json", schema: AskOutput, title: "AskOutput" },
  { name: "permit-output.json", schema: PermitOutput, title: "PermitOutput" },
];

for (const { name, schema, title } of schemasToExport) {
  const jsonSchema = zodToJsonSchema(schema, title);
  const outPath = join(OUT_DIR, name);
  writeFileSync(outPath, JSON.stringify(jsonSchema, null, 2), "utf-8");
  console.log(`Exported ${name}`);
}

console.log("All JSON schemas exported successfully.");
