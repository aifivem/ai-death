import { onPromptPressed, onServerEvent } from "@aicore-fivem/lib/client";
import { readFinite } from "@aicore-fivem/lib/shared";
import { EVENTS } from "common/death";
import { death, RESPAWN_PROMPT } from "./death";
import { toPoint, type Point } from "./point";

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

// The respawn prompt is not at a place, so it stays a bare prompt.
onPromptPressed((id) => {
  if (id === RESPAWN_PROMPT) void death.respawn();
});

// QB scripts and admin menus revive with this client event; only the server may send it.
onServerEvent("hospital:client:Revive", () => death.revive(null));
