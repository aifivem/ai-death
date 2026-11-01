import { onCache } from "@aicore-fivem/lib/client";
import { settings, world } from "./world";

// GTA refills health slowly by itself; the panel decides. The multiplier resets with every ped change (clothing scripts).
const applyRegen = () =>
  SetPlayerHealthRechargeMultiplier(
    PlayerId(),
    settings.value.healthRegen ? 1.0 : 0.0,
  );
applyRegen();
onCache("ped", applyRegen);
world.onChange("settings", applyRegen);
