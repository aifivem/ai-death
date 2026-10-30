import en from "../../../locales/en.json";

/** Browser preview only (`bun run webdev`): down with 90 s left (`?ready=1`: the timer already ended). */
const ready = new URLSearchParams(window.location.search).get("ready") !== null;
export const MOCK_DOWN = {
  texts: en,
  until: Date.now() + (ready ? 0 : 90_000),
};
