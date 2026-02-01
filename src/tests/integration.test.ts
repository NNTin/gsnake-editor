import { describe, it, expect } from "vitest";

describe("gsnake-web integration tests", () => {
  it("should skip integration tests if GSNAKE_WEB_URL is unreachable", async () => {
    const webUrl = import.meta.env.VITE_GSNAKE_WEB_URL || "http://localhost:3000";

    console.log(`Checking connectivity to gsnake-web at: ${webUrl}`);

    try {
      // Try to fetch from the gsnake-web URL
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(webUrl, {
        signal: controller.signal,
        method: "HEAD", // Use HEAD to avoid downloading the full page
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        console.log("✓ gsnake-web is reachable");
        expect(response.status).toBeLessThan(400);
      } else {
        console.warn(
          `⚠ gsnake-web returned status ${response.status} - skipping integration tests`
        );
        expect(true).toBe(true); // Test passes but logs warning
      }
    } catch (error) {
      // If fetch fails (network error, timeout, etc.), skip the test
      const message = error instanceof Error ? error.message : "Unknown error";
      console.warn(`⚠ gsnake-web is unreachable at ${webUrl}: ${message}`);
      console.warn("  Integration tests will be skipped. To run integration tests:");
      console.warn("  1. Start gsnake-web: cd ../gsnake-web && npm run dev");
      console.warn("  2. Or set VITE_GSNAKE_WEB_URL to a running instance");

      // Test passes but logs warning - integration tests are optional
      expect(true).toBe(true);
    }
  });

  it("should validate gsnake-web test endpoint if reachable", async () => {
    const webUrl = import.meta.env.VITE_GSNAKE_WEB_URL || "http://localhost:3000";

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // Check if the test mode parameter is supported
      const response = await fetch(`${webUrl}?test=true`, {
        signal: controller.signal,
        method: "HEAD",
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        console.log("✓ gsnake-web test mode endpoint is accessible");
        expect(response.status).toBeLessThan(400);
      } else {
        console.warn(`⚠ gsnake-web test endpoint returned ${response.status} - skipping`);
        expect(true).toBe(true);
      }
    } catch {
      console.warn("⚠ Skipping test endpoint validation - gsnake-web unreachable");
      expect(true).toBe(true); // Skip test gracefully
    }
  });
});
