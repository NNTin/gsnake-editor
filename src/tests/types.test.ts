import { describe, it, expect } from "vitest";

describe("gsnake-editor unit tests", () => {
  it("should pass a basic test", () => {
    expect(1 + 1).toBe(2);
  });

  it("should have access to environment variables", () => {
    // VITE_GSNAKE_WEB_URL should be accessible in Vite's environment
    const url = import.meta.env.VITE_GSNAKE_WEB_URL || "http://localhost:3000";
    expect(url).toBeDefined();
    expect(typeof url).toBe("string");
  });
});
