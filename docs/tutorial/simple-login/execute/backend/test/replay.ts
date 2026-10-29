// Contract replay rig: loads a contract's fixtures and schema from hsdd/ and
// checks real responses against them. Test-side code; the service never
// reads hsdd/ at runtime.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ajv2020 from "ajv/dist/2020.js";
import ajvFormats from "ajv-formats";

// Both packages are CommonJS; under nodenext their classes sit on `.default`.
const Ajv2020 = ajv2020.default;
const addFormats = ajvFormats.default;

export type ContractSlug = "auth-api" | "profile-api";

export type Fixture = {
  name: string;
  description: string;
  request: { method: "GET" | "POST"; path: string; headers: Record<string, string>; body?: unknown };
  response: { status: number; body: unknown };
  replay: "exact" | "schema";
};

const CONTRACT_DIR = fileURLToPath(new URL("../../hsdd/contract/", import.meta.url));

export function loadFixtures(slug: ContractSlug, dir = join(CONTRACT_DIR, "fixture", slug)): Fixture[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => JSON.parse(readFileSync(join(dir, file), "utf8")) as Fixture);
}

/** Returns the schema violations of one response; an empty array means valid. */
export function responseValidator(slug: ContractSlug): (response: { status: number; body: unknown }) => string[] {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  const schema = JSON.parse(readFileSync(join(CONTRACT_DIR, "schema", `${slug}.schema.json`), "utf8"));
  const validate = ajv.compile(schema);
  return (response) =>
    validate(response) ? [] : (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? "invalid"}`);
}
