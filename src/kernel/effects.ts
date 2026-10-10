/**
 * src/kernel/effects.ts
 *
 * Side-effect bus and handlers subscribed to state transitions.
 * Pure reducers compute next state; effects perform idempotent external actions.
 */

import type { Ledger } from "./ledger.js";

export type EffectHandler<T = unknown> = (payload: T) => Promise<void>;

export class EffectBus {
  private handlers: Map<string, EffectHandler[]> = new Map();

  constructor(private readonly ledger: Ledger) {}

  subscribe<T = unknown>(transition: string, handler: EffectHandler<T>): void {
    const list = this.handlers.get(transition) ?? [];
    list.push(handler as EffectHandler);
    this.handlers.set(transition, list);
  }

  async dispatch<T = unknown>(transition: string, payload: T, idemKey?: string): Promise<boolean> {
    if (idemKey) {
      // Record transition effect intent in ledger; if duplicate, skip execution
      const res = this.ledger.append({
        type: `effect.${transition}`,
        actor: "effect_bus",
        idemKey,
        payload: { transition, payload },
      });
      if (res.duplicate) {
        return false;
      }
    }

    const list = this.handlers.get(transition) ?? [];
    for (const h of list) {
      await h(payload);
    }
    return true;
  }
}
