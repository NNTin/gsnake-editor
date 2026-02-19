import { isValidLevelId } from "./levelModel";
import type { LevelData } from "./types";

const MIN_GRID_DIMENSION = 5;
const MAX_GRID_DIMENSION = 50;

export function validateLevelFileData(data: LevelData): void {
  if (!isValidLevelId(data.id)) {
    throw new Error("Invalid level format: id must be a uint32 number");
  }
  if (
    !data.gridSize ||
    typeof data.gridSize.width !== "number" ||
    typeof data.gridSize.height !== "number"
  ) {
    throw new Error("Invalid level format: missing or invalid gridSize");
  }
  if (!Array.isArray(data.snake) || data.snake.length === 0) {
    throw new Error("Invalid level format: missing or invalid snake");
  }
  if (!data.snakeDirection) {
    throw new Error("Invalid level format: missing snakeDirection");
  }

  if (
    data.gridSize.width < MIN_GRID_DIMENSION ||
    data.gridSize.width > MAX_GRID_DIMENSION ||
    data.gridSize.height < MIN_GRID_DIMENSION ||
    data.gridSize.height > MAX_GRID_DIMENSION
  ) {
    throw new Error("Invalid grid dimensions: width and height must be between 5 and 50");
  }
}

export function parseAndValidateLevelFileData(text: string): LevelData {
  const data = JSON.parse(text) as LevelData;
  validateLevelFileData(data);
  return data;
}
