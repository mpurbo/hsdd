import { describe, expect, it, vi } from 'vitest'
import { listFixtures, loadFixture, stubFetch, stubFetchHanging, stubFetchUnreachable } from '../test/fetchStub'
import { REQUEST_TIMEOUT_MS, fetchProfile, signIn } from './client'
import type { Profile, ProfileFailure, Result, Session, SignInFailure } from './types'

const TOKEN = 'q8Vn3xR2bT0kLw7YcZ1pHs5mJd9fAe4uGi6oNr2vXyQ'

const signInCases: Record<string, Result<Session, SignInFailure>> = {
  'login-success': { ok: true, value: { token: TOKEN, expiresAt: '2026-10-29T10:30:00.000Z' } },
  'login-empty-username': { ok: false, reason: 'invalid-input' },
  'login-missing-password': { ok: false, reason: 'invalid-input' },
  'login-unknown-user': { ok: false, reason: 'invalid-credentials' },
  'login-wrong-password': { ok: false, reason: 'invalid-credentials' },
}

const profileCases: Record<string, Result<Profile, ProfileFailure>> = {
  'me-ayu': {
    ok: true,
    value: { id: 'u_001', username: 'ayu', displayName: 'Ayu Lestari', email: 'ayu@example.com', memberSince: '2024-03-14' },
  },
  'me-budi': {
    ok: true,
    value: { id: 'u_002', username: 'budi', displayName: 'Budi Santoso', email: 'budi@example.com', memberSince: '2025-01-09' },
  },
  'me-expired-token': { ok: false, reason: 'unauthorized' },
  'me-no-token': { ok: false, reason: 'unauthorized' },
  'me-unknown-token': { ok: false, reason: 'unauthorized' },
}

describe('API client', () => {
  it('maps every fixture', () => {
    // A fixture added to the contract fails here until it is mapped below.
    expect(Object.keys(signInCases).sort()).toEqual(listFixtures('auth-api').map((f) => f.name))
    expect(Object.keys(profileCases).sort()).toEqual(listFixtures('profile-api').map((f) => f.name))
  })

  it.each(Object.entries(signInCases))('signIn: %s', async (name, expected) => {
    const fixture = loadFixture('auth-api', name)
    stubFetch(fixture)
    const body = fixture.request.body as { username?: string; password?: string }
    expect(await signIn(body.username ?? '', body.password ?? '')).toEqual(expected)
  })

  it.each(Object.entries(profileCases))('fetchProfile: %s', async (name, expected) => {
    stubFetch(loadFixture('profile-api', name))
    expect(await fetchProfile(TOKEN)).toEqual(expected)
  })

  it('signIn posts the username exactly as typed', async () => {
    const stub = stubFetch(loadFixture('auth-api', 'login-unknown-user'))
    await signIn('Ayu ', 'sunrise-42')
    expect(stub.calls).toEqual([
      {
        method: 'POST',
        path: '/api/login',
        headers: { 'content-type': 'application/json' },
        body: { username: 'Ayu ', password: 'sunrise-42' },
      },
    ])
  })

  it('fetchProfile sends the token back verbatim', async () => {
    const stub = stubFetch(loadFixture('profile-api', 'me-ayu'))
    await fetchProfile(TOKEN)
    expect(stub.calls).toEqual([
      { method: 'GET', path: '/api/me', headers: { authorization: `Bearer ${TOKEN}` }, body: undefined },
    ])
  })

  it('an unreachable server is unavailable', async () => {
    stubFetchUnreachable()
    expect(await signIn('ayu', 'sunrise-42')).toEqual({ ok: false, reason: 'unavailable' })
    expect(await fetchProfile(TOKEN)).toEqual({ ok: false, reason: 'unavailable' })
  })

  it('a server that never answers is unavailable after the request timeout', async () => {
    expect(REQUEST_TIMEOUT_MS).toBe(10_000)
    vi.useFakeTimers()
    stubFetchHanging()
    const pendingSignIn = signIn('ayu', 'sunrise-42')
    const pendingProfile = fetchProfile(TOKEN)
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)
    expect(await pendingSignIn).toEqual({ ok: false, reason: 'unavailable' })
    expect(await pendingProfile).toEqual({ ok: false, reason: 'unavailable' })
  })
})
