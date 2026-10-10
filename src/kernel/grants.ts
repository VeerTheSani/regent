/**
 * src/kernel/grants.ts
 *
 * Grant store and authority matching engine per 02 §2.
 */

import picomatch from "picomatch";

export interface Grant {
  id: string;
  jobId: string;
  action: string;
  scope?: Record<string, unknown>;
  expires?: string; // ISO-8601
  maxUses?: number;
  usedCount: number;
}

export class GrantStore {
  private grants: Map<string, Grant> = new Map();

  add(grant: Omit<Grant, "usedCount"> & { usedCount?: number }): Grant {
    const fullGrant: Grant = {
      ...grant,
      usedCount: grant.usedCount ?? 0,
    };
    this.grants.set(fullGrant.id, fullGrant);
    return fullGrant;
  }

  get(id: string): Grant | undefined {
    return this.grants.get(id);
  }

  isExpired(grant: Grant): boolean {
    if (!grant.expires) return false;
    const expiryTime = new Date(grant.expires).getTime();
    return Date.now() > expiryTime;
  }

  hasUsesLeft(grant: Grant): boolean {
    if (grant.maxUses === undefined) return true;
    return grant.usedCount < grant.maxUses;
  }

  match(jobId: string, action: string, target: Record<string, unknown> = {}): Grant | undefined {
    for (const grant of this.grants.values()) {
      if (grant.jobId !== jobId) continue;

      // Match action (supports wildcard e.g. "deploy.*")
      const actionMatcher = picomatch(grant.action);
      if (!actionMatcher(action) && grant.action !== action) continue;

      // Check validity
      if (this.isExpired(grant)) continue;
      if (!this.hasUsesLeft(grant)) continue;

      // Check scope
      if (grant.scope && !this.matchScope(grant.scope, target)) {
        continue;
      }

      return grant;
    }
    return undefined;
  }

  consume(grantId: string): boolean {
    const grant = this.grants.get(grantId);
    if (!grant) return false;
    if (!this.hasUsesLeft(grant)) return false;
    grant.usedCount += 1;
    return true;
  }

  private matchScope(scope: Record<string, unknown>, target: Record<string, unknown>): boolean {
    for (const [key, scopeVal] of Object.entries(scope)) {
      const targetVal = target[key];

      if (Array.isArray(scopeVal)) {
        // e.g. branches: ["main", "release/*"]
        if (targetVal === undefined) return false;
        const targetStr = String(targetVal);
        const matchesAny = scopeVal.some((pattern) => {
          const isMatch = picomatch(String(pattern));
          return isMatch(targetStr) || String(pattern) === targetStr;
        });
        if (!matchesAny) return false;
      } else if (typeof scopeVal === "object" && scopeVal !== null) {
        if (typeof targetVal !== "object" || targetVal === null) return false;
        if (
          !this.matchScope(
            scopeVal as Record<string, unknown>,
            targetVal as Record<string, unknown>,
          )
        ) {
          return false;
        }
      } else if (scopeVal !== undefined) {
        if (String(scopeVal) !== String(targetVal)) {
          return false;
        }
      }
    }
    return true;
  }
}
