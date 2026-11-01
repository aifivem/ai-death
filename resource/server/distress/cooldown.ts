import { KeyedCooldowns, online } from "@aicore-fivem/lib/server";

/** Doctor calls by character id (a reconnect keeps the cooldown). */
export const calls = new KeyedCooldowns<number>();
/** Whole seconds until the player's character may call a doctor again. */
export function callLeft(source: number): number {
  const charId = online.charId(source);
  return charId === undefined ? 0 : Math.ceil(calls.left(charId) / 1000);
}
