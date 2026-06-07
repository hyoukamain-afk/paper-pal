// WORKING LOCAL DEV: Lovable TanStack config only — do NOT add @cloudflare/vite-plugin here.
// (That plugin spun up workerd, took 2+ min, and never bound port 8080 in our logs.)
// Cloudflare deploy: `npm run build` uses nitro below. Local API uses in-memory storage via getStorage().
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  nitro: true,
  tanstackStart: {
    server: { entry: "server" },
  },
});
