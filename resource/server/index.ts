import {
  AdminPanel,
  aiLog,
  aiLogChannels,
  GlobalKey,
  inventory,
  notify,
  onClientCallback,
  onClientEvent,
  playersNear,
  PlayerState,
  provideExport,
  registerExport,
  resourceExport,
  stateBoolean,
} from "@aicore-fivem/lib/server";
import {
  CORE,
  PED_DEATH_STATE_KEY,
  PLAYER_BAGS,
  type CharacterInfo,
} from "@aicore-fivem/shared";
import { Locale } from "common";
import {
  DEAD_META,
  EVENTS,
  readHospitals,
  readSettings,
  type Hospital,
} from "common/death";
import { deathSchema } from "./schema";

const serverDeaths = new GlobalKey(PED_DEATH_STATE_KEY, stateBoolean);
const deadState = new PlayerState(PLAYER_BAGS.dead, stateBoolean);

const core = resourceExport("ai-core");
const panel = new AdminPanel(deathSchema);
/** Panel content, parsed again after every change. */
const content = {
  settings: readSettings(panel.get("settings")),
  hospitals: readHospitals(panel.get("hospitals")),
};
panel.onChange(
  "settings",
  () => (content.settings = readSettings(panel.get("settings"))),
);
panel.onChange(
  "hospitals",
  () => (content.hospitals = readHospitals(panel.get("hospitals"))),
);
aiLogChannels({ deaths: {}, revives: {} });

const fail = (error: string) => ({ ok: false as const, error });
const pos = (source: number) => {
  const [x = 0, y = 0, z = 0] = GetEntityCoords(GetPlayerPed(String(source)));
  return { x, y, z };
};

/**
 * Who is down and since when (server clock). The state also lives in ai-core's metadata (`isdead`) so a character
 * that leaves while down comes back down, and in the player's `dead` state bag for other scripts.
 */
class Downed {
  private readonly since = new Map<number, number>();

  isDown(source: number): boolean {
    return this.since.has(source);
  }

  down(source: number, at = Date.now()): void {
    this.since.set(source, at);
    core.SetMeta(source, DEAD_META, true);
    deadState.set(source, true);
    const left = Math.max(
      0,
      content.settings.respawnSeconds - Math.floor((Date.now() - at) / 1000),
    );
    emitNet(EVENTS.down, source, left);
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
      Date.now() - at >= content.settings.respawnSeconds * 1000 - 1000
    );
  }

  drop(source: number): void {
    this.since.delete(source);
  }
}

const downed = new Downed();

function nearestHospital(source: number): Hospital | undefined {
  const p = pos(source);
  let best: Hospital | undefined;
  let bestDistance = Infinity;
  for (const h of content.hospitals.values()) {
    const d = Math.hypot(p.x - h.respawn.x, p.y - h.respawn.y);
    if (d < bestDistance) [best, bestDistance] = [h, d];
  }
  return best;
}

const emsOnDuty = (): number =>
  content.settings.emsJobs.reduce((n, job) => n + core.GetOnDutyCount(job), 0);
const isEms = (source: number): boolean => {
  const duty = core.GetDutyJob(source);
  return duty !== null && content.settings.emsJobs.includes(duty);
};

function wentDown(source: number, killer: number | null = null): void {
  if (downed.isDown(source) || !core.GetCharacter(source)) return;
  downed.down(source);
  aiLog("deaths", "went down", {
    source,
    target: killer ?? undefined,
    metadata: pos(source),
  });
}

// FXServer 38039+ reports the death from the synced health itself (ai-core's playerDied); older builds rely on the
// client's report, checked against the synced health so a client cannot claim a death that did not happen.
on(CORE.playerDiedEvent, (source: number, killer: number | null) =>
  wentDown(source, killer),
);
onClientEvent(EVENTS.died, (source) => {
  if (
    serverDeaths.get() === true ||
    GetEntityHealth(GetPlayerPed(String(source))) > 0
  )
    return;
  wentDown(source);
});

onClientCallback(
  EVENTS.respawn,
  (source) => {
    if (!downed.isDown(source)) return fail("DEATH_ERR_ALIVE");
    if (!downed.timerDone(source)) return fail("DEATH_ERR_WAIT");
    const hospital = nearestHospital(source);
    if (!hospital) return fail("DEATH_ERR_NO_HOSPITAL");
    const fee = content.settings.respawnFee;
    // A fee nobody can pay is waived: nobody stays dead for being broke.
    if (fee > 0)
      content.settings.accounts.some((a) =>
        core.RemoveMoney(source, a, fee, "hospital"),
      );
    if (content.settings.clearInventory) inventory.clearInventory(source);
    downed.up(source, hospital.respawn);
    return { ok: true };
  },
  { lock: true },
);

onClientCallback(
  EVENTS.treat,
  { args: ([id]) => (typeof id === "string" ? [id] : null), lock: true },
  (source, id) => {
    const hospital = content.hospitals.get(id);
    const p = pos(source);
    if (
      !hospital ||
      Math.hypot(
        p.x - hospital.checkin.x,
        p.y - hospital.checkin.y,
        p.z - hospital.checkin.z,
      ) > 3
    )
      return fail("DEATH_ERR_FAR");
    if (emsOnDuty() > content.settings.treatMaxEms)
      return fail("DEATH_ERR_EMS_ONLINE");
    if (
      !content.settings.accounts.some((a) =>
        core.RemoveMoney(
          source,
          a,
          content.settings.treatPrice,
          "hospital:treatment",
        ),
      )
    )
      return fail("DEATH_ERR_MONEY");
    downed.up(source, null);
    return { ok: true };
  },
);

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
      return true;
    }
  }
  emitNet(EVENTS.revive, source, null);
  return true;
}

inventory.registerUsableItem("medikit", (source: number) => useMedikit(source));

on(CORE.playerLoadedEvent, (source: number, _character: CharacterInfo) => {
  if (core.GetMeta(source, DEAD_META) === true)
    setTimeout(() => downed.down(source), 2000);
});
on(CORE.playerUnloadedEvent, (source: number) => downed.drop(source));
on("playerDropped", () => downed.drop(Number(globalThis.source)));

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
