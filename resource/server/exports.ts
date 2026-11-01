import { provideExport, registerExport } from "@aicore-fivem/lib/server";
import { EVENTS } from "common/death";
import { downed } from "./downed";

/** Exports (own and qbx_medical names) for admin tools and jobs. */
const api: Record<string, (...args: unknown[]) => unknown> = {
  Revive: (source) => {
    if (typeof source !== "number" || !downed.isDown(source)) return false;
    downed.up(source, null);
    return true;
  },
  IsDead: (source) => typeof source === "number" && downed.isDown(source),
  Heal: (source) => {
    if (typeof source === "number") emitNet(EVENTS.revive, source, null);
  },
};
for (const [name, fn] of Object.entries(api)) registerExport(name, fn);
provideExport("qbx_medical", "Revive", api.Revive ?? (() => false));
provideExport("qbx_medical", "IsDead", api.IsDead ?? (() => false));
