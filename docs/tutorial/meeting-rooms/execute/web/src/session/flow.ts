// The session flow as a pure state machine (D4: the screen is a function of
// the app state). App is the shell: it runs the effects and dispatches
// these events. An event that does not apply to the current state returns
// the state unchanged, so a stale response can never show someone's Home.
// The screen (Home or Rooms) lives here, in memory only (D4); a reload, a
// sign-in and the load check all land on Home. An expiry names the token whose
// request answered 401 and applies only to that session (D1).
import type { Profile, Session } from '../api/types'

/** The signed-in screens (D4). */
export type Screen = 'home' | 'rooms'

/** Why Login is shown, when it is not a plain signed-out start. */
export type Notice = 'session-expired' | 'unavailable'

export type AppState =
  | { readonly kind: 'checking'; readonly session: Session }
  | { readonly kind: 'signed-in'; readonly session: Session; readonly profile: Profile; readonly screen: Screen }
  | { readonly kind: 'signed-out'; readonly notice?: Notice }

export type AppEvent =
  | { readonly type: 'signed-in'; readonly session: Session }
  | { readonly type: 'profile-loaded'; readonly profile: Profile }
  | { readonly type: 'profile-rejected' }
  | { readonly type: 'profile-unavailable' }
  | { readonly type: 'signed-out' }
  | { readonly type: 'show-rooms' }
  | { readonly type: 'show-home' }
  | { readonly type: 'session-expired'; readonly token: string }

/** A stored session is checked with GET /api/me before Home shows (AC-2.2, D1). */
export function initialState(stored: Session | null): AppState {
  return stored === null ? { kind: 'signed-out' } : { kind: 'checking', session: stored }
}

export function next(state: AppState, event: AppEvent): AppState {
  switch (state.kind) {
    case 'checking':
      switch (event.type) {
        case 'profile-loaded':
          return { kind: 'signed-in', session: state.session, profile: event.profile, screen: 'home' }
        case 'profile-rejected':
          return { kind: 'signed-out', notice: 'session-expired' }
        case 'profile-unavailable':
          return { kind: 'signed-out', notice: 'unavailable' }
        default:
          return state
      }
    case 'signed-out':
      return event.type === 'signed-in' ? { kind: 'checking', session: event.session } : state
    case 'signed-in':
      switch (event.type) {
        case 'signed-out':
          return { kind: 'signed-out' }
        case 'show-rooms':
          return { ...state, screen: 'rooms' }
        case 'show-home':
          return { ...state, screen: 'home' }
        case 'session-expired':
          return event.token === state.session.token
            ? { kind: 'signed-out', notice: 'session-expired' }
            : state
        default:
          return state
      }
  }
}
