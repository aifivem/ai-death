import {
  cache,
  callAction,
  fadeIn,
  fadeOut,
  hidePrompt,
  Keybind,
  player,
  showPrompt,
} from "@aicore-fivem/lib/client";
import { readFinite } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS } from "common/death";
import { send, texts } from "../nui";
import { settings } from "../world";
import { pose } from "./pose";

export const RESPAWN_PROMPT = "respawn";

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

export const death = new Death();

// Down screen's doctor call; the key only acts while down (the screen shows the bound key).
const callKey = new Keybind({
  name: "death_distress",
  description: Locale("KEYBIND_DISTRESS"),
  defaultKey: "G",
  onPressed: () => void death.callDoctor(),
});
