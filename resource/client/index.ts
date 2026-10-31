import {
  AdminWorld,
  Blips,
  cache,
  callAction,
  fadeIn,
  fadeOut,
  hidePrompt,
  Keybind,
  loadLocaleTexts,
  notify,
  onCache,
  onPromptPressed,
  onServerEvent,
  player,
  Points,
  showPrompt,
} from "@aicore-fivem/lib/client";
import { isRecord, readFinite, RecordObjects } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import {
  EVENTS,
  readHospital,
  readSettings,
  type NuiMessage,
} from "common/death";
import { pose } from "./pose";
import { NUI_LAYER } from "@aicore-fivem/shared";

// Stacking among NUI pages (`NUI_LAYER`): set at start, not left to load order.
SetNuiZindex(NUI_LAYER.death);

const world = new AdminWorld(["settings", "hospitals"]);
const settings = world.view("settings", readSettings);
const texts = loadLocaleTexts();
const send = (m: NuiMessage): void => SendNUIMessage(m);
const RESPAWN_PROMPT = "respawn";

/**
 * The player's own death: the server sees it (FXServer's `onPedDeath`); while down the ped lies in a death animation
 * (`pose.ts`), the screen shows the countdown and, when it ends, ai-core's prompt offers the hospital.
 */
class Death {
  private down = false;
  private respawnTimer: ReturnType<typeof setTimeout> | null = null;
  /** When the next doctor call opens (client clock); a call in flight blocks a second one. */
  private callUntil = 0;
  private calling = false;

  setDown(seconds: number, medics: number, callSeconds: number): void {
    this.down = true;
    this.callUntil = callSeconds > 0 ? Date.now() + callSeconds * 1000 : 0;
    // Also a character loaded while down (reconnect), whose ped is alive.
    void pose.start();
    send({
      action: "down",
      data: {
        texts,
        until: Date.now() + seconds * 1000,
        medics,
        callKey: callKey.currentKey,
        callUntil: this.callUntil,
      },
    });
    if (this.respawnTimer) clearTimeout(this.respawnTimer);
    this.respawnTimer = setTimeout(() => {
      if (this.down)
        showPrompt(
          RESPAWN_PROMPT,
          Locale("DEATH_PROMPT_RESPAWN", settings.value.respawnFee),
        );
    }, seconds * 1000);
  }

  revive(
    point: { x: number; y: number; z: number; heading: number } | null,
  ): void {
    // Still truly dead: the pose had not taken over yet.
    const dead = IsEntityDead(cache.ped);
    pose.stop(!point && !dead);
    if (dead || point) void this.resurrect(point);
    else this.heal();
    this.down = false;
    if (this.respawnTimer) clearTimeout(this.respawnTimer);
    hidePrompt(RESPAWN_PROMPT);
    send({ action: "up", data: null });
  }

  /** Behind a fade: up in place, then (hospital) to the point with its collision loaded, then the fade clears. */
  private async resurrect(
    point: { x: number; y: number; z: number; heading: number } | null,
  ): Promise<void> {
    const here = player.coords();
    await fadeOut();
    NetworkResurrectLocalPlayer(
      here.x,
      here.y,
      here.z,
      player.heading(),
      0,
      false,
    );
    this.heal();
    if (point)
      await player.teleport(point, { heading: point.heading, fade: false });
    await fadeIn(600);
  }

  private heal(): void {
    // Fresh read: a resurrect can give the player a new ped before the cache follows.
    const ped = PlayerPedId();
    SetEntityHealth(ped, GetEntityMaxHealth(ped));
    ClearPedBloodDamage(ped);
  }

  async respawn(): Promise<void> {
    await callAction(EVENTS.respawn, [], { fallback: "DEATH_ERR_WAIT" });
  }

  /** Calls a doctor (the server checks the down state and the cooldown); the screen counts down to the next call. */
  async callDoctor(): Promise<void> {
    if (!this.down || this.calling || Date.now() < this.callUntil) return;
    this.calling = true;
    const reply = await callAction(EVENTS.distress, [], {
      fallback: "DEATH_ERR_DISTRESS",
    });
    this.calling = false;
    if (!reply || !this.down) return;
    this.callUntil = Date.now() + (readFinite(reply.seconds) ?? 0) * 1000;
    send({ action: "called", data: { until: this.callUntil } });
  }
}

const death = new Death();

// Down screen's doctor call; the key only acts while down (the screen shows the bound key).
const callKey = new Keybind({
  name: "death_distress",
  description: Locale("KEYBIND_DISTRESS"),
  defaultKey: "G",
  onPressed: () => void death.callDoctor(),
});

onServerEvent(
  EVENTS.down,
  {
    args: ([seconds, medics, call]): [number, number, number] | null => {
      const left = readFinite(seconds);
      return left === null
        ? null
        : [left, readFinite(medics) ?? 0, readFinite(call) ?? 0];
    },
  },
  (seconds, medics, call) => death.setDown(seconds, medics, call),
);
type Point = { x: number; y: number; z: number; heading: number };
/** null = revive in place; undefined = not a valid answer. */
function toPoint(p: unknown): Point | null | undefined {
  if (p === null || p === undefined) return null;
  if (!isRecord(p)) return undefined;
  const [x, y, z] = [readFinite(p.x), readFinite(p.y), readFinite(p.z)];
  return x !== null && y !== null && z !== null
    ? { x, y, z, heading: readFinite(p.heading) ?? 0 }
    : undefined;
}
onServerEvent(
  EVENTS.revive,
  {
    args: ([p]): [Point | null] | null => {
      const point = toPoint(p);
      return point === undefined ? null : [point];
    },
  },
  (point) => death.revive(point),
);

async function treat(hospitalId: string): Promise<void> {
  const r = await callAction(EVENTS.treat, [hospitalId], {
    fallback: "DEATH_ERR_FAR",
  });
  if (r) notify(Locale("DEATH_TREATED"), "success");
}

/** Hospitals: a blip at the wake-up spot and a check-in point each (paid treatment); an edit rebuilds only its own. */
const points = new Points();
const blips = new Blips();
const hospitals = new RecordObjects(
  world,
  "hospitals",
  readHospital,
  (id, h) => {
    points.add(`checkin:${id}`, {
      coords: h.checkin,
      label: Locale("DEATH_PROMPT_TREAT", settings.value.treatPrice),
      icon: "kit-medical",
      onPressed: () => treat(id),
    });
    if (h.blip)
      blips.add(id, {
        coords: h.respawn,
        label: h.label,
        ...h.blipStyle,
      });
    return () => {
      points.remove(`checkin:${id}`);
      blips.remove(id);
    };
  },
);
// The treatment price in every check-in label is a setting.
world.onChange("settings", () => hospitals.rebuildAll());

// The respawn prompt is not at a place, so it stays a bare prompt.
onPromptPressed((id) => {
  if (id === RESPAWN_PROMPT) void death.respawn();
});

// QB scripts and admin menus revive with this client event; only the server may send it.
onServerEvent("hospital:client:Revive", () => death.revive(null));

// GTA refills health slowly by itself; the panel decides. The multiplier resets with every ped change (clothing scripts).
const applyRegen = () =>
  SetPlayerHealthRechargeMultiplier(
    PlayerId(),
    settings.value.healthRegen ? 1.0 : 0.0,
  );
applyRegen();
onCache("ped", applyRegen);
world.onChange("settings", applyRegen);
