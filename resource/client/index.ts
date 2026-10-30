import {
  AdminWorld,
  Blips,
  cache,
  fadeOut,
  GlobalKey,
  hidePrompt,
  loadLocaleTexts,
  notify,
  onPromptPressed,
  onServerEvent,
  player,
  Points,
  showPrompt,
  stateBoolean,
  callAction,
} from "@aicore-fivem/lib/client";
import { isRecord, readFinite } from "@aicore-fivem/lib/shared";
import { PED_DEATH_STATE_KEY } from "@aicore-fivem/shared";
import { Locale } from "common";
import {
  EVENTS,
  readHospital,
  readSettings,
  type NuiMessage,
} from "common/death";

const serverDeaths = new GlobalKey(PED_DEATH_STATE_KEY, stateBoolean);

const world = new AdminWorld(["settings", "hospitals"]);
const settings = world.view("settings", readSettings);
const hospitals = world.records("hospitals", readHospital);
const texts = loadLocaleTexts();
const send = (m: NuiMessage): void => SendNUIMessage(m);
const RESPAWN_PROMPT = "respawn";

/**
 * The player's own death: the server sees it (FXServer 38039+) or a 500 ms check reports it once; while down the ped stays dead (the game blocks
 * control), the screen shows the countdown and, when it ends, ai-core's prompt offers the hospital.
 */
class Death {
  private reported = false;
  private down = false;
  private respawnTimer: ReturnType<typeof setTimeout> | null = null;

  watch(): void {
    // The server reports deaths itself on FXServer 38039+ (ai-core's PED_DEATH_STATE_KEY): nothing to watch then.
    if (
      this.reported ||
      serverDeaths.get() === true ||
      !IsEntityDead(cache.ped)
    )
      return;
    this.reported = true;
    emitNet(EVENTS.died);
  }

  setDown(seconds: number): void {
    this.down = true;
    this.reported = true;
    // A character loaded while down (reconnect) has a living ped: put it down again.
    if (!IsEntityDead(cache.ped)) SetEntityHealth(cache.ped, 0);
    send({
      action: "down",
      data: { texts, until: Date.now() + seconds * 1000 },
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
    const at = point ?? { ...player.coords(), heading: player.heading() };
    if (IsEntityDead(cache.ped) || point) {
      void fadeOut().then(() => {
        NetworkResurrectLocalPlayer(at.x, at.y, at.z, at.heading, 0, false);
        DoScreenFadeIn(600);
        this.heal();
      });
    } else this.heal();
    this.down = false;
    this.reported = false;
    if (this.respawnTimer) clearTimeout(this.respawnTimer);
    hidePrompt(RESPAWN_PROMPT);
    send({ action: "up", data: null });
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
}

const death = new Death();
setInterval(() => death.watch(), 500);

onServerEvent(
  EVENTS.down,
  {
    args: ([seconds]) => {
      const left = readFinite(seconds);
      return left === null ? null : [left];
    },
  },
  (seconds) => death.setDown(seconds),
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

/** Hospitals: a blip at the wake-up spot and a check-in point each (paid treatment). */
const points = new Points();
const blips = new Blips();
function rebuild(): void {
  points.clear();
  blips.clear();
  const price = settings.value.treatPrice;
  for (const h of hospitals.values()) {
    points.add(`checkin:${h.id}`, {
      coords: h.checkin,
      label: Locale("DEATH_PROMPT_TREAT", price),
      icon: "kit-medical",
      onPressed: () => treat(h.id),
    });
    if (h.blip)
      blips.add(h.id, {
        coords: h.respawn,
        label: h.label,
        ...h.blipStyle,
      });
  }
}

rebuild();
world.onChange("hospitals", rebuild);
world.onChange("settings", rebuild);

// The respawn prompt is not at a place, so it stays a bare prompt.
onPromptPressed((id) => {
  if (id === RESPAWN_PROMPT) void death.respawn();
});

// QB scripts and admin menus revive with this client event; only the server may send it.
onServerEvent("hospital:client:Revive", () => death.revive(null));
