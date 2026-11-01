import { Blips, callAction, notify, Points } from "@aicore-fivem/lib/client";
import { RecordObjects } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS, readHospital } from "common/death";
import { settings, world } from "./world";

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
