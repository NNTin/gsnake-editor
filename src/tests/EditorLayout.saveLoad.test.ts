import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import "@testing-library/jest-dom";
import EditorLayout from "../lib/EditorLayout.svelte";
import { isValidLevelId } from "../lib/levelModel";
import type { LevelData } from "../lib/types";

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("svelte-5-french-toast", () => ({
  default: toastMock,
}));

interface CapturedBlob {
  parts: unknown[];
  type: string;
}

const createObjectURLMock = vi.fn<(object: unknown) => string>(() => "blob:level-export");
const revokeObjectURLMock = vi.fn<(url: string) => void>();
const capturedBlobs: CapturedBlob[] = [];
const nativeBlob = globalThis.Blob;

class MockBlob {
  parts: unknown[];
  type: string;

  constructor(parts: unknown[], options?: { type?: string }) {
    this.parts = parts;
    this.type = options?.type ?? "";
    capturedBlobs.push({ parts: [...parts], type: this.type });
  }
}

function getGridCell(container: HTMLElement, row: number, col: number): HTMLElement {
  const cell = container.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  if (!(cell instanceof HTMLElement)) {
    throw new Error(`Grid cell not found at row=${row}, col=${col}`);
  }

  return cell;
}

async function loadLevelFromFile(contents: string, filename: string): Promise<void> {
  await fireEvent.click(screen.getByRole("button", { name: "Load" }));

  const input = document.body.querySelector('input[type="file"]');
  expect(input).toBeInstanceOf(HTMLInputElement);

  const fileLike = {
    name: filename,
    async text() {
      return contents;
    },
  } as File;

  Object.defineProperty(input, "files", {
    value: [fileLike],
    configurable: true,
  });

  await fireEvent.change(input as HTMLInputElement);
}

