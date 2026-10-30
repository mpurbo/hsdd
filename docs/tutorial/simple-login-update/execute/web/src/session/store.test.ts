import { describe, expect, it } from 'vitest'
import type { Session } from '../api/types'
import { SESSION_KEY, clearSession, loadSession, saveSession } from './store'

const session: Session = {
  token: 'q8Vn3xR2bT0kLw7YcZ1pHs5mJd9fAe4uGi6oNr2vXyQ',
  expiresAt: '2026-10-29T10:30:00.000Z',
}

describe('session store', () => {
  it('uses the D2 key', () => {
    expect(SESSION_KEY).toBe('simple-login.session')
  })

  it('round-trips a session through sessionStorage', () => {
    saveSession(session)
    expect(loadSession()).toEqual(session)
  })

  it('writes only token and expiresAt under simple-login.session', () => {
    saveSession({ ...session, tokenType: 'Bearer' } as Session)
    expect(sessionStorage.getItem('simple-login.session')).toBe(
      '{"token":"q8Vn3xR2bT0kLw7YcZ1pHs5mJd9fAe4uGi6oNr2vXyQ","expiresAt":"2026-10-29T10:30:00.000Z"}',
    )
  })

  it('has no session when nothing is stored', () => {
    expect(loadSession()).toBeNull()
  })

  it.each(['not json', '{"token":1,"expiresAt":"x"}', '{"token":"x"}', 'null', '[]'])(
    'ignores a stored value that is not a session: %s',
    (raw) => {
      sessionStorage.setItem('simple-login.session', raw)
      expect(loadSession()).toBeNull()
    },
  )

  it('returns a past-dated session as stored (D1: the server judges expiry)', () => {
    const old = { ...session, expiresAt: '2000-01-01T00:00:00.000Z' }
    saveSession(old)
    expect(loadSession()).toEqual(old)
  })

  it('clearSession removes only its own key', () => {
    saveSession(session)
    sessionStorage.setItem('other', '1')
    clearSession()
    expect(sessionStorage.getItem('simple-login.session')).toBeNull()
    expect(sessionStorage.getItem('other')).toBe('1')
  })

  it('never throws when storage throws', () => {
    const denied = (): never => {
      throw new Error('denied')
    }
    const broken = { getItem: denied, setItem: denied, removeItem: denied } as unknown as Storage
    expect(loadSession(broken)).toBeNull()
    expect(() => saveSession(session, broken)).not.toThrow()
    expect(() => clearSession(broken)).not.toThrow()
  })
})
