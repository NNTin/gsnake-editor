import express from "express";
import cors from "cors";
import { validateLevelPayload } from "./src/server/levelDefinitionValidator";

const app = express();
const PORT = 3001;
const ALLOWED_METHODS = ["GET", "POST"] as const;
const CORS_NOT_ALLOWED_ERROR = "Not allowed by CORS";
const ALLOWED_ORIGINS_ENV = "GSNAKE_EDITOR_ALLOWED_ORIGINS";
const API_HEALTH_RESPONSE = Object.freeze({
  status: "ok",
  service: "gsnake-editor-api",
});
const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3003",
  "http://127.0.0.1:3003",
] as const;

function resolveAllowedCorsOrigins(rawOrigins = process.env[ALLOWED_ORIGINS_ENV]): string[] {
  if (!rawOrigins?.trim()) {
    return [...DEFAULT_ALLOWED_ORIGINS];
  }

  const parsedOrigins = rawOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return parsedOrigins.length > 0 ? parsedOrigins : [...DEFAULT_ALLOWED_ORIGINS];
}

// Enable CORS for known local development origins.
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (resolveAllowedCorsOrigins().includes(origin)) {
        return callback(null, true);
      }

      callback(new Error(CORS_NOT_ALLOWED_ERROR));
    },
    methods: [...ALLOWED_METHODS],
    credentials: true,
  })
);

// Parse JSON bodies
app.use(express.json());

// GET /health - deterministic readiness signal for CI/local checks
app.get("/health", (_req, res) => {
  res.status(200).json(API_HEALTH_RESPONSE);
});

// In-memory storage for test level
interface StoredLevel {
  data: unknown;
  timestamp: number;
}

let testLevel: StoredLevel | null = null;

// Expiration time: 1 hour in milliseconds
const EXPIRATION_TIME = 60 * 60 * 1000;

// Helper function to check if level has expired
function isLevelExpired(level: StoredLevel): boolean {
  return Date.now() - level.timestamp > EXPIRATION_TIME;
}

// POST /api/test-level - Store a test level
app.post("/api/test-level", (req, res) => {
  // Round-trip and optional-field semantics are defined in
  // contracts/level-definition-semantics.md.
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
    if (error instanceof Error && error.message === CORS_NOT_ALLOWED_ERROR) {
      return res.status(403).json({ error: CORS_NOT_ALLOWED_ERROR });
    }

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
export { app, resetTestLevelForTests, resolveAllowedCorsOrigins };

// Start the server only when run directly (not when imported for testing)
// Check if this module is the main entry point
const isMainModule =
  import.meta.url.endsWith(process.argv[1]) || import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  // Bind without an explicit host so localhost resolves on both IPv4 and IPv6.
  app.listen(PORT, () => {
    console.log(`Test level server running on http://localhost:${PORT}`);
    console.log("Endpoints:");
    console.log(`  GET  http://localhost:${PORT}/health`);
    console.log(`  POST http://localhost:${PORT}/api/test-level`);
    console.log(`  GET  http://localhost:${PORT}/api/test-level`);
  });
}
