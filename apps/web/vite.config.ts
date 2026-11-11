import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// REALITYPROOF_WEB_EDITION=public builds an edition without AG Studio: the Studio workspace import is
// replaced by a notice, so no AG Studio, AG Grid or AG Charts code ends up in the bundle.
const publicEdition = process.env.REALITYPROOF_WEB_EDITION === "public";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: publicEdition
      ? [
          {
            find: /^\.\/features\/intelligence-studio\/IntelligenceStudioWorkspace\.js$/,
            replacement: fileURLToPath(new URL("./src/features/public-edition/StudioUnavailable.tsx", import.meta.url)),
          },
        ]
      : [],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
