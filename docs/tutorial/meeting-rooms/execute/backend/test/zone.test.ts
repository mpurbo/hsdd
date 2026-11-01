// ADR-002 Consequences: every test runs in an ambient zone that is neither
// account's nor UTC, so a time computed in the ambient zone fails here instead
// of passing on a laptop set to Jakarta, London or UTC.
import { describe, expect, it } from "vitest";

describe("ambient time zone", () => {
  it("runs in Asia/Kolkata, neither account's zone nor UTC (ADR-002 Consequences)", () => {
    // Intl reports Asia/Kolkata under its older name, Asia/Calcutta.
    expect(["Asia/Kolkata", "Asia/Calcutta"]).toContain(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(new Date("2026-11-05T00:00:00.000Z").getTimezoneOffset()).toBe(-330);
  });
});
