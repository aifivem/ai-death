import { PlayerMap, PlayerState, stateBoolean } from "@aicore-fivem/lib/server";
import { PLAYER_BAGS } from "@aicore-fivem/shared";
import { DEAD_META, EVENTS, type Hospital } from "common/death";
import { core } from "./core";
import { callLeft } from "./distress/cooldown";
import { emsAvailable } from "./ems";
import { settings } from "./panel";

const deadState = new PlayerState(PLAYER_BAGS.dead, stateBoolean);

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

export const downed = new Downed();
