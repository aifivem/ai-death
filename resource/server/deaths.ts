import { aiLog, coordsOf, online } from "@aicore-fivem/lib/server";
import { CORE, type DeathInfo } from "@aicore-fivem/shared";
import { downed } from "./downed";

function wentDown(
  source: number,
  killer: number | null = null,
  weapon?: number,
  info?: DeathInfo,
): void {
  if (downed.isDown(source) || !online.character(source)) return;
  downed.down(source);
  // What killed a player is the first question: ai-core's death info (cause, who, distance), else the weapon hash.
  aiLog("deaths", "went down", {
    source,
    target: killer ?? undefined,
    metadata: info
      ? {
          weapon,
          cause: info.cause,
          killedBy: info.killedBy,
          distance: info.distance,
          inVehicle: info.inVehicle,
          killerInVehicle: info.killerInVehicle,
          ...info.coords,
        }
      : { weapon, ...coordsOf(source) },
  });
}

// FXServer 38039+ reports the death from the synced health itself (ai-core's playerDied); older builds rely on the
// client's report, checked against the synced health so a client cannot claim a death that did not happen.
on(
  CORE.playerDiedEvent,
  (source: number, killer: number | null, weapon: number, info?: DeathInfo) =>
    wentDown(source, killer, weapon, info),
);
