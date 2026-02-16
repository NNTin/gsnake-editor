import type { Direction, GridCell, Position } from "./types";

// See contracts/level-definition-semantics.md for the authoritative
// optional-field and totalFood round-trip contract.
export const UINT32_MAX = 4_294_967_295;

export type Difficulty = "easy" | "medium" | "hard";
export type RuntimeSnakeDirection = "North" | "South" | "East" | "West";

export interface SnakeSegment {
  row: number;
  col: number;
}

export interface LevelExportPayload {
  id: number;
  name: string;
  difficulty: Difficulty;
  gridSize: {
    width: number;
    height: number;
  };
  snake: Position[];
  obstacles: Position[];
  food: Position[];
  exit: Position | null;
  snakeDirection: RuntimeSnakeDirection;
  floatingFood: Position[];
  fallingFood: Position[];
  stones: Position[];
  spikes: Position[];
  totalFood: number;
}

export interface BuildLevelExportInput {
  levelId: number;
  name: string;
  difficulty: Difficulty;
  gridWidth: number;
  gridHeight: number;
  cells: GridCell[][];
  snakeSegments: SnakeSegment[];
  snakeDirection: Direction;
}

export interface RandomValuesProvider {
  getRandomValues(array: Uint32Array): Uint32Array;
}

function defaultRandomValuesProvider(): RandomValuesProvider {
  return {
    getRandomValues(array: Uint32Array): Uint32Array {
      return crypto.getRandomValues(array);
    },
  };
}

export function isValidLevelId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= UINT32_MAX;
}

export function generateLevelId(
  randomValuesProvider: RandomValuesProvider = defaultRandomValuesProvider()
): number {
  const generated = new Uint32Array(1);
  randomValuesProvider.getRandomValues(generated);

  // Avoid zero to keep IDs truthy across tools and scripts.
  return generated[0] === 0 ? 1 : generated[0];
}

function toRuntimeSnakeDirection(direction: Direction): RuntimeSnakeDirection {
  switch (direction) {
    case "north":
      return "North";
    case "south":
      return "South";
    case "east":
      return "East";
    case "west":
      return "West";
  }
}

export function buildLevelExportPayload(input: BuildLevelExportInput): LevelExportPayload {
  if (!isValidLevelId(input.levelId)) {
    throw new Error("Invalid level format: id must be a uint32 number");
  }

  const obstacles: Position[] = [];
  const food: Position[] = [];
  const stones: Position[] = [];
  const spikes: Position[] = [];
  const floatingFood: Position[] = [];
  const fallingFood: Position[] = [];
  let exit: Position | null = null;

  for (let row = 0; row < input.gridHeight; row++) {
    for (let col = 0; col < input.gridWidth; col++) {
      const cell = input.cells[row]?.[col];
      if (!cell?.entity) {
        continue;
      }

      const position: Position = { x: col, y: row };

      switch (cell.entity) {
        case "obstacle":
          obstacles.push(position);
          break;
        case "food":
          food.push(position);
          break;
        case "stone":
          stones.push(position);
          break;
        case "spike":
          spikes.push(position);
          break;
        case "floating-food":
          floatingFood.push(position);
          break;
        case "falling-food":
          fallingFood.push(position);
          break;
        case "exit":
          exit = position;
          break;
        case "snake":
          break;
      }
    }
  }

  const snake: Position[] = input.snakeSegments.map((segment) => ({
    x: segment.col,
    y: segment.row,
  }));

  // Keep totalFood in sync with the LevelDefinition semantics contract.
  const totalFood = food.length + floatingFood.length + fallingFood.length;

  return {
    id: input.levelId,
    name: input.name,
    difficulty: input.difficulty,
    gridSize: {
      width: input.gridWidth,
      height: input.gridHeight,
    },
    snake,
    obstacles,
    food,
    exit,
    snakeDirection: toRuntimeSnakeDirection(input.snakeDirection),
    floatingFood,
    fallingFood,
    stones,
    spikes,
    totalFood,
  };
}
