import { AdminWorld, cache, hidePrompt, loadLocaleTexts, notify, onPromptPressed, onServerEvent, showPrompt, triggerServerCallback, Zones } from "@aicore-fivem/lib/client";
import { Locale } from "common";
import { EVENTS, readHospitals, readSettings, type NuiMessage } from "common/death";

const world = new AdminWorld(["settings", "hospitals"]);
const texts = loadLocaleTexts();
const BLIP_TEXT = "AIDEATH_BLIP";
AddTextEntry(BLIP_TEXT, "~a~");
const send = (m: NuiMessage): void => SendNUIMessage(m);
const RESPAWN_PROMPT = "respawn";
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const errorText = (v: unknown, fallback: string): string => {
  const key = isObj(v) && typeof v.error === "string" ? v.error : fallback;
  return texts[key] ?? key;
};

/**
 * The player's own death: a 500 ms check reports the death once; while down the ped stays dead (the game blocks
 * control), the screen shows the countdown and, when it ends, ai-core's prompt offers the hospital.
 */
class Death {
  private reported = false;
  private down = false;
  private respawnTimer: ReturnType<typeof setTimeout> | null = null;

  watch(): void {
    if (this.reported || !IsEntityDead(cache.ped)) return;
    this.reported = true;
    emitNet(EVENTS.died);
  }

  setDown(seconds: number): void {
    this.down = true;
    this.reported = true;
    // A character loaded while down (reconnect) has a living ped: put it down again.
    if (!IsEntityDead(cache.ped)) SetEntityHealth(cache.ped, 0);
    send({ action: "down", data: { texts, until: Date.now() + seconds * 1000 } });
    if (this.respawnTimer) clearTimeout(this.respawnTimer);
    this.respawnTimer = setTimeout(() => {
      if (this.down) showPrompt(RESPAWN_PROMPT, Locale("DEATH_PROMPT_RESPAWN", readSettings(world.get("settings")).respawnFee));
    }, seconds * 1000);
  }

  revive(point: { x: number; y: number; z: number; heading: number } | null): void {
    const ped = cache.ped;
    const [x = 0, y = 0, z = 0] = GetEntityCoords(ped, false);
    const at = point ?? { x, y, z, heading: GetEntityHeading(ped) };
    if (IsEntityDead(ped) || point) {
      DoScreenFadeOut(300);
      setTimeout(() => {
        NetworkResurrectLocalPlayer(at.x, at.y, at.z, at.heading, 0, false);
        DoScreenFadeIn(600);
        this.heal();
      }, 350);
    } else this.heal();
    this.down = false;
    this.reported = false;
    if (this.respawnTimer) clearTimeout(this.respawnTimer);
    hidePrompt(RESPAWN_PROMPT);
    send({ action: "up", data: null });
  }

  private heal(): void {
    const ped = PlayerPedId();
    SetEntityHealth(ped, GetEntityMaxHealth(ped));
    ClearPedBloodDamage(ped);
  }

  async respawn(): Promise<void> {
    const result: unknown = await triggerServerCallback(EVENTS.respawn).catch(() => null);
    if (!(isObj(result) && result.ok === true)) notify(errorText(result, "DEATH_ERR_WAIT"), "error");
  }
}

const death = new Death();
setInterval(() => death.watch(), 500);

onServerEvent(EVENTS.down, { args: ([seconds]) => (typeof seconds === "number" ? [seconds] : null) }, (seconds) => death.setDown(seconds));
type Point = { x: number; y: number; z: number; heading: number };
/** null = revive in place; undefined = not a valid answer. */
function toPoint(p: unknown): Point | null | undefined {
  if (p === null || p === undefined) return null;
  return isObj(p) && typeof p.x === "number" && typeof p.y === "number" && typeof p.z === "number" ? { x: p.x, y: p.y, z: p.z, heading: typeof p.heading === "number" ? p.heading : 0 } : undefined;
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

/** Hospitals: blips and a check-in zone each with ai-core's prompt (paid treatment). */
class Hospitals {
  private readonly zones = new Zones();
  private blips: number[] = [];

  rebuild(): void {
    this.zones.clear();
    for (const blip of this.blips) RemoveBlip(blip);
    this.blips = [];
    const price = readSettings(world.get("settings")).treatPrice;
    for (const h of readHospitals(world.get("hospitals")).values()) {
      const id = `checkin:${h.id}`;
      this.zones.add(id, {
        shape: { type: "sphere", center: h.checkin, radius: 2 },
        interval: 500,
        onEnter: () => showPrompt(id, Locale("DEATH_PROMPT_TREAT", price)),
        onExit: () => hidePrompt(id),
      });
      if (!h.blip) continue;
      const blip = AddBlipForCoord(h.respawn.x, h.respawn.y, h.respawn.z);
      SetBlipSprite(blip, 61);
      SetBlipColour(blip, 1);
      SetBlipScale(blip, 0.7);
      SetBlipAsShortRange(blip, true);
      BeginTextCommandSetBlipName(BLIP_TEXT);
      AddTextComponentSubstringPlayerName(h.label);
      EndTextCommandSetBlipName(blip);
      this.blips.push(blip);
    }
  }
}

const hospitals = new Hospitals();
hospitals.rebuild();
world.onChange("hospitals", () => hospitals.rebuild());
world.onChange("settings", () => hospitals.rebuild());

onPromptPressed((id) => {
  if (id === RESPAWN_PROMPT) void death.respawn();
  else if (id.startsWith("checkin:")) {
    void triggerServerCallback(EVENTS.treat, [id.slice("checkin:".length)])
      .catch(() => null)
      .then((r) => (isObj(r) && r.ok === true ? notify(Locale("DEATH_TREATED"), "success") : notify(errorText(r, "DEATH_ERR_FAR"), "error")));
  }
});

// QB scripts and admin menus revive with this client event; only the server may send it.
onServerEvent("hospital:client:Revive", () => death.revive(null));
