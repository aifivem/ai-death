import type { PanelSchema } from "@aicore-fivem/shared";
import { hospitalsFile, hospitalsTab } from "./hospitals";
import { settingsFile, settingsTab } from "./settings";

/** ai-death's panel: respawn rules, treatment, medics and the hospitals. */
export const deathSchema: PanelSchema = {
  title: "ADMIN_TITLE",
  icon: "heart-pulse",
  files: {
    settings: settingsFile,
    hospitals: hospitalsFile,
  },
  tabs: [settingsTab, hospitalsTab],
};
