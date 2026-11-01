import {
  aiLog,
  billing,
  inventory,
  notify,
  online,
  playersNear,
} from "@aicore-fivem/lib/server";
import { Locale } from "common";
import { EVENTS } from "common/death";
import { downed } from "./downed";
import { isEms } from "./ems";
import { settings } from "./panel";

/** The revive fee: a bill from the medic's job to the revived player (paid later, never taken). */
function billRevive(medic: number, target: number): void {
  const amount = settings.value.reviveFee;
  const job = online.dutyJob(medic);
  if (amount <= 0 || !job) return;
  const sent = billing.send({
    to: target,
    amount,
    label: Locale("DEATH_BILL_REVIVE"),
    from: medic,
    job,
  });
  aiLog("revives", sent ? "revive billed" : "revive bill refused", {
    source: medic,
    target,
    level: sent ? "info" : "warn",
    metadata: { job, amount },
  });
}

/** The medikit: a medic on duty revives the closest downed player; anyone else heals themselves. */
function useMedikit(source: number): boolean {
  if (isEms(source)) {
    const target = playersNear(source, 3).find(
      (t) => t !== source && downed.isDown(t),
    );
    if (target !== undefined) {
      downed.up(target, null);
      notify(source, Locale("DEATH_REVIVED_OTHER"), "success");
      aiLog("revives", "revived a player", { source, target });
      billRevive(source, target);
      return true;
    }
  }
  emitNet(EVENTS.revive, source, null);
  return true;
}

inventory.registerUsableItem("medikit", (source: number) => useMedikit(source));
