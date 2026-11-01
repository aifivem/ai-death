import {
  AdminPanel,
  aiLog,
  aiLogChannels,
  billing,
  coordsOf,
  ems,
  inventory,
  isNear,
  KeyedCooldowns,
  notify,
  onCharacter,
  onClientCallback,
  online,
  PlayerMap,
  playersNear,
  PlayerState,
  provideExport,
  registerExport,
  resourceExport,
  stateBoolean,
} from "@aicore-fivem/lib/server";
import { fail, nearestOf, oneArg, readText } from "@aicore-fivem/lib/shared";
import { CORE, PLAYER_BAGS, type DeathInfo } from "@aicore-fivem/shared";
import { Locale } from "common";
import {
  DEAD_META,
  EVENTS,
  readHospital,
  readSettings,
  type Hospital,
} from "common/death";
import { deathSchema } from "./schema";

const deadState = new PlayerState(PLAYER_BAGS.dead, stateBoolean);

const core = resourceExport("ai-core");
const panel = new AdminPanel(deathSchema);
/** Panel content, kept current by the panel. */
const settings = panel.view("settings", readSettings);
const hospitals = panel.records("hospitals", readHospital);
aiLogChannels({ deaths: {}, revives: {}, distress: {} });

/** Doctor calls by character id (a reconnect keeps the cooldown). */
const calls = new KeyedCooldowns<number>();
/** Whole seconds until the player's character may call a doctor again. */
function callLeft(source: number): number {
  const charId = online.charId(source);
  return charId === undefined ? 0 : Math.ceil(calls.left(charId) / 1000);
}

/**
 * Who is down and since when (server clock). The state also lives in ai-core's metadata (`isdead`) so a character
 * that leaves while down comes back down, and in the player's `dead` state bag for other scripts.
 */
class Downed {
  private readonly since = new PlayerMap<number>();

  isDown(source: number): boolean {
    return this.since.has(source);
  }

  down(source: number, at = Date.now()): void {
    this.since.set(source, at);
    core.SetMeta(source, DEAD_META, true);
    deadState.set(source, true);
    const left = Math.max(
      0,
      settings.value.respawnSeconds - Math.floor((Date.now() - at) / 1000),
    );
    emitNet(EVENTS.down, source, left, emsAvailable(), callLeft(source));
  }

  up(source: number, point: Hospital["respawn"] | null): void {
    this.since.delete(source);
    core.SetMeta(source, DEAD_META, false);
    deadState.set(source, false);
    emitNet(EVENTS.revive, source, point);
  }

  timerDone(source: number): boolean {
    const at = this.since.get(source);
    return (
      at !== undefined &&
      Date.now() - at >= settings.value.respawnSeconds * 1000 - 1000
    );
  }

  drop(source: number): void {
    this.since.delete(source);
  }
}

const downed = new Downed();

/** The hospital whose wake-up spot is nearest on the map (height ignored). */
function nearestHospital(source: number): Hospital | undefined {
  const p = coordsOf(source);
  return nearestOf(hospitals.values(), p, (h) => ({ ...h.respawn, z: p.z }));
}

/** Medics free to take a call: an EMS script's own count (busy ones left out), else ai-core's duty counts. */
const emsAvailable = (): number => ems.available(settings.value.emsJobs);
const isEms = (source: number): boolean =>
  online.onDutyIn(source, settings.value.emsJobs);

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

// A character stored down comes back down (also the players already in the game after a restart of this resource).
onCharacter({
  loaded: (source) => {
    if (core.GetMeta(source, DEAD_META) === true)
      setTimeout(() => downed.down(source), 2000);
  },
  unloaded: (source) => downed.drop(source),
});

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
