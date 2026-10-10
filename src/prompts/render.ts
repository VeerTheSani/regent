/**
 * src/prompts/render.ts
 *
 * Strict prompt template renderer supporting only:
 * - {{var}}
 * - {{#if var}}...{{/if}}
 *
 * Rules:
 * - Unknown construct => throws Error
 * - Missing variable => throws Error (no silent blanks)
 */

export function renderPrompt(template: string, variables: Record<string, unknown>): string {
  let result = template;

  // 1. Process {{#if var}}...{{/if}} blocks
  const ifRegex = /\{\{#if\s+([a-zA-Z0-9_]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  result = result.replace(ifRegex, (_match, varName, innerContent) => {
    const val = variables[varName];
    const isTruthy =
      val !== undefined &&
      val !== null &&
      val !== false &&
      val !== "" &&
      (!Array.isArray(val) || val.length > 0);

    return isTruthy ? innerContent : "";
  });

  // 2. Check for unsupported block helpers or syntax (e.g. {{#each}}, {{^}}, {{/foo}})
  const invalidBlockMatch = /\{\{[#/!][^}]*\}\}/.exec(result);
  if (invalidBlockMatch) {
    throw new Error(`Unknown construct in template: ${invalidBlockMatch[0]}`);
  }

  // 3. Process {{var}} replacements
  const varRegex = /\{\{([a-zA-Z0-9_]+)\}\}/g;
  result = result.replace(varRegex, (_match, varName) => {
    if (!(varName in variables) || variables[varName] === undefined) {
      throw new Error(`Missing variable: ${varName}`);
    }
    const val = variables[varName];
    if (Array.isArray(val)) {
      return val.join("\n");
    }
    if (typeof val === "object" && val !== null) {
      return JSON.stringify(val, null, 2);
    }
    return String(val);
  });

  // 4. Check for any remaining unmatched, malformed, or unclosed {{ or }} tags
  if (result.includes("{{") || result.includes("}}")) {
    throw new Error(
      `Unknown construct in template or unclosed tag remaining in: ${result.slice(0, 100)}`,
    );
  }

  return result;
}
