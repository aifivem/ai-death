import { AdminPanel } from "@aicore-fivem/lib/server";
import { readHospital, readSettings } from "common/death";
import { deathSchema } from "./schema";

const panel = new AdminPanel(deathSchema);
/** Panel content, kept current by the panel. */
export const settings = panel.view("settings", readSettings);
export const hospitals = panel.records("hospitals", readHospital);
