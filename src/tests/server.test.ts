// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import path from "path";
import { pathToFileURL } from "url";
import { app, isMainModule, resetTestLevelForTests, resolveAllowedCorsOrigins } from "../../server";

describe("Server API tests", () => {
  const originalAllowedCorsOrigins = process.env.GSNAKE_EDITOR_ALLOWED_ORIGINS;
  const validLevelData = {
    id: 999999,
    name: "Test Level",
    gridSize: {
      width: 10,
      height: 10,
    },
    snake: [{ x: 2, y: 2 }],
    obstacles: [],
    food: [{ x: 3, y: 3 }],
    exit: { x: 9, y: 9 },
    snakeDirection: "East",
    floatingFood: [],
    fallingFood: [],
    stones: [],
    spikes: [],
    totalFood: 1,
  };

  beforeEach(() => {
    resetTestLevelForTests();
    delete process.env.GSNAKE_EDITOR_ALLOWED_ORIGINS;
  });

  afterAll(() => {
    if (originalAllowedCorsOrigins === undefined) {
      delete process.env.GSNAKE_EDITOR_ALLOWED_ORIGINS;
      return;
    }
    process.env.GSNAKE_EDITOR_ALLOWED_ORIGINS = originalAllowedCorsOrigins;
  });

  describe("CORS origin policy", () => {
    it("should allow a default configured origin", async () => {
      const origin = "http://localhost:3003";
      const response = await request(app).get("/api/test-level").set("Origin", origin).expect(404);

      expect(response.headers["access-control-allow-origin"]).toBe(origin);
    });

    it("should reject a localhost origin that is not explicitly allowed", async () => {
      const response = await request(app)
        .get("/api/test-level")
        .set("Origin", "http://localhost:3999")
        .expect(403);

      expect(response.body).toEqual({ error: "Not allowed by CORS" });
      expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    });

    it("should keep startup allowlist even if env changes at runtime", async () => {
      process.env.GSNAKE_EDITOR_ALLOWED_ORIGINS = "http://localhost:4321,http://127.0.0.1:4321";

      const defaultOriginResponse = await request(app)
        .get("/api/test-level")
        .set("Origin", "http://localhost:3003")
        .expect(404);

      expect(defaultOriginResponse.headers["access-control-allow-origin"]).toBe(
        "http://localhost:3003"
      );

      const rejectedResponse = await request(app)
        .get("/api/test-level")
        .set("Origin", "http://localhost:4321")
        .expect(403);

      expect(rejectedResponse.body).toEqual({ error: "Not allowed by CORS" });
    });
  });

  describe("resolveAllowedCorsOrigins", () => {
    it("should parse configured origins from a comma-separated string", () => {
      expect(resolveAllowedCorsOrigins("http://localhost:4321, http://127.0.0.1:4321, ")).toEqual([
        "http://localhost:4321",
        "http://127.0.0.1:4321",
      ]);
    });
  });

  describe("isMainModule", () => {
    it("should return true when module path and entry path match", () => {
      const entryPath = path.resolve(process.cwd(), "server.ts");
      const moduleUrl = pathToFileURL(entryPath).toString();

      expect(isMainModule(moduleUrl, entryPath)).toBe(true);
    });

    it("should return true when entry path is relative", () => {
      const entryPath = path.resolve(process.cwd(), "server.ts");
      const moduleUrl = pathToFileURL(entryPath).toString();
      const relativeEntryPath = path.relative(process.cwd(), entryPath);

      expect(isMainModule(moduleUrl, relativeEntryPath)).toBe(true);
    });

    it("should return false when entry path is missing", () => {
      const entryPath = path.resolve(process.cwd(), "server.ts");
      const moduleUrl = pathToFileURL(entryPath).toString();

      expect(isMainModule(moduleUrl, undefined)).toBe(false);
    });

    it("should return false when module path and entry path differ", () => {
      const entryPath = path.resolve(process.cwd(), "server.ts");
      const moduleUrl = pathToFileURL(entryPath).toString();
      const differentEntryPath = path.resolve(process.cwd(), "src", "tests", "server.test.ts");

      expect(isMainModule(moduleUrl, differentEntryPath)).toBe(false);
    });
  });

  describe("GET /health", () => {
    it("should return a deterministic API health contract", async () => {
      const response = await request(app).get("/health").expect(200);

      expect(response.body).toEqual({
        status: "ok",
        service: "gsnake-editor-api",
      });
    });
  });

  describe("POST /api/test-level", () => {
    it("should return success with { success: true }", async () => {
      const response = await request(app).post("/api/test-level").send(validLevelData).expect(200);

      expect(response.body).toEqual({ success: true, message: "Test level stored successfully" });
    });

    it("should reject missing payloads", async () => {
      const response = await request(app).post("/api/test-level").send({}).expect(400);

      expect(response.body).toMatchObject({ error: "Invalid level payload" });
      expect(response.body.details).toBeInstanceOf(Array);
      expect(response.body.details.length).toBeGreaterThan(0);
      expect(response.body.details[0]).toEqual(
        expect.objectContaining({
          field: expect.any(String),
          keyword: expect.any(String),
          message: expect.any(String),
        })
      );
    });

    it("should reject malformed payloads", async () => {
      const response = await request(app)
        .post("/api/test-level")
        .send({
          ...validLevelData,
          id: "bad-id",
          snakeDirection: "north-east",
          gridSize: { width: "10", height: 10 },
        })
        .expect(400);

      expect(response.body).toMatchObject({ error: "Invalid level payload" });
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "id",
            keyword: "type",
          }),
          expect.objectContaining({
            field: "gridSize.width",
            keyword: "type",
          }),
          expect.objectContaining({
            field: "snakeDirection",
            keyword: "enum",
          }),
        ])
      );
    });

    it("should reject gridSize width of zero with structured minimum errors", async () => {
      const response = await request(app)
        .post("/api/test-level")
        .send({
          ...validLevelData,
          gridSize: {
            width: 0,
            height: 10,
          },
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: "Invalid level payload",
      });
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "gridSize.width",
            keyword: "minimum",
          }),
        ])
      );
    });

    it("should reject negative coordinates with structured minimum errors", async () => {
      const payloadWithNegativeCoordinates = {
        ...validLevelData,
        snake: [{ x: -1, y: -2 }],
        food: [{ x: -3, y: 3 }],
        exit: { x: -4, y: 9 },
      };

      const response = await request(app)
        .post("/api/test-level")
        .send(payloadWithNegativeCoordinates)
        .expect(400);

      expect(response.body).toMatchObject({
        error: "Invalid level payload",
      });
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "snake.0.x",
            keyword: "minimum",
          }),
          expect.objectContaining({
            field: "snake.0.y",
            keyword: "minimum",
          }),
          expect.objectContaining({
            field: "food.0.x",
            keyword: "minimum",
          }),
          expect.objectContaining({
            field: "exit.x",
            keyword: "minimum",
          }),
        ])
      );
    });

    it("should reject coordinates outside grid bounds with structured maximum errors", async () => {
      const response = await request(app)
        .post("/api/test-level")
        .send({
          ...validLevelData,
          snake: [{ x: 10, y: 2 }],
          obstacles: [{ x: 5, y: 10 }],
          exit: { x: 11, y: 10 },
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: "Invalid level payload",
      });
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "snake.0.x",
            keyword: "maximum",
          }),
          expect.objectContaining({
            field: "obstacles.0.y",
            keyword: "maximum",
          }),
          expect.objectContaining({
            field: "exit.x",
            keyword: "maximum",
          }),
          expect.objectContaining({
            field: "exit.y",
            keyword: "maximum",
          }),
        ])
      );
    });

    it("should reject invalid coordinate types with structured coordinate field details", async () => {
      const response = await request(app)
        .post("/api/test-level")
        .send({
          ...validLevelData,
          snake: [{ x: "left", y: 2 }],
          food: [{ x: 3, y: 3.5 }],
          exit: { x: 9, y: null },
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: "Invalid level payload",
      });
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "snake.0.x",
            keyword: "type",
          }),
          expect.objectContaining({
            field: "food.0.y",
            keyword: "type",
          }),
          expect.objectContaining({
            field: "exit.y",
            keyword: "type",
          }),
        ])
      );
    });

    it("should reject invalid field combinations with stable 400 contract", async () => {
      const response = await request(app)
        .post("/api/test-level")
        .send({
          ...validLevelData,
          floatingFood: [{ x: 2 }],
          stones: [{ x: 1, y: 1, z: 9 }],
          spikes: "bad-spikes",
          unexpectedField: true,
        })
        .expect(400);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: "Invalid level payload",
      });
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "floatingFood.0.y",
            keyword: "required",
          }),
          expect.objectContaining({
            field: "stones.0.z",
            keyword: "additionalProperties",
          }),
          expect.objectContaining({
            field: "spikes",
            keyword: "type",
          }),
          expect.objectContaining({
            field: "unexpectedField",
            keyword: "additionalProperties",
          }),
        ])
      );
    });

    it("should reject malformed JSON bodies", async () => {
      const response = await request(app)
        .post("/api/test-level")
        .set("Content-Type", "application/json")
        .send('{"id":999999')
        .expect(400);

      expect(response.body).toEqual({ error: "Malformed JSON payload" });
    });
  });

  describe("GET /api/test-level", () => {
    it("should return the stored payload", async () => {
      // First store a level
      await request(app).post("/api/test-level").send(validLevelData).expect(200);

      // Then retrieve it
      const response = await request(app).get("/api/test-level").expect(200);

      expect(response.body).toEqual(validLevelData);
    });

    it("should return 404 when nothing is stored", async () => {
      const response = await request(app).get("/api/test-level").expect(404);

      expect(response.body).toEqual({ error: "No test level available" });
    });
  });

  describe("unsupported methods", () => {
    it("should return structured 405 responses", async () => {
      const methods: Array<"put" | "delete" | "patch"> = ["put", "delete", "patch"];

      for (const method of methods) {
        const response = await request(app)[method]("/api/test-level").expect(405);

        expect(response.headers.allow).toBe("GET, POST");
        expect(response.body).toEqual({
          error: "Method not allowed",
          allowedMethods: ["GET", "POST"],
        });
      }
    });
  });
});
