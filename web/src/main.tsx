import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { isEnvBrowser } from "fivem-nui-react";
import { App } from "./App";
import "./index.css";

// Browser preview only: a game-like backdrop (the page is transparent in game).
if (isEnvBrowser()) document.body.style.background = "linear-gradient(135deg, #2b3440 0%, #11161c 100%)";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
