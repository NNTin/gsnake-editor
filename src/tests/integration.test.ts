import { describe, expect, it } from "vitest";

const webUrl = import.meta.env.VITE_GSNAKE_WEB_URL || "http://localhost:3000";
const runLiveIntegration = process.env.GSNAKE_EDITOR_LIVE_INTEGRATION === "1";
const integrationTest = runLiveIntegration ? it : it.skip;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    return await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

describe("gsnake-web integration tests", () => {
  integrationTest("serves the gsnake-web app shell at configured URL", async () => {
    const response = await fetchWithTimeout(webUrl);

    expect(response.status).toBeLessThan(400);
    expect(response.headers.get("content-type")).toContain("text/html");

    const html = await response.text();
    expect(html).toContain('<div id="app"></div>');
  });

  integrationTest("keeps test-mode route contract reachable", async () => {
    const response = await fetchWithTimeout(`${webUrl}?test=true`);

    expect(response.status).toBeLessThan(400);
    expect(response.url).toContain("test=true");

    const html = await response.text();
    expect(html).toContain('<div id="app"></div>');
  });
});
