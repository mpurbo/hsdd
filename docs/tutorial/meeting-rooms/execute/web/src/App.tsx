// The imperative shell around the session flow (session/flow.ts): it holds
// the state, runs GET /api/me while checking, and writes or clears storage in
// its handlers. The screen is a function of the state (D4: no router).
import { useCallback, useEffect, useReducer } from 'react'
import { fetchProfile } from './api/client'
import type { Session } from './api/types'
import { HomeScreen } from './home/HomeScreen'
import { LoginScreen } from './login/LoginScreen'
import { MESSAGES } from './messages'
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
  // Stable, so Home never sees a new callback identity.
  const onSessionExpired = useCallback((): void => {
    clearSession()
    dispatch({ type: 'session-expired' })
  }, [])

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
    case 'signed-in':
      return (
        <HomeScreen
          profile={state.profile}
          token={state.session.token}
          zone={state.profile.timeZone === undefined ? undefined : asTimeZone(state.profile.timeZone)}
          onSignOut={onSignOut}
          onSessionExpired={onSessionExpired}
        />
      )
    case 'signed-out':
      return (
        <LoginScreen
          onSignedIn={onSignedIn}
          notice={state.notice === undefined ? undefined : NOTICE_COPY[state.notice]}
        />
      )
  }
}
