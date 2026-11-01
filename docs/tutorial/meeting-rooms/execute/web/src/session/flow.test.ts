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
const signedIn: AppState = { kind: 'signed-in', session, profile, screen: 'home' }
const onRooms: AppState = { ...signedIn, screen: 'rooms' }
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
    [
      'a 401 on a signed-in screen shows Login with the expiry notice (D1)',
      signedIn,
      { type: 'session-expired', token: session.token },
      { kind: 'signed-out', notice: 'session-expired' },
    ],
    ['Book a room shows Rooms (D4)', signedIn, { type: 'show-rooms' }, onRooms],
    ['Home on Rooms shows Home (D4)', onRooms, { type: 'show-home' }, signedIn],
    [
      'a 401 on Rooms shows Login with the expiry notice (D1)',
      onRooms,
      { type: 'session-expired', token: session.token },
      { kind: 'signed-out', notice: 'session-expired' },
    ],
  ])('%s', (_name, from, event, to) => {
    expect(next(from, event)).toEqual(to)
  })

  it.each<[string, AppState, AppEvent]>([
    ['a stale profile after sign-out', signedOut, { type: 'profile-loaded', profile }],
    ['a stale rejection on Home', signedIn, { type: 'profile-rejected' }],
    ['a second sign-in while checking', checking, { type: 'signed-in', session }],
    ['a sign-out while signed out', signedOut, { type: 'signed-out' }],
    ['a stale expiry while signed out', signedOut, { type: 'session-expired', token: session.token }],
    ['an expiry while checking', checking, { type: 'session-expired', token: session.token }],
    ["an expiry for another session's token", signedIn, { type: 'session-expired', token: 'another-token' }],
    ["an expiry for another session's token on Rooms", onRooms, { type: 'session-expired', token: 'another-token' }],
    ['Book a room while signed out', signedOut, { type: 'show-rooms' }],
    ['Home while checking', checking, { type: 'show-home' }],
  ])('ignores an event that does not apply: %s', (_name, from, event) => {
    expect(next(from, event)).toBe(from)
  })
})
