/**
 * src/schemas/graph-patch.ts
 *
 * Zod schema for GraphPatch during replanning.
 */

import { z } from "zod";
import { Contract } from "./contract.js";

export const GraphPatch = z.object({
  action: z.enum(["add", "replace", "remove"]),
  targetContractId: z.string().optional(),
  contracts: z.array(Contract).default([]),
  rationale: z.string(),
});
export type GraphPatch = z.infer<typeof GraphPatch>;
