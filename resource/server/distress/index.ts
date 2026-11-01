import {
  aiLog,
  coordsOf,
  ems,
  onClientCallback,
  online,
} from "@aicore-fivem/lib/server";
import { fail } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS } from "common/death";
import { downed } from "../downed";
import { settings } from "../panel";
import { calls } from "./cooldown";

/**
 * A downed player calls a doctor: a distress call to the panel's EMS jobs through ai-core's EMS layer, then the
 * character's cooldown; the answer carries the seconds until the next call (the client counts them down).
 */
onClientCallback(
  EVENTS.distress,
  (source) => {
    if (!downed.isDown(source)) return fail("DEATH_ERR_ALIVE");
    const charId = online.charId(source);
    if (charId === undefined) return fail("DEATH_ERR_ALIVE");
    const seconds = settings.value.distressCooldown;
    if (!calls.take(charId, seconds * 1000))
      return fail("DEATH_ERR_DISTRESS_WAIT");
    const jobs = settings.value.emsJobs;
    if (
      !ems.distress(source, { jobs, message: Locale("DEATH_DISTRESS_MESSAGE") })
    ) {
      calls.clear(charId);
      return fail("DEATH_ERR_DISTRESS");
    }
    aiLog("distress", "called a doctor", {
      source,
      metadata: { jobs, ...coordsOf(source) },
    });
    return { ok: true, seconds };
  },
  { lock: true, rate: { count: 2, windowMs: 5000 } },
);
