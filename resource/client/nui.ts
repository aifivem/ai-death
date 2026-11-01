import { loadLocaleTexts } from "@aicore-fivem/lib/client";
import { NUI_LAYER } from "@aicore-fivem/shared";
import type { NuiMessage } from "common/death";

// Stacking among NUI pages (`NUI_LAYER`): set at start, not left to load order.
SetNuiZindex(NUI_LAYER.death);

export const texts = loadLocaleTexts();
export const send = (m: NuiMessage): void => SendNUIMessage(m);
