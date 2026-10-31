// The imperative shell around the session flow (session/flow.ts): it holds
// the state, runs GET /api/me while checking, and writes or clears storage in
// its handlers. The screen is a function of the state (D4: no router). Home
// or Rooms lives in that state, in memory only (D4); storage holds only the
// session (D2). The flow lands on Home after a sign-in or the load check, so a
// reload shows Home. An expiry is bound to the token of the session it
// renders for: App removes the stored session only while storage holds that
// token, and the reducer ignores an expiry for any other token, so a late 401
// from an earlier session cannot end a newer one (D1).
import { useCallback, useEffect, useReducer } from 'react'
import { fetchProfile } from './api/client'
import type { Session } from './api/types'
import { HomeScreen } from './home/HomeScreen'
import { LoginScreen } from './login/LoginScreen'
import { MESSAGES } from './messages'
import { RoomsScreen } from './rooms/RoomsScreen'
import { asTimeZone } from './time/time'
import { initialState, next, type Notice } from './session/flow'
import { clearSession, loadSession, saveSession } from './session/store'

const NOTICE_COPY: Readonly<Record<Notice, string>> = {
  'session-expired': MESSAGES.sessionExpired,
  unavailable: MESSAGES.unavailable,
}

export default function App() {
  const [state, dispatch] = useReducer(next, null, () => initialState(loadSession()))
  const checkingToken = state.kind === 'checking' ? state.session.token : null

  // D1: a 401 from GET /api/me ends the session here; a 401 from a
  // booking-api@v1 call ends it through `onSessionExpired` below.
  useEffect(() => {
    if (checkingToken === null) return
    let cancelled = false
    void fetchProfile(checkingToken).then((result) => {
      if (cancelled) return
      if (result.ok) {
        dispatch({ type: 'profile-loaded', profile: result.value })
      } else if (result.reason === 'unauthorized') {
        clearSession()
        dispatch({ type: 'profile-rejected' })
      } else {
        // Keep the stored session: the next load retries it.
        dispatch({ type: 'profile-unavailable' })
      }
    })
    return () => {
      cancelled = true
    }
  }, [checkingToken])

  // Synchronous, so Login unmounts in the same render batch (no second submit).
  const onSignedIn = (session: Session): void => {
    saveSession(session)
    dispatch({ type: 'signed-in', session })
  }

  // D1: a 401 from any booking-api@v1 call ends the session as GET /api/me's does.
  // Bound to the token of the session it renders for, so a screen left over
  // from an earlier session can report only that earlier token. The
  // compare-and-clear here and the reducer's token check each alone keep a
  // late 401 from ending a newer session. It changes identity only when that
  // token does.
  const signedInToken = state.kind === 'signed-in' ? state.session.token : null
  const onSessionExpired = useCallback((): void => {
    if (signedInToken === null) return
    if (loadSession()?.token === signedInToken) clearSession()
    dispatch({ type: 'session-expired', token: signedInToken })
  }, [signedInToken])

  // ADR-001: sign-out is client-side; there is no logout endpoint.
  const onSignOut = (): void => {
    clearSession()
    dispatch({ type: 'signed-out' })
  }

  switch (state.kind) {
    case 'checking':
      return (
        <main className="app-loading" aria-busy="true">
          <p>Loading…</p>
        </main>
      )
    case 'signed-in': {
      // Validated once per render (D7). Rooms needs a usable zone, so a `rooms`
      // screen without one renders Home, which then offers no Book a room.
      const zone = state.profile.timeZone === undefined ? undefined : asTimeZone(state.profile.timeZone)
      return state.screen === 'rooms' && zone !== undefined ? (
        <RoomsScreen
          token={state.session.token}
          zone={zone}
          onHome={() => dispatch({ type: 'show-home' })}
          onSessionExpired={onSessionExpired}
        />
      ) : (
        <HomeScreen
          profile={state.profile}
          token={state.session.token}
          zone={zone}
          onBookRoom={() => dispatch({ type: 'show-rooms' })}
          onSignOut={onSignOut}
          onSessionExpired={onSessionExpired}
        />
      )
    }
    case 'signed-out':
      return (
        <LoginScreen
          onSignedIn={onSignedIn}
          notice={state.notice === undefined ? undefined : NOTICE_COPY[state.notice]}
        />
      )
  }
}
