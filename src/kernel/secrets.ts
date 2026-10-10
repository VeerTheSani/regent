/**
 * src/kernel/secrets.ts
 *
 * Secret detection, redaction, and environment variable resolution per 02 §6, 12 §5.
 */

export const SECRET_PATTERNS: RegExp[] = [
  /sk-ant-[a-zA-Z0-9_\-]{20,}/g, // Anthropic API key
  /sk-or-v1-[a-f0-9]{40,}/g, // OpenRouter API key
  /gh[pousr]_[a-zA-Z0-9]{36,}/g, // GitHub tokens
  /AKIA[0-9A-Z]{16}/g, // AWS Access Key ID
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/g, // Private keys
  /Bearer\s+[a-zA-Z0-9_\-\.]{25,}/gi, // Bearer tokens
];

export interface SecretScanMatch {
  rule: string;
  index: number;
}

export class SecretsManager {
  private knownSecrets: Set<string> = new Set();

  registerSecret(secret: string): void {
    if (secret && secret.length >= 8) {
      this.knownSecrets.add(secret);
    }
  }

  scan(text: string): SecretScanMatch[] {
    const matches: SecretScanMatch[] = [];

    // 1. Regex pattern check
    for (const pattern of SECRET_PATTERNS) {
      pattern.lastIndex = 0;
      let m = pattern.exec(text);
      while (m !== null) {
        matches.push({
          rule: `Pattern match: ${pattern.source.slice(0, 15)}...`,
          index: m.index,
        });
        m = pattern.exec(text);
      }
    }

    // 2. Known secret check
    for (const secret of this.knownSecrets) {
      let idx = text.indexOf(secret);
      while (idx !== -1) {
        matches.push({
          rule: "Known secret value match",
          index: idx,
        });
        idx = text.indexOf(secret, idx + secret.length);
      }
    }

    return matches;
  }

  redact(text: string): string {
    let result = text;

    for (const pattern of SECRET_PATTERNS) {
      pattern.lastIndex = 0;
      result = result.replace(pattern, "[REDACTED_SECRET]");
    }

    for (const secret of this.knownSecrets) {
      result = result.replaceAll(secret, "[REDACTED_SECRET]");
    }

    return result;
  }
}
