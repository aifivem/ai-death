import { isRecord, readFinite } from "@aicore-fivem/lib/shared";

export type Point = { x: number; y: number; z: number; heading: number };
/** null = revive in place; undefined = not a valid answer. */
export function toPoint(p: unknown): Point | null | undefined {
  if (p === null || p === undefined) return null;
  if (!isRecord(p)) return undefined;
  const [x, y, z] = [readFinite(p.x), readFinite(p.y), readFinite(p.z)];
  return x !== null && y !== null && z !== null
    ? { x, y, z, heading: readFinite(p.heading) ?? 0 }
    : undefined;
}
