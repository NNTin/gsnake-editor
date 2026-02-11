import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 3003,
    strictPort: true,
    fs: {
      allow: [".", "../gsnake-web/packages/gsnake-web-ui", "./vendor/gsnake-web-ui"],
    },
  },
});
