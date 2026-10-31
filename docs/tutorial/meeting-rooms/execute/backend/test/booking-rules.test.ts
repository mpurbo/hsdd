import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkRoomsQuery, isInstant, isQuarterHourInstant } from "../src/booking-rules.ts";

const refused = { ok: false, error: { code: "VALIDATION_FAILED" } };

describe("the rules module is pure (ADR-002 Decision 4)", () => {
  const source = readFileSync(new URL("../src/booking-rules.ts", import.meta.url), "utf8");

  it("imports only the domain types and the rooms", () => {
    const specifiers = [...source.matchAll(/\b(?:from|import)\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(specifiers.filter((s) => s !== "./domain.ts" && s !== "./rooms.ts")).toStrictEqual([]);
    expect(source).not.toMatch(/\bimport\(|\brequire\(/);
  });

  it("reads no clock and names no time zone", () => {
    expect(source).not.toMatch(/Date\.now\(|new Date\(\)/);
    expect(source).not.toMatch(/\bIntl\b|toLocale|getTimezoneOffset|\.get(?:Hours|Minutes|Seconds|Milliseconds|Date|Day|Month|FullYear)\(/);
    expect(source).not.toMatch(/["'](?:Africa|America|Antarctica|Arctic|Asia|Atlantic|Australia|Europe|Indian|Pacific|Etc)\/|["'](?:UTC|GMT)["']/);
  });
});

describe("instants (G1, G2)", () => {
  it("G1: an instant is exactly the toISOString() form", () => {
    expect(isInstant("2026-11-05T02:00:00.000Z")).toBe(true);
    expect(isInstant("0000-01-01T00:00:00.000Z")).toBe(true);
    for (const s of ["2026-11-05T02:00:00Z", "2026-11-05T09:00:00.000+07:00", "2026-02-30T00:00:00.000Z", "2026-11-05", "", "soon"]) {
      expect(isInstant(s), s).toBe(false);
    }
  });

  it("G1: a year that is not four digits is refused, though toISOString() writes it", () => {
    expect(new Date("+010000-01-01T00:00:00.000Z").toISOString()).toBe("+010000-01-01T00:00:00.000Z");
    expect(isInstant("+010000-01-01T00:00:00.000Z")).toBe(false);
    expect(isInstant("-000001-01-01T00:00:00.000Z")).toBe(false);
  });

  it("G1: only a string is an instant", () => {
    for (const v of [Date.parse("2026-11-05T02:00:00.000Z"), null, undefined, new Date("2026-11-05T02:00:00.000Z"), ["2026-11-05T02:00:00.000Z"]]) {
      expect(isInstant(v)).toBe(false);
    }
  });

  it("G2: a quarter-hour instant has UTC minutes 00, 15, 30 or 45 and zero seconds and milliseconds", () => {
    for (const m of ["00", "15", "30", "45"]) expect(isQuarterHourInstant(`2026-11-05T02:${m}:00.000Z`)).toBe(true);
    for (const s of ["2026-11-05T02:10:00.000Z", "2026-11-05T02:15:01.000Z", "2026-11-05T02:15:00.001Z", "2026-11-05T02:15:00Z"]) {
      expect(isQuarterHourInstant(s), s).toBe(false);
    }
  });
});

describe("GET /api/rooms query (G1)", () => {
  const from = "2026-11-05T00:00:00.000Z";
  const to = "2026-11-06T00:00:00.000Z";

  it("G1: from and to are instants, from before to", () => {
    expect(checkRoomsQuery({ from, to })).toStrictEqual({ ok: true, value: { from: new Date(from), to: new Date(to) } });
  });

  it("G1: from not before to is refused", () => {
    expect(checkRoomsQuery({ from, to: from })).toStrictEqual(refused);
    expect(checkRoomsQuery({ from: to, to: from })).toStrictEqual(refused);
  });

  it("G1: a missing, repeated, empty or non-instant parameter is refused", () => {
    const bad: unknown[] = [{}, { from }, { to }, { from: [from, from], to }, { from, to: [to] }, { from: "2026-11-05T00:00:00Z", to }, { from: "", to }, null, undefined, "from=x"];
    for (const q of bad) expect(checkRoomsQuery(q), JSON.stringify(q)).toStrictEqual(refused);
  });

  it("no cap on the range, and other parameters are ignored", () => {
    expect(checkRoomsQuery({ from: "0000-01-01T00:00:00.000Z", to: "9999-12-31T23:59:59.999Z", page: "2" }).ok).toBe(true);
  });
});
