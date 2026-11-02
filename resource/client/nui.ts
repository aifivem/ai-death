import { loadLocaleTexts } from "@aifivem/lib/client";
import { NUI_LAYER } from "@aifivem/shared";
import type { NuiMessage } from "common/death";

// Stacking among NUI pages (`NUI_LAYER`): set at start, not left to load order.
SetNuiZindex(NUI_LAYER.death);

export const texts = loadLocaleTexts();
export const send = (m: NuiMessage): void => SendNUIMessage(m);
