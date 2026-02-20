// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { validateLevelPayload } from "../server/levelDefinitionValidator";

type JsonObject = Record<string, unknown>;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const editorRoot = path.resolve(__dirname, "..", "..");
const canonicalSchemaPathCandidates = [
  path.resolve(editorRoot, "..", "contracts", "level-definition.schema.json"),
  path.resolve(editorRoot, "contracts", "level-definition.schema.json"),
];
const canonicalSchemaPath = canonicalSchemaPathCandidates.find((candidatePath) => {
  try {
    readFileSync(candidatePath, "utf8");
    return true;
  } catch {
    return false;
  }
});
if (!canonicalSchemaPath) {
  throw new Error(
    "LevelDefinition schema not found for editor drift test. Checked: " +
      canonicalSchemaPathCandidates.join(", ")
  );
}
const canonicalSchemaIsExternal =
  canonicalSchemaPath !== path.resolve(editorRoot, "contracts", "level-definition.schema.json");
const editorSchemaPath = path.resolve(editorRoot, "contracts", "level-definition.schema.json");

const canonicalSchema = readJson<JsonObject>(canonicalSchemaPath);
const editorSchema = readJson<JsonObject>(editorSchemaPath);

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateCanonicalLevel = ajv.compile(canonicalSchema);

const remediationMessage =
  "Synchronize schema consumers: update contracts/level-definition.schema.json, " +
  "mirror it to gsnake-editor/contracts/level-definition.schema.json, align " +
  "gsnake-web/packages/gsnake-web-app/contracts/levelDefinitionGuard.ts, then rerun " +
  "`npm run test:level-schema`, `npm test` in gsnake-editor, and `npm test` in gsnake-web.";

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function cloneFixture<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function assertConsumerParity(caseName: string, payload: unknown): void {
  const canonicalValid = validateCanonicalLevel(payload);
  const editorValid = validateLevelPayload(payload).length === 0;

  expect(
    editorValid,
    [
      `Editor validator drift for case '${caseName}'.`,
      remediationMessage,
      `Canonical errors: ${JSON.stringify(validateCanonicalLevel.errors ?? [])}`,
    ].join(" ")
  ).toBe(canonicalValid);
}

describe("LevelDefinition schema drift protection", () => {
  it("keeps editor vendored schema identical to canonical schema", () => {
    if (!canonicalSchemaIsExternal) {
      expect(true).toBe(true);
      return;
    }

    expect(
      editorSchema,
      ["Editor vendored schema drifted from canonical schema.", remediationMessage].join(" ")
    ).toEqual(canonicalSchema);
  });

  it("keeps editor validator aligned with canonical schema outcomes", () => {
    const base: JsonObject = {
      id: 101,
      name: "Fixture: Minimal Valid",
      gridSize: {
        width: 12,
        height: 10,
      },
      snake: [
        { x: 5, y: 6 },
        { x: 4, y: 6 },
      ],
      obstacles: [{ x: 2, y: 2 }],
      food: [{ x: 8, y: 5 }],
      exit: { x: 11, y: 8 },
      snakeDirection: "East",
      totalFood: 1,
    };

    const validOptionalsFixture = cloneFixture(base);
    validOptionalsFixture.difficulty = "hard";
    validOptionalsFixture.floatingFood = [{ x: 6, y: 6 }];
    validOptionalsFixture.fallingFood = [{ x: 7, y: 1 }];
    validOptionalsFixture.stones = [{ x: 5, y: 7 }];
    validOptionalsFixture.spikes = [{ x: 4, y: 8 }];
    validOptionalsFixture.exitIsSolid = true;

    const decimalId = cloneFixture(base);
    decimalId.id = 101.5;

    const decimalTotalFood = cloneFixture(base);
    decimalTotalFood.totalFood = 2.25;

    const extraProperty = cloneFixture(base);
    extraProperty.unexpectedField = true;

    const decimalGridSize = cloneFixture(base);
    (decimalGridSize.gridSize as JsonObject).width = 12.5;

    const extraPositionProperty = cloneFixture(base);
    (extraPositionProperty.exit as JsonObject).z = 99;

    const missingTotalFood = cloneFixture(base);
    delete missingTotalFood.totalFood;

    const invalidOptionalShape = cloneFixture(base);
    invalidOptionalShape.stones = [{ x: 1 }];

    const emptySnake = cloneFixture(base);
    emptySnake.snake = [];

    const negativeCoordinate = cloneFixture(base);
    (negativeCoordinate.food as JsonObject[])[0].x = -1;

    const invalidDifficulty = cloneFixture(base);
    invalidDifficulty.difficulty = "expert";

    const cases: Array<{ name: string; payload: unknown }> = [
      { name: "valid minimal fixture", payload: base },
      { name: "valid optionals fixture", payload: validOptionalsFixture },
      { name: "missing totalFood fixture", payload: missingTotalFood },
      { name: "invalid optional field fixture", payload: invalidOptionalShape },
      { name: "empty snake", payload: emptySnake },
      { name: "negative coordinate", payload: negativeCoordinate },
      { name: "invalid difficulty", payload: invalidDifficulty },
      { name: "decimal id", payload: decimalId },
      { name: "decimal totalFood", payload: decimalTotalFood },
      { name: "extra top-level property", payload: extraProperty },
      { name: "decimal gridSize.width", payload: decimalGridSize },
      { name: "extra position property", payload: extraPositionProperty },
    ];

    for (const testCase of cases) {
      assertConsumerParity(testCase.name, testCase.payload);
    }
  });
});
