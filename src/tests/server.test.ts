// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, resetTestLevelForTests } from "../../server";

describe("Server API tests", () => {
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
