import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import "@testing-library/jest-dom";
import App from "../App.svelte";
import type { LevelData } from "../lib/types";

async function loadLevelFromLanding(contents: string, filename: string): Promise<void> {
  const originalCreateElement = document.createElement.bind(document);
  let fileInput: HTMLInputElement | null = null;

  const createElementSpy = vi.spyOn(document, "createElement");
  createElementSpy.mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
    const element = originalCreateElement(tagName, options);
    if (tagName.toLowerCase() === "input" && element instanceof HTMLInputElement) {
      fileInput = element;
    }
    return element;
  }) as typeof document.createElement);

  try {
    await fireEvent.click(screen.getByRole("button", { name: /Load Existing Level/i }));

    if (fileInput === null) {
      throw new Error("Expected LandingPage to create a hidden file input");
    }
    const selectedInput = fileInput;
    const fileLike = {
      name: filename,
      async text() {
        return contents;
      },
    } as File;

    Object.defineProperty(selectedInput, "files", {
      value: [fileLike],
      configurable: true,
    });

    await fireEvent.change(selectedInput);
  } finally {
    createElementSpy.mockRestore();
  }
}

describe("App load existing flow", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("accepts a valid level payload and opens the editor", async () => {
    const validPayload: LevelData = {
      id: 123,
      name: "Landing Load Valid",
      gridSize: {
        width: 6,
        height: 5,
      },
      snake: [{ x: 1, y: 1 }],
      obstacles: [{ x: 0, y: 0 }],
      food: [{ x: 2, y: 1 }],
      exit: { x: 5, y: 4 },
      snakeDirection: "East",
      floatingFood: [],
      fallingFood: [],
      stones: [],
      spikes: [],
    };

    render(App);

    await loadLevelFromLanding(JSON.stringify(validPayload), "valid-level.json");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /Create New Level/i })).not.toBeInTheDocument();
  });

  it("rejects an invalid level payload and stays on the landing page", async () => {
    const invalidPayload = {
      id: 77,
      name: "Landing Load Invalid",
      gridSize: {
        width: 6,
        height: 6,
      },
      snake: [],
      snakeDirection: "East",
    };

    render(App);

    await loadLevelFromLanding(JSON.stringify(invalidPayload), "invalid-level.json");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Create New Level/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });
});
