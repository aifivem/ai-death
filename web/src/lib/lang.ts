import { useSyncExternalStore } from "react";

/** Lang texts the client sends with the screen (this resource's locales, merged for the server language). */
let texts: Record<string, string> = {};
const listeners = new Set<() => void>();

export function setTexts(next: Record<string, string>): void {
  texts = next;
  for (const listener of listeners) listener();
}

/** The text of `key` with `{0}`, `{1}`... filled in; the key itself when it is missing. */
export function translate(key: string, ...args: Array<string | number>): string {
  return (texts[key] ?? key).replace(/\{(\d+)\}/g, (match, index: string) => {
    const value = args[Number(index)];
    return value === undefined ? match : String(value);
  });
}

/** Re-renders the component when the texts change and returns `translate`. */
export function useLang(): typeof translate {
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => texts,
  );
  return translate;
}
