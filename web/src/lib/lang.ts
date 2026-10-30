import { LangTexts } from "@aicore-fivem/lib/shared";
import { useSyncExternalStore } from "react";

/** Lang texts the client sends with the screen (this resource's locales, merged for the server language). */
const lang = new LangTexts();

export const setTexts = lang.set;

/** The text of `key` with `{0}`, `{1}`... filled in; the key itself when it is missing. */
export const translate = lang.translate;

/** Re-renders the component when the texts change and returns `translate`. */
export function useLang(): typeof translate {
  useSyncExternalStore(lang.subscribe, lang.snapshot);
  return translate;
}
