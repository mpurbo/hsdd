import { describe, expect, it } from 'vitest'
import type { Profile, Session } from '../api/types'
import { loadFixture } from '../test/fetchStub'
import { initialState, next, type AppEvent, type AppState } from './flow'

const session: Session = {
  token: 'q8Vn3xR2bT0kLw7YcZ1pHs5mJd9fAe4uGi6oNr2vXyQ',
  expiresAt: '2026-10-29T10:30:00.000Z',
}
const profile = loadFixture('profile-api.v2', 'me-ayu').response.body as Profile
const checking: AppState = { kind: 'checking', session }
const signedIn: AppState = { kind: 'signed-in', session, profile }
const signedOut: AppState = { kind: 'signed-out' }

describe('session flow', () => {
  it('starts by checking a stored session', () => {
    expect(initialState(session)).toEqual(checking)
  })

  it('starts signed out with nothing stored', () => {
    expect(initialState(null)).toEqual(signedOut)
  })

  it.each<[string, AppState, AppEvent, AppState]>([
    ['a loaded profile shows Home', checking, { type: 'profile-loaded', profile }, signedIn],
    [
      'a rejected token shows Login with the expiry notice',
      checking,
      { type: 'profile-rejected' },
      { kind: 'signed-out', notice: 'session-expired' },
    ],
    [
      'an unreachable server shows Login with the network notice',
      checking,
      { type: 'profile-unavailable' },
      { kind: 'signed-out', notice: 'unavailable' },
    ],
    ['signing in checks the new session', signedOut, { type: 'signed-in', session }, checking],
    [
      'signing in from an expiry notice checks the new session',
      { kind: 'signed-out', notice: 'session-expired' },
      { type: 'signed-in', session },
      checking,
    ],
    ['signing out shows Login without a notice', signedIn, { type: 'signed-out' }, signedOut],
  ])('%s', (_name, from, event, to) => {
    expect(next(from, event)).toEqual(to)
  })

  it.each<[string, AppState, AppEvent]>([
    ['a stale profile after sign-out', signedOut, { type: 'profile-loaded', profile }],
    ['a stale rejection on Home', signedIn, { type: 'profile-rejected' }],
    ['a second sign-in while checking', checking, { type: 'signed-in', session }],
    ['a sign-out while signed out', signedOut, { type: 'signed-out' }],
  ])('ignores an event that does not apply: %s', (_name, from, event) => {
    expect(next(from, event)).toBe(from)
  })
})
