import { useEffect, useState } from "react";
import { useNuiEvent } from "fivem-nui-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faHeartCrack,
  faUserDoctor,
} from "@fortawesome/free-solid-svg-icons";
import type { NuiMessage } from "../../resource/common/death";
import { MOCK_DOWN } from "./dev/mock";
import { setTexts, useLang } from "./lib/lang";

type Down = Extract<NuiMessage, { action: "down" }>["data"];
const DOWN_MOCK = { mockData: MOCK_DOWN, mockDelay: 100 };
const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const PILL =
  "flex h-[3.4vh] items-center rounded-full bg-[rgba(19,19,19,0.75)]";

/**
 * While down: a red vignette, a round icon, the state chip, the display title, the countdown to respawn (client
 * clock), then the free medics (read once when the player went down) and the doctor call key with its cooldown.
 */
export function App() {
  const t = useLang();
  const [down, setDown] = useState<Down | null>(null);
  const [callUntil, setCallUntil] = useState(0);
  const [now, setNow] = useState(Date.now());

  useNuiEvent<Down>(
    "down",
    (d) => {
      setTexts(d.texts);
      setDown(d);
      setCallUntil(d.callUntil);
      setNow(Date.now());
    },
    DOWN_MOCK,
  );
  useNuiEvent<{ until: number }>("called", (d) => {
    setCallUntil(d.until);
    setNow(Date.now());
  });
  useNuiEvent("up", () => setDown(null));

  // One tick a second only while down and something counts down.
  useEffect(() => {
    if (!down || now >= Math.max(down.until, callUntil)) return;
    const timer = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(timer);
  }, [down, callUntil, now]);

  if (!down) return null;
  const left = down.until - now;
  const callLeft = callUntil - now;
  const medics =
    down.medics === 0
      ? t("UI_DOWN_NO_MEDICS")
      : down.medics === 1
        ? t("UI_DOWN_MEDIC")
        : t("UI_DOWN_MEDICS", down.medics);
  return (
    <div className="pointer-events-none fixed inset-0 flex animate-fade flex-col items-center justify-end gap-[1.6vh] pb-[14vh] [background:radial-gradient(ellipse_at_center,transparent_35%,rgba(80,0,0,0.5)_100%)]">
      <span className="flex size-[5.2vh] items-center justify-center rounded-full bg-[#00000099] text-danger">
        <FontAwesomeIcon icon={faHeartCrack} className="text-[2.2vh]" />
      </span>
      <span className="rounded-[0.4vh] bg-danger-bg px-[0.6vh] py-[0.2vh] text-[1.1vh] font-bold text-danger uppercase">
        {t("UI_DOWN_CAPTION")}
      </span>
      <h1 className="font-display text-[4.4vh] leading-none tracking-[-0.01em] text-white uppercase [filter:drop-shadow(0.15vh_0.2vh_0_rgba(0,0,0,0.75))]">
        {t("UI_DOWN_TITLE")}
      </h1>
      <p
        className={`${PILL} px-[1.6vh] text-[1.4vh] text-white/80 tabular-nums`}
      >
        {left > 0 ? t("UI_DOWN_WAIT", mmss(left)) : t("UI_DOWN_READY")}
      </p>
      <div className="flex items-center gap-[0.8vh]">
        <span
          className={`${PILL} gap-[0.8vh] px-[1.4vh] text-[1.3vh] font-medium ${down.medics === 0 ? "text-danger" : "text-white/80"}`}
        >
          <FontAwesomeIcon icon={faUserDoctor} className="text-[1.3vh]" />
          {medics}
        </span>
        {callLeft > 0 ? (
          <span
            key="called"
            className={`${PILL} animate-fade gap-[0.8vh] pr-[1.6vh] pl-[0.4vh] text-[1.3vh] tabular-nums`}
          >
            <span className="flex size-[2.6vh] items-center justify-center rounded-full bg-tgi-green-20 text-tgi-green">
              <FontAwesomeIcon icon={faCheck} className="text-[1.2vh]" />
            </span>
            <span className="font-semibold text-tgi-green">
              {t("UI_DOWN_CALLED")}
            </span>
            <span className="text-white/50">
              {t("UI_DOWN_CALL_AGAIN", mmss(callLeft))}
            </span>
          </span>
        ) : (
          <span
            key="call"
            className={`${PILL} animate-fade gap-[0.8vh] pr-[1.6vh] ${down.callKey ? "pl-[0.4vh]" : "pl-[1.6vh]"} text-[1.3vh] font-medium text-white`}
          >
            {down.callKey && (
              <span className="flex h-[2.6vh] min-w-[2.6vh] items-center justify-center rounded-full bg-tgi-green px-[0.7vh] text-[1.2vh] font-bold text-tgi-green-text">
                {down.callKey}
              </span>
            )}
            {t("UI_DOWN_CALL")}
          </span>
        )}
      </div>
    </div>
  );
}
