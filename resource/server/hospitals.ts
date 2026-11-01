import {
  coordsOf,
  inventory,
  isNear,
  onClientCallback,
} from "@aicore-fivem/lib/server";
import { fail, nearestOf, oneArg, readText } from "@aicore-fivem/lib/shared";
import { EVENTS, type Hospital } from "common/death";
import { core } from "./core";
import { downed } from "./downed";
import { emsAvailable } from "./ems";
import { hospitals, settings } from "./panel";

/** The hospital whose wake-up spot is nearest on the map (height ignored). */
function nearestHospital(source: number): Hospital | undefined {
  const p = coordsOf(source);
  return nearestOf(hospitals.values(), p, (h) => ({ ...h.respawn, z: p.z }));
}

onClientCallback(
  EVENTS.respawn,
  (source) => {
    if (!downed.isDown(source)) return fail("DEATH_ERR_ALIVE");
    if (!downed.timerDone(source)) return fail("DEATH_ERR_WAIT");
    const hospital = nearestHospital(source);
    if (!hospital) return fail("DEATH_ERR_NO_HOSPITAL");
    const fee = settings.value.respawnFee;
    // A fee nobody can pay is waived: nobody stays dead for being broke.
    if (fee > 0)
      settings.value.accounts.some((a) =>
        core.RemoveMoney(source, a, fee, "hospital"),
      );
    if (settings.value.clearInventory) inventory.clearInventory(source);
    downed.up(source, hospital.respawn);
    return { ok: true };
  },
  { lock: true },
);

onClientCallback(
  EVENTS.treat,
  { args: oneArg((v) => readText(v, 64)), lock: true },
  (source, id) => {
    const hospital = hospitals.get(id);
    if (!hospital || !isNear(source, hospital.checkin, 3))
      return fail("DEATH_ERR_FAR");
    if (emsAvailable() > settings.value.treatMaxEms)
      return fail("DEATH_ERR_EMS_ONLINE");
    if (
      !settings.value.accounts.some((a) =>
        core.RemoveMoney(
          source,
          a,
          settings.value.treatPrice,
          "hospital:treatment",
        ),
      )
    )
      return fail("DEATH_ERR_MONEY");
    downed.up(source, null);
    return { ok: true };
  },
);
