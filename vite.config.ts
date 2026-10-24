// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

import { coresAntigas } from "./plugins/coresAntigas";
import { semFonteNo3d } from "./plugins/semFonteNo3d";

export default defineConfig({
  // Cores de reserva para navegador antigo (Chrome < 111, WebView desatualizado): ver plugins/coresAntigas.ts
  // semFonteNo3d: só no servidor de desenvolvimento, ver plugins/semFonteNo3d.ts
  vite: { plugins: [coresAntigas(), semFonteNo3d()] },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
