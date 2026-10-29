import { useEffect, useState } from "react";
import { useNuiEvent } from "fivem-nui-react";
import type { NuiMessage } from "../../resource/common/death";
import { MOCK_DOWN } from "./dev/mock";
import { setTexts, useLang } from "./lib/lang";

type Down = Extract<NuiMessage, { action: "down" }>["data"];
const DOWN_MOCK = { mockData: MOCK_DOWN, mockDelay: 100 };
const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** While down: a dark vignette, the state, the countdown to respawn (client clock), then the respawn hint. */
export function App() {
  const t = useLang();
  const [down, setDown] = useState<Down | null>(null);
  const [now, setNow] = useState(Date.now());

  useNuiEvent<Down>(
    "down",
    (d) => {
      setTexts(d.texts);
      setDown(d);
    },
    DOWN_MOCK,
  );
  useNuiEvent("up", () => setDown(null));

  // One tick a second only while down and counting.
  useEffect(() => {
    if (!down || now >= down.until) return;
    const timer = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(timer);
  }, [down, now]);

  if (!down) return null;
  const left = down.until - now;
  return (
    <div className="pointer-events-none fixed inset-0 flex animate-fade flex-col items-center justify-end gap-[1.2vh] pb-[16vh] [background:radial-gradient(ellipse_at_center,transparent_40%,rgba(80,0,0,0.45)_100%)]">
      <span className="text-[1.2vh] uppercase tracking-[0.3em] text-danger">{t("UI_DOWN_CAPTION")}</span>
      <h1 className="text-[3.2vh] font-semibold text-text [text-shadow:0_0.2vh_0.8vh_rgba(0,0,0,0.7)]">{t("UI_DOWN_TITLE")}</h1>
      <p className="text-[1.5vh] text-text-2 [text-shadow:0_0.1vh_0.4vh_rgba(0,0,0,0.7)]">{left > 0 ? t("UI_DOWN_WAIT", mmss(left)) : t("UI_DOWN_READY")}</p>
    </div>
  );
}
