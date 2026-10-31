import en from "../../../locales/en.json";

/**
 * Browser preview only (`bun run webdev`): down with 90 s left, 2 free medics (`?ready=1`: the timer already ended,
 * `?called=1`: a doctor was called, 45 s until the next call, `?medics=0`: none free).
 */
const query = new URLSearchParams(window.location.search);
const ready = query.get("ready") !== null;
const called = query.get("called") !== null;
export const MOCK_DOWN = {
  texts: en,
  until: Date.now() + (ready ? 0 : 90_000),
  medics: Number(query.get("medics") ?? 2),
  callKey: "G",
  callUntil: called ? Date.now() + 45_000 : 0,
};
