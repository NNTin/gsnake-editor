import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020, { type ErrorObject } from "ajv/dist/2020.js";

export interface LevelValidationDetail {
  field: string;
  keyword: string;
  message: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");

const schemaCandidatePaths = [
  path.resolve(projectRoot, "..", "contracts", "level-definition.schema.json"),
  path.resolve(projectRoot, "contracts", "level-definition.schema.json"),
];

function resolveSchemaPath(): string {
  const schemaPath = schemaCandidatePaths.find((candidatePath) => existsSync(candidatePath));
  if (!schemaPath) {
    throw new Error(
      `LevelDefinition schema not found. Checked: ${schemaCandidatePaths.join(", ")}`
    );
  }
  return schemaPath;
}

const schema = JSON.parse(readFileSync(resolveSchemaPath(), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateLevelDefinition = ajv.compile(schema);

function normalizeJsonPointer(pointer: string): string {
  if (pointer.length === 0) {
    return "";
  }

  return pointer
    .slice(1)
    .split("/")
    .map((token) => token.replace(/~1/g, "/").replace(/~0/g, "~"))
    .join(".");
}

function buildFieldPath(error: ErrorObject): string {
  const basePath = normalizeJsonPointer(error.instancePath);

  if (error.keyword === "required") {
    const params = error.params as { missingProperty?: unknown };
    if (typeof params.missingProperty === "string") {
      return basePath.length > 0 ? `${basePath}.${params.missingProperty}` : params.missingProperty;
    }
  }

  if (error.keyword === "additionalProperties") {
    const params = error.params as { additionalProperty?: unknown };
    if (typeof params.additionalProperty === "string") {
      return basePath.length > 0
        ? `${basePath}.${params.additionalProperty}`
        : params.additionalProperty;
    }
  }

  return basePath.length > 0 ? basePath : "$";
}

export function validateLevelPayload(payload: unknown): LevelValidationDetail[] {
  const isValid = validateLevelDefinition(payload);
  if (isValid) {
    return [];
  }

  return (validateLevelDefinition.errors ?? []).map((error) => ({
    field: buildFieldPath(error),
    keyword: error.keyword,
    message: error.message ?? "failed schema validation",
  }));
}
