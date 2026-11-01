import {
  cache,
  controls,
  every,
  onStop,
  player,
  requestAnimDict,
} from "@aicore-fivem/lib/client";
import { pickRandom, waitFor } from "@aicore-fivem/lib/shared";

const DEAD_DICT = "dead";
const DEAD_CLIPS = [
  "dead_a",
  "dead_b",
  "dead_c",
  "dead_d",
  "dead_e",
  "dead_f",
  "dead_g",
  "dead_h",
];
const CAR_DICT = "veh@low@front_ps@idle_duck";
const CAR_CLIP = "sit";
const GET_UP_DICT = "get_up@directional@movement@from_knees@action";
const GET_UP_CLIP = "getup_r_0";
/** What a downed player keeps: camera look, chat, push to talk, the pause menu. */
const KEEP = [1, 2, 245, 249, 199, 200];
const LOOP = 1;

/**
 * A downed player lies in a death animation: a dead ped plays no animation, so once it stops moving it is brought
 * back alive in place, made invincible and posed (the down state lives in the server's `dead` bag). Carried players
 * are left alone, in water the ped floats as a ragdoll, in a vehicle it slumps in its seat.
 */
class DeadPose {
  private active = false;
  private clip = DEAD_CLIPS[0] ?? "dead_a";
  private wasAttached = false;
  private readonly job = every(200, () => this.hold(), {
    active: false,
    name: "deadPose",
  });

  async start(): Promise<void> {
    if (this.active) return;
    this.active = true;
    this.clip = pickRandom(DEAD_CLIPS) ?? this.clip;
    controls.disableAll("death", KEEP);
    const vehicle = cache.vehicle;
    const seat = cache.seat;
    await Promise.all([requestAnimDict(DEAD_DICT), requestAnimDict(CAR_DICT)]);
    // Let the body fall and roll first; a resurrect mid-air would stand it up there.
    await waitFor(
      () => GetEntitySpeed(cache.ped) < 0.5 || undefined,
      4000,
      100,
    ).catch(() => undefined);
    if (!this.active) return;
    const ped = cache.ped;
    if (IsEntityDead(ped)) {
      const [x = 0, y = 0, z = 0] = GetEntityCoords(ped, false);
      NetworkResurrectLocalPlayer(x, y, z, GetEntityHeading(ped), 0, false);
    }
    // A resurrect can give the player a new ped before the cache follows.
    const alive = PlayerPedId();
    SetEntityInvincible(alive, true);
    SetEntityHealth(alive, GetEntityMaxHealth(alive));
    if (vehicle !== false && seat !== false)
      SetPedIntoVehicle(alive, vehicle, seat);
    this.job.set(true);
    this.hold();
  }

  /** Back to normal: `getUp` plays the stand-up animation (a revive in place, not a hospital). */
  stop(getUp: boolean): void {
    if (!this.active) return;
    this.active = false;
    this.job.set(false);
    controls.enable("death");
    const ped = PlayerPedId();
    SetEntityInvincible(ped, false);
    const vehicle = cache.vehicle;
    const seat = cache.seat;
    ClearPedTasksImmediately(ped);
    if (vehicle !== false && seat !== false)
      SetPedIntoVehicle(ped, vehicle, seat);
    else if (getUp) void player.playAnim(GET_UP_DICT, GET_UP_CLIP, { flag: 0 });
  }

  private hold(): void {
    const ped = PlayerPedId();
    const max = GetEntityMaxHealth(ped);
    if (GetEntityHealth(ped) < max) SetEntityHealth(ped, max);
    // Carried: the carrier's animation holds the body.
    if (IsEntityAttached(ped) && cache.vehicle === false)
      return void (this.wasAttached = true);
    if (IsEntityInWater(ped))
      return void SetPedToRagdoll(ped, 3000, 3000, 3, false, false, false);
    if (cache.vehicle !== false) {
      this.wasAttached = false;
      if (!IsEntityPlayingAnim(ped, CAR_DICT, CAR_CLIP, 3))
        TaskPlayAnim(
          ped,
          CAR_DICT,
          CAR_CLIP,
          8,
          -8,
          -1,
          LOOP,
          0,
          false,
          false,
          false,
        );
      return;
    }
    if (GetEntitySpeed(ped) > 0.5 || GetEntityHeightAboveGround(ped) > 2)
      return;
    // Just let go from a carry, the engine still counts the old looping task as playing.
    if (!this.wasAttached && IsEntityPlayingAnim(ped, DEAD_DICT, this.clip, 3))
      return;
    this.wasAttached = false;
    const [x = 0, y = 0, z = 0] = GetEntityCoords(ped, false);
    SetEntityCoords(ped, x, y, z - 1, false, false, false, true);
    ClearPedTasksImmediately(ped);
    TaskPlayAnim(
      ped,
      DEAD_DICT,
      this.clip,
      1,
      1,
      -1,
      LOOP,
      0,
      false,
      false,
      false,
    );
  }

  /** A restart while down must not leave an invincible, posed ped behind. */
  release(): void {
    if (this.active) this.stop(false);
  }
}

export const pose = new DeadPose();
onStop(() => pose.release());
