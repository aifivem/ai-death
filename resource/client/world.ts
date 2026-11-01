import { AdminWorld } from "@aicore-fivem/lib/client";
import { readSettings } from "common/death";

export const world = new AdminWorld(["settings", "hospitals"]);
export const settings = world.view("settings", readSettings);
