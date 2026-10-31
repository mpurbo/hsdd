// A later contract version the v0.10.2 way (v0.10.0 §3.1): order-api@v2 in its own file beside the
// 06-planned stage's v1, `id: order-api`, with its own schema and fixture directory. For makeRepo's
// `files`; v1 is left as the stage has it unless `v1` says otherwise.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FIXTURES } from "./auto-standin.mjs";

export const V1 = "hsdd/contract/order-api.md";
export const V2 = "hsdd/contract/order-api.v2.md";
export const V2_SCHEMA = "hsdd/contract/schema/order-api.v2.schema.json";
export const V2_FIXTURE = "hsdd/contract/fixture/order-api.v2/create-order.json";

export const V1_TEXT = readFileSync(join(FIXTURES, "tree/06-planned/hsdd/contract/order-api.md"), "utf8");

// v1 deprecated in lockstep: its sunset is when v2's producing phase ships (v0.10.0 §3.5).
export const deprecatedV1 = V1_TEXT.replace("status: stable", "status: deprecated")
  .replace(/- v1 current\.[\s\S]*?migrate\./, "- v1 deprecated (lockstep): sunset when shop.api.3 ships; v2 replaces it.");

export const v2Text = ({ status = "draft", phaseIds = "provisional", producedBy = "[shop.api.3]", consumers = "[shop.web.app.3]", mode = "coexisting", id = "order-api", version = "v2" } = {}) => [
  "---", `id: ${id}`, `version: ${version}`, `status: ${status}`, "kind: api", "owner: shop.api", "compatibility: versioned",
  `produced_by: ${producedBy}`, `consumers: ${consumers}`, "governed_by: [ADR-001]", `phase_ids: ${phaseIds}`, "---", "",
  "# Contract: order-api", "",
  "## Interface", "",
  "As order-api@v1, except that `Order` carries `total`, `{ \"amount_cents\", \"currency\" }`,",
  "in place of `total_cents`.", "",
  "## Guarantees / invariants", "",
  "- G1: `id` matches `^ord_[0-9A-HJKMNP-TV-Z]{26}$` and never changes (ADR-001).",
  "- G2: `total.amount_cents` equals the sum of `qty * unit_cents` over the lines.", "",
  "## Versioning", "",
  `- v2 current. Migration mode: ${mode}. Migration note: read \`total.amount_cents\``,
  "  where v1 read `total_cents`.",
  "- Breaking: removing or retyping a field.", "",
  "## Validation", "",
  "- schema: hsdd/contract/schema/order-api.v2.schema.json",
  "- fixture: hsdd/contract/fixture/order-api.v2/", "",
].join("\n");

export const v2Files = (opts = {}) => ({
  [V2]: v2Text(opts),
  [V2_SCHEMA]: "{ \"$id\": \"order-api/v2\", \"$comment\": \"order-api@v2: the Order resource\" }\n",
  [V2_FIXTURE]: "{ \"$comment\": \"order-api@v2 example: create an order\" }\n",
  ...(opts.v1 === undefined ? {} : { [V1]: opts.v1 }),
});
