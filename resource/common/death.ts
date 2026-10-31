import {
  bool,
  int,
  num,
  readBlipStyle,
  record,
  str,
  vec4,
  type Vec4,
} from "@aicore-fivem/lib/shared";

/** ai-death's contracts and panel content. No natives. */

export const EVENTS = {
  /** Server -> owner: (seconds) the player is down; respawn opens after `seconds` (client clock). */
  down: "ai-death:client:down",
  /** Server -> owner: (point: Vec4 | null) back on their feet: at a hospital, or where they lie (revive). */
  revive: "ai-death:client:revive",
  /** Callback: () -> { ok } respawn at the nearest hospital after the timer (pays the fee). */
  respawn: "ai-death:respawn",
  /** Callback: (hospitalId) -> { ok } paid treatment at a check-in point. */
  treat: "ai-death:treat",
} as const;

/** The metadata key ai-core keeps (QB's `isdead`, so a reconnect while dead stays dead). */
export const DEAD_META = "isdead";

export interface Settings {
  respawnSeconds: number;
  respawnFee: number;
  accounts: string[];
  /** Respawning at a hospital empties the inventory. */
  clearInventory: boolean;
  /** Jobs whose on-duty members revive with a medikit and count for treatment. */
  emsJobs: string[];
  treatPrice: number;
  /** Check-in treatment works only while at most this many medics are on duty. */
  treatMaxEms: number;
}

export interface Hospital {
  id: string;
  label: string;
  respawn: Vec4;
  checkin: { x: number; y: number; z: number };
  blip: boolean;
  blipStyle: { sprite: number; color: number; scale: number };
}

const names = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export function readSettings(raw: unknown): Settings {
  const s = record(raw);
  return {
    respawnSeconds: int(s.respawnSeconds, 300, 0, 3600),
    respawnFee: int(s.respawnFee, 1000, 0, 1_000_000),
    accounts: names(s.accounts).length ? names(s.accounts) : ["bank", "cash"],
    clearInventory: bool(s.clearInventory, false),
    emsJobs: names(s.emsJobs).length ? names(s.emsJobs) : ["ambulance"],
    treatPrice: int(s.treatPrice, 250, 0, 1_000_000),
    treatMaxEms: int(s.treatMaxEms, 2, 0, 100),
  };
}

/** One hospital of the panel's records file (`panel.records` / `world.records`). */
export function readHospital(id: string, v: Record<string, unknown>): Hospital {
  const c = record(v.checkin);
  const style = record(v.blipStyle);
  const respawn = vec4(v.respawn, { x: 0, y: 0, z: 0, heading: 0 });
  return {
    id,
    label: str(v.label, id, 48),
    respawn,
    checkin: {
      x: num(c.x, respawn.x),
      y: num(c.y, respawn.y),
      z: num(c.z, respawn.z),
    },
    blip: bool(v.blip, true),
    blipStyle: readBlipStyle(style, { sprite: 61, color: 1, scale: 0.7 }),
  };
}

/** Client -> NUI messages. */
export type NuiMessage =
  | { action: "down"; data: { texts: Record<string, string>; until: number } }
  | { action: "up"; data: null };