describe("EditorLayout save/load workflow", () => {
  let anchorClickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    toastMock.success.mockReset();
    toastMock.error.mockReset();
    createObjectURLMock.mockClear();
    revokeObjectURLMock.mockClear();
    capturedBlobs.length = 0;

    Object.defineProperty(globalThis, "Blob", {
      value: MockBlob,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(URL, "createObjectURL", {
      value: createObjectURLMock,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(URL, "revokeObjectURL", {
      value: revokeObjectURLMock,
      configurable: true,
      writable: true,
    });

    anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    anchorClickSpy.mockRestore();
    Object.defineProperty(globalThis, "Blob", {
      value: nativeBlob,
      configurable: true,
      writable: true,
    });
  });

  it("opens save modal and exports a generated level payload", async () => {
    const { container } = render(EditorLayout, {
      gridWidth: 5,
      gridHeight: 5,
      initialLevelData: null,
    });

    await fireEvent.click(getGridCell(container, 0, 0));
    await fireEvent.click(screen.getByRole("button", { name: "Food" }));
    await fireEvent.click(getGridCell(container, 0, 1));
    await fireEvent.click(screen.getByRole("button", { name: "Exit" }));
    await fireEvent.click(getGridCell(container, 0, 2));

    await fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("heading", { name: "Save Level" })).toBeInTheDocument();

    await fireEvent.input(screen.getByLabelText("Level Name"), {
      target: { value: "Workflow Level" },
    });

    await fireEvent.change(screen.getByLabelText("Difficulty"), {
      target: { value: "hard" },
    });

    await fireEvent.click(screen.getByRole("button", { name: "Export" }));

    await waitFor(() => {
      expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    });

    const exportedBlob = createObjectURLMock.mock.calls[0][0] as CapturedBlob;
    const exportedPayload = JSON.parse(String(exportedBlob.parts[0]));

    expect(isValidLevelId(exportedPayload.id)).toBe(true);
    expect(exportedPayload.name).toBe("Workflow Level");
    expect(exportedPayload.difficulty).toBe("hard");
    expect(exportedPayload.gridSize).toEqual({ width: 5, height: 5 });
    expect(exportedPayload.snake).toEqual([{ x: 0, y: 0 }]);
    expect(exportedPayload.food).toEqual([{ x: 1, y: 0 }]);
    expect(exportedPayload.exit).toEqual({ x: 2, y: 0 });
    expect(exportedPayload.snakeDirection).toBe("East");
    expect(exportedPayload.totalFood).toBe(1);
    expect(exportedBlob.type).toBe("application/json");

    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:level-export");
    expect(toastMock.success).toHaveBeenCalledWith(
      'Level "Workflow Level" saved successfully!',
      expect.any(Object)
    );
    expect(screen.queryByRole("heading", { name: "Save Level" })).not.toBeInTheDocument();
  });

  it("does not show no-food warning when only floating food is placed", async () => {
    const { container } = render(EditorLayout, {
      gridWidth: 5,
      gridHeight: 5,
      initialLevelData: null,
    });

    await fireEvent.click(getGridCell(container, 0, 0));
    await fireEvent.click(screen.getByRole("button", { name: "Floating Food" }));
    await fireEvent.click(getGridCell(container, 0, 1));
    await fireEvent.click(screen.getByRole("button", { name: "Exit" }));
    await fireEvent.click(getGridCell(container, 0, 2));

    await fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("heading", { name: "Save Level" })).toBeInTheDocument();
    expect(
      screen.queryByText("No food placed - level may not be completable")
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export Anyway" })).not.toBeInTheDocument();
  });

  it("loads a valid level file and renders the imported grid state", async () => {
    const loadedLevel: LevelData = {
      id: 42,
      name: "Loaded Level",
      gridSize: {
        width: 5,
        height: 6,
      },
      snake: [
        { x: 1, y: 1 },
        { x: 1, y: 2 },
      ],
      obstacles: [{ x: 0, y: 0 }],
      food: [{ x: 3, y: 4 }],
      exit: { x: 4, y: 5 },
      snakeDirection: "South",
      floatingFood: [{ x: 2, y: 0 }],
      fallingFood: [{ x: 4, y: 0 }],
      stones: [{ x: 0, y: 5 }],
      spikes: [{ x: 2, y: 2 }],
    };

    const { container } = render(EditorLayout, {
      gridWidth: 8,
      gridHeight: 8,
      initialLevelData: null,
    });

    await loadLevelFromFile(JSON.stringify(loadedLevel), "loaded-level.json");

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveValue("south");
    });

    expect(container.querySelectorAll(".cell")).toHaveLength(30);
    expect(getGridCell(container, 1, 1)).toHaveClass("is-snake-segment");
    expect(getGridCell(container, 1, 1)).toHaveTextContent("H");
    expect(getGridCell(container, 2, 1)).toHaveClass("is-snake-segment");
    expect(getGridCell(container, 2, 1)).toHaveTextContent("1");
    expect(getGridCell(container, 0, 0)).toHaveClass("has-entity");
    expect(getGridCell(container, 4, 3)).toHaveClass("has-entity");
    expect(getGridCell(container, 5, 4)).toHaveClass("has-entity");
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("preserves imported entities across sequential loads with different grid sizes", async () => {
    const firstLoadedLevel: LevelData = {
      id: 100,
      name: "First Loaded Level",
      gridSize: {
        width: 6,
        height: 5,
      },
      snake: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      obstacles: [{ x: 5, y: 4 }],
      food: [{ x: 2, y: 2 }],
      exit: { x: 4, y: 3 },
      snakeDirection: "East",
      floatingFood: [],
      fallingFood: [],
      stones: [],
      spikes: [],
    };

    const secondLoadedLevel: LevelData = {
      id: 101,
      name: "Second Loaded Level",
      gridSize: {
        width: 5,
        height: 7,
      },
      snake: [{ x: 4, y: 6 }],
      obstacles: [],
      food: [{ x: 1, y: 3 }],
      exit: { x: 0, y: 6 },
      snakeDirection: "West",
      floatingFood: [],
      fallingFood: [],
      stones: [{ x: 2, y: 0 }],
      spikes: [{ x: 4, y: 0 }],
    };

    const { container } = render(EditorLayout, {
      gridWidth: 9,
      gridHeight: 9,
      initialLevelData: null,
    });

    await loadLevelFromFile(JSON.stringify(firstLoadedLevel), "first-loaded-level.json");

    await waitFor(() => {
      expect(container.querySelectorAll(".cell")).toHaveLength(30);
    });

    expect(getGridCell(container, 0, 0)).toHaveClass("is-snake-segment");
    expect(getGridCell(container, 0, 1)).toHaveClass("is-snake-segment");
    expect(getGridCell(container, 4, 5)).toHaveClass("has-entity");
    expect(getGridCell(container, 2, 2)).toHaveClass("has-entity");
    expect(getGridCell(container, 3, 4)).toHaveClass("has-entity");

    await loadLevelFromFile(JSON.stringify(secondLoadedLevel), "second-loaded-level.json");

    await waitFor(() => {
      expect(container.querySelectorAll(".cell")).toHaveLength(35);
      expect(screen.getByRole("combobox")).toHaveValue("west");
    });

    expect(getGridCell(container, 6, 4)).toHaveClass("is-snake-segment");
    expect(getGridCell(container, 3, 1)).toHaveClass("has-entity");
    expect(getGridCell(container, 6, 0)).toHaveClass("has-entity");
    expect(getGridCell(container, 0, 2)).toHaveClass("has-entity");
    expect(getGridCell(container, 0, 4)).toHaveClass("has-entity");
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("rejects out-of-bounds coordinates instead of partially loading and dropping them", async () => {
    const { container } = render(EditorLayout, {
      gridWidth: 6,
      gridHeight: 6,
      initialLevelData: null,
    });

    const outOfBoundsPayload: LevelData = {
      id: 19,
      name: "Out Of Bounds",
      gridSize: {
        width: 6,
        height: 6,
      },
      snake: [{ x: 1, y: 1 }],
      obstacles: [],
      food: [{ x: -1, y: 2 }],
      exit: { x: 5, y: 5 },
      snakeDirection: "South",
      floatingFood: [],
      fallingFood: [],
      stones: [],
      spikes: [],
    };

    await loadLevelFromFile(JSON.stringify(outOfBoundsPayload), "out-of-bounds-level.json");

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "Failed to load level: Unsupported out-of-bounds coordinates for grid 6x6: food[0] at (-1, 2)."
        ),
        expect.any(Object)
      );
    });

    expect(screen.getByRole("combobox")).toHaveValue("east");
    expect(container.querySelectorAll(".cell.has-entity")).toHaveLength(0);
  });

  it("cleans up hidden file input when load dialog is canceled", async () => {
    render(EditorLayout, {
      gridWidth: 6,
      gridHeight: 6,
      initialLevelData: null,
    });

    await fireEvent.click(screen.getByRole("button", { name: "Load" }));

    expect(document.body.querySelectorAll('input[type="file"]')).toHaveLength(1);

    window.dispatchEvent(new Event("focus"));

    await waitFor(() => {
      expect(document.body.querySelector('input[type="file"]')).toBeNull();
    });

    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("posts a canonical export payload when testing a level", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      async json() {
        return { success: true };
      },
    });
    vi.stubGlobal("fetch", fetchMock);
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    try {
      const { container } = render(EditorLayout, {
        gridWidth: 5,
        gridHeight: 5,
        initialLevelData: null,
      });

      await fireEvent.click(getGridCell(container, 0, 0));
      await fireEvent.click(getGridCell(container, 0, 1));

      await fireEvent.click(screen.getByRole("button", { name: "Food" }));
      await fireEvent.click(getGridCell(container, 1, 1));

      await fireEvent.click(screen.getByRole("button", { name: "Floating Food" }));
      await fireEvent.click(getGridCell(container, 1, 2));

      await fireEvent.click(screen.getByRole("button", { name: "Falling Food" }));
      await fireEvent.click(getGridCell(container, 1, 3));

      await fireEvent.click(screen.getByRole("button", { name: "Stone" }));
      await fireEvent.click(getGridCell(container, 2, 0));

      await fireEvent.click(screen.getByRole("button", { name: "Spike" }));
      await fireEvent.click(getGridCell(container, 2, 1));

      await fireEvent.click(screen.getByRole("button", { name: "Obstacle" }));
      await fireEvent.click(getGridCell(container, 2, 2));

      await fireEvent.click(screen.getByRole("button", { name: "Exit" }));
      await fireEvent.click(getGridCell(container, 4, 4));

      await fireEvent.change(screen.getByRole("combobox"), {
        target: { value: "north" },
      });

      await fireEvent.click(screen.getByRole("button", { name: "Test" }));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });

      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:3001/api/test-level",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        })
      );

      const requestBody = fetchMock.mock.calls[0]?.[1]?.body;
      expect(typeof requestBody).toBe("string");
      const payload = JSON.parse(requestBody as string);

      expect(payload).toMatchObject({
        id: 999999,
        name: "Test Level",
        difficulty: "medium",
        gridSize: {
          width: 5,
          height: 5,
        },
        snake: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        obstacles: [{ x: 2, y: 2 }],
        food: [{ x: 1, y: 1 }],
        floatingFood: [{ x: 2, y: 1 }],
        fallingFood: [{ x: 3, y: 1 }],
        stones: [{ x: 0, y: 2 }],
        spikes: [{ x: 1, y: 2 }],
        exit: { x: 4, y: 4 },
        snakeDirection: "North",
        totalFood: 3,
      });
      expect(windowOpenSpy).toHaveBeenCalledWith("http://localhost:3000?test=true", "_blank");
      expect(toastMock.success).toHaveBeenCalledWith(
        "Test level uploaded successfully! Opening game in new tab...",
        expect.any(Object)
      );
      expect(toastMock.error).not.toHaveBeenCalled();
    } finally {
      windowOpenSpy.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("shows user-facing error feedback when loading an invalid level payload", async () => {
    render(EditorLayout, {
      gridWidth: 6,
      gridHeight: 6,
      initialLevelData: null,
    });

    const invalidPayload = {
      id: 7,
      name: "Broken Level",
      gridSize: {
        width: 6,
        height: 6,
      },
      snake: [],
      snakeDirection: "East",
    };

    await loadLevelFromFile(JSON.stringify(invalidPayload), "invalid-level.json");

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "Failed to load level: Invalid level format: missing or invalid snake."
        ),
        expect.any(Object)
      );
    });
  });
});
