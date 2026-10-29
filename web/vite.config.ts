import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import oklab from "@csstools/postcss-oklab-function";
import colorMix from "@csstools/postcss-color-mix-function";
import colorNotation from "postcss-color-functional-notation";
// @ts-expect-error plain JS postcss plugins shared with the other TGIANN NUIs
import fixEmptyVar from "./postcss-fix-empty-var.js";
// @ts-expect-error plain JS postcss plugins shared with the other TGIANN NUIs
import resolveColorMix from "./postcss-resolve-color-mix.js";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  build: {
    emptyOutDir: true,
    outDir: "../dist/web",
    chunkSizeWarningLimit: 1000,
  },
  server: {
    fs: { allow: [".."] },
  },
  // Old FiveM CEF (Chromium ~103): no oklch, color-mix or @media (hover: hover).
  css: {
    postcss: {
      plugins: [
        oklab({ preserve: false }),
        colorMix({ preserve: false }),
        colorNotation({ preserve: false }),
        resolveColorMix(),
        fixEmptyVar(),
      ],
    },
  },
});
