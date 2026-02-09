import express from "express";
import cors from "cors";

const app = express();
const PORT = 3001;
const ALLOWED_METHODS = ["GET", "POST"] as const;
const DIRECTION_VALUES = new Set(["North", "South", "East", "West"]);

// Enable CORS for localhost development (allow all localhost ports)
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // Allow all localhost origins
      if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
        return callback(null, true);
      }

      callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST"],
    credentials: true,
  })
);

// Parse JSON bodies
app.use(express.json());

// In-memory storage for test level
interface StoredLevel {
  data: unknown;
  timestamp: number;
}

interface Position {
  x: number;
  y: number;
}

interface LevelPayload {
  id: number;
  name: string;
  gridSize: {
    width: number;
    height: number;
  };
  snake: Position[];
  obstacles: Position[];
  food: Position[];
  exit: Position;
  snakeDirection: string;
  floatingFood?: Position[];
  fallingFood?: Position[];
  stones?: Position[];
  spikes?: Position[];
  totalFood: number;
  difficulty?: string;
  exitIsSolid?: boolean;
}

let testLevel: StoredLevel | null = null;

// Expiration time: 1 hour in milliseconds
const EXPIRATION_TIME = 60 * 60 * 1000;

// Helper function to check if level has expired
function isLevelExpired(level: StoredLevel): boolean {
  return Date.now() - level.timestamp > EXPIRATION_TIME;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPosition(value: unknown): value is Position {
  if (!isPlainObject(value)) return false;
  return isFiniteNumber(value.x) && isFiniteNumber(value.y);
}

function isPositionArray(value: unknown): value is Position[] {
  return Array.isArray(value) && value.every((item) => isPosition(item));
}

function isOptionalPositionArray(value: unknown): boolean {
  if (value === undefined) return true;
  return isPositionArray(value);
}

function validateLevelPayload(payload: unknown): string[] {
  if (!isPlainObject(payload)) {
    return ["Request body must be a JSON object."];
  }

  const errors: string[] = [];
  const candidate = payload as Partial<LevelPayload>;

  if (!isFiniteNumber(candidate.id)) errors.push("id must be a finite number.");
  if (typeof candidate.name !== "string" || candidate.name.trim().length === 0) {
    errors.push("name must be a non-empty string.");
  }
  if (!isPlainObject(candidate.gridSize)) {
    errors.push("gridSize must be an object with width and height numbers.");
  } else {
    if (!isFiniteNumber(candidate.gridSize.width)) {
      errors.push("gridSize.width must be a finite number.");
    }
    if (!isFiniteNumber(candidate.gridSize.height)) {
      errors.push("gridSize.height must be a finite number.");
    }
  }
  if (!isPositionArray(candidate.snake)) errors.push("snake must be an array of positions.");
  if (!isPositionArray(candidate.obstacles)) {
    errors.push("obstacles must be an array of positions.");
  }
  if (!isPositionArray(candidate.food)) errors.push("food must be an array of positions.");
  if (!isPosition(candidate.exit)) errors.push("exit must be a position object.");
  if (
    typeof candidate.snakeDirection !== "string" ||
    !DIRECTION_VALUES.has(candidate.snakeDirection)
  ) {
    errors.push("snakeDirection must be one of North, South, East, or West.");
  }
  if (!isOptionalPositionArray(candidate.floatingFood)) {
    errors.push("floatingFood must be an array of positions when provided.");
  }
  if (!isOptionalPositionArray(candidate.fallingFood)) {
    errors.push("fallingFood must be an array of positions when provided.");
  }
  if (!isOptionalPositionArray(candidate.stones)) {
    errors.push("stones must be an array of positions when provided.");
  }
  if (!isOptionalPositionArray(candidate.spikes)) {
    errors.push("spikes must be an array of positions when provided.");
  }
  if (!isFiniteNumber(candidate.totalFood)) {
    errors.push("totalFood must be a finite number.");
  }
  if (candidate.difficulty !== undefined && typeof candidate.difficulty !== "string") {
    errors.push("difficulty must be a string when provided.");
  }
  if (candidate.exitIsSolid !== undefined && typeof candidate.exitIsSolid !== "boolean") {
    errors.push("exitIsSolid must be a boolean when provided.");
  }

  return errors;
}

// POST /api/test-level - Store a test level
app.post("/api/test-level", (req, res) => {
  const validationErrors = validateLevelPayload(req.body);

  if (validationErrors.length > 0) {
    return res.status(400).json({
      error: "Invalid level payload",
      details: validationErrors,
    });
  }

  // Store the level with current timestamp
  testLevel = {
    data: req.body,
    timestamp: Date.now(),
  };

  console.log("Test level stored successfully");
  res.json({ success: true, message: "Test level stored successfully" });
});

// GET /api/test-level - Retrieve the stored test level
app.get("/api/test-level", (req, res) => {
  if (!testLevel) {
    return res.status(404).json({ error: "No test level available" });
  }

  // Check if level has expired
  if (isLevelExpired(testLevel)) {
    testLevel = null;
    return res.status(404).json({ error: "Test level has expired" });
  }

  res.json(testLevel.data);
});

app.all("/api/test-level", (_req, res) => {
  res.set("Allow", ALLOWED_METHODS.join(", "));
  return res.status(405).json({
    error: "Method not allowed",
    allowedMethods: ALLOWED_METHODS,
  });
});

app.use(
  (error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (error instanceof SyntaxError && "status" in error) {
      return res.status(400).json({ error: "Malformed JSON payload" });
    }
    return next(error);
  }
);

function resetTestLevelForTests(): void {
  testLevel = null;
}

// Export app for testing
export { app, resetTestLevelForTests };

// Start the server only when run directly (not when imported for testing)
// Check if this module is the main entry point
const isMainModule =
  import.meta.url.endsWith(process.argv[1]) || import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Test level server running on http://localhost:${PORT}`);
    console.log("Endpoints:");
    console.log(`  POST http://localhost:${PORT}/api/test-level`);
    console.log(`  GET  http://localhost:${PORT}/api/test-level`);
  });
}
