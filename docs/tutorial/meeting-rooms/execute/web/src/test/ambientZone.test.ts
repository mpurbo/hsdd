// ADR-002 Consequences: every test runs in an ambient zone that is neither
// account's (Asia/Jakarta, Europe/London) nor UTC, so a time computed in the
// ambient zone fails a test instead of passing on a laptop set to either.
// The `test` and `gate` scripts set TZ=Asia/Kolkata; Node.js 24 reports it
// under its older name, Asia/Calcutta.
import { describe, expect, it } from 'vitest'

describe('ambient zone (ADR-002 Consequences)', () => {
  it('runs every test in Asia/Kolkata, neither account zone nor UTC', () => {
    expect(['Asia/Calcutta', 'Asia/Kolkata']).toContain(Intl.DateTimeFormat().resolvedOptions().timeZone)
  })
})
