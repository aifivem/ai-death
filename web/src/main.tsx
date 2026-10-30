import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { isEnvBrowser } from "fivem-nui-react"
import { config } from "@fortawesome/fontawesome-svg-core"
import { App } from "./App"
import "./index.css"

// The svg-core CSS is imported in @layer base (index.css); injected unlayered it would beat the size utilities.
config.autoAddCss = false

// Browser preview only: a game-like backdrop (the page is transparent in game).
if (isEnvBrowser())
  document.body.style.background =
    "linear-gradient(135deg, #2b3440 0%, #11161c 100%)"

const root = document.getElementById("root")
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}
