import { describe, expect, it } from "vitest";
import {
  buildLevelExportPayload,
  generateLevelId,
  isValidLevelId,
  UINT32_MAX,
} from "../lib/levelModel";
import type { GridCell } from "../lib/types";

function createGrid(width: number, height: number): GridCell[][] {
  return Array.from({ length: height }, (_, row) =>
    Array.from({ length: width }, (_, col) => ({
      row,
      col,
      entity: null,
      isSnakeSegment: false,
      snakeSegmentIndex: undefined,
    }))
  );
}

describe("level model", () => {
  describe("isValidLevelId", () => {
    it("accepts uint32 boundaries", () => {
      expect(isValidLevelId(0)).toBe(true);
      expect(isValidLevelId(UINT32_MAX)).toBe(true);
    });

    it("rejects out-of-range and non-integer values", () => {
      expect(isValidLevelId(-1)).toBe(false);
      expect(isValidLevelId(UINT32_MAX + 1)).toBe(false);
      expect(isValidLevelId(12.25)).toBe(false);
    });

    it("rejects invalid input types", () => {
      expect(isValidLevelId("123")).toBe(false);
      expect(isValidLevelId(null)).toBe(false);
      expect(isValidLevelId(undefined)).toBe(false);
      expect(isValidLevelId(NaN)).toBe(false);
      expect(isValidLevelId(Infinity)).toBe(false);
    });
  });

  describe("generateLevelId", () => {
    it("maps random zero to one", () => {
      const provider = {
        getRandomValues(array: Uint32Array) {
          array[0] = 0;
          return array;
        },
      };

      expect(generateLevelId(provider)).toBe(1);
    });

    it("returns non-zero generated ids unchanged", () => {
      const provider = {
        getRandomValues(array: Uint32Array) {
          array[0] = 4242;
          return array;
        },
      };

      const levelId = generateLevelId(provider);

      expect(levelId).toBe(4242);
      expect(isValidLevelId(levelId)).toBe(true);
    });
  });

  describe("buildLevelExportPayload", () => {
    it("serializes export payload with expected contract field names", () => {
      const cells = createGrid(3, 3);
      cells[0][0].entity = "obstacle";
      cells[0][1].entity = "food";
      cells[0][2].entity = "floating-food";
      cells[1][0].entity = "falling-food";
      cells[1][1].entity = "stone";
      cells[1][2].entity = "spike";
      cells[2][0].entity = "exit";

      const payload = buildLevelExportPayload({
        levelId: 123,
        name: "Contract Level",
        difficulty: "medium",
        gridWidth: 3,
        gridHeight: 3,
        cells,
        snakeSegments: [
          { row: 2, col: 2 },
          { row: 2, col: 1 },
        ],
        snakeDirection: "west",
      });

      expect(payload).toEqual({
        id: 123,
        name: "Contract Level",
        difficulty: "medium",
        gridSize: {
          width: 3,
          height: 3,
        },
        snake: [
          { x: 2, y: 2 },
          { x: 1, y: 2 },
        ],
        obstacles: [{ x: 0, y: 0 }],
        food: [{ x: 1, y: 0 }],
        exit: { x: 0, y: 2 },
        snakeDirection: "West",
        floatingFood: [{ x: 2, y: 0 }],
        fallingFood: [{ x: 0, y: 1 }],
        stones: [{ x: 1, y: 1 }],
        spikes: [{ x: 2, y: 1 }],
        totalFood: 3,
      });

      expect(Object.keys(payload)).toEqual([
        "id",
        "name",
        "difficulty",
        "gridSize",
        "snake",
        "obstacles",
        "food",
        "exit",
        "snakeDirection",
        "floatingFood",
        "fallingFood",
        "stones",
        "spikes",
        "totalFood",
      ]);
      expect(payload).not.toHaveProperty("grid_size");
      expect(payload).not.toHaveProperty("snake_direction");
    });

    it("rejects invalid level ids", () => {
      expect(() =>
        buildLevelExportPayload({
          levelId: UINT32_MAX + 1,
          name: "Invalid ID",
          difficulty: "easy",
          gridWidth: 1,
          gridHeight: 1,
          cells: createGrid(1, 1),
          snakeSegments: [],
          snakeDirection: "north",
        })
      ).toThrow("Invalid level format: id must be a uint32 number");
    });

    it("serializes empty snake segments as an empty snake array", () => {
      const cells = createGrid(2, 2);
      cells[1][1].entity = "exit";

      const payload = buildLevelExportPayload({
        levelId: 7,
        name: "Empty Snake",
        difficulty: "easy",
        gridWidth: 2,
        gridHeight: 2,
        cells,
        snakeSegments: [],
        snakeDirection: "east",
      });

      expect(payload.snake).toEqual([]);
      expect(payload.exit).toEqual({ x: 1, y: 1 });
    });

    it("serializes missing exit as null", () => {
      const payload = buildLevelExportPayload({
        levelId: 8,
        name: "No Exit",
        difficulty: "hard",
        gridWidth: 2,
        gridHeight: 2,
        cells: createGrid(2, 2),
        snakeSegments: [{ row: 0, col: 0 }],
        snakeDirection: "north",
      });

      expect(payload.exit).toBeNull();
      expect(payload.snake).toEqual([{ x: 0, y: 0 }]);
    });

    it("uses the last encountered exit when duplicate exits exist in the grid", () => {
      const cells = createGrid(3, 2);
      cells[0][0].entity = "exit";
      cells[1][2].entity = "exit";

      const payload = buildLevelExportPayload({
        levelId: 9,
        name: "Duplicate Exit",
        difficulty: "medium",
        gridWidth: 3,
        gridHeight: 2,
        cells,
        snakeSegments: [{ row: 0, col: 1 }],
        snakeDirection: "south",
      });

      expect(payload.exit).toEqual({ x: 2, y: 1 });
    });
  });
});
