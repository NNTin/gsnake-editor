import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST })],
  test: {
    environment: "jsdom",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "json", "html", "lcov"],
      reportsDirectory: "coverage",
      all: true,
      include: ["server.ts", "src/**/*.ts"],
      exclude: ["src/tests/**", "**/*.test.ts", "**/*.d.ts"],
      thresholds: {
        lines: 80,
        statements: 60,
        functions: 75,
        branches: 40,
      },
    },
  },
  resolve: {
    conditions: ["browser"],
  },
});
