import { describe, expect, it, vi } from 'vitest'
import { listFixtures, loadFixture, stubFetch, stubFetchHanging, stubFetchUnreachable, type Fixture } from '../test/fetchStub'
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
    value: {
      id: 'u_001',
      username: 'ayu',
      displayName: 'Ayu Lestari',
      email: 'ayu@example.com',
      phone: '+62 812 3456 7890',
      memberSince: '2024-03-14',
    },
  },
  'me-budi': {
    ok: true,
    value: {
      id: 'u_002',
      username: 'budi',
      displayName: 'Budi Santoso',
      email: 'budi@example.com',
      phone: '+62 813 9876 5432',
      memberSince: '2025-01-09',
    },
  },
  'me-expired-token': { ok: false, reason: 'unauthorized' },
  'me-no-token': { ok: false, reason: 'unauthorized' },
  'me-unknown-token': { ok: false, reason: 'unauthorized' },
}

const ayuBody = loadFixture('profile-api.v2', 'me-ayu').response.body as Record<string, unknown>
const withoutPhone = Object.fromEntries(Object.entries(ayuBody).filter(([key]) => key !== 'phone'))
/** me-ayu's 200 with `body` in place of the fixture's profile. */
const answering = (body: unknown): Fixture => ({ ...loadFixture('profile-api.v2', 'me-ayu'), response: { status: 200, body } })

describe('API client', () => {
  it('maps every fixture', () => {
    // A fixture added to the contract fails here until it is mapped below.
    expect(Object.keys(signInCases).sort()).toEqual(listFixtures('auth-api').map((f) => f.name))
    expect(Object.keys(profileCases).sort()).toEqual(listFixtures('profile-api.v2').map((f) => f.name))
  })

  it.each(Object.entries(signInCases))('signIn: %s', async (name, expected) => {
    const fixture = loadFixture('auth-api', name)
    stubFetch(fixture)
    const body = fixture.request.body as { username?: string; password?: string }
    expect(await signIn(body.username ?? '', body.password ?? '')).toEqual(expected)
  })

  it.each(Object.entries(profileCases))('fetchProfile: %s', async (name, expected) => {
    stubFetch(loadFixture('profile-api.v2', name))
    expect(await fetchProfile(TOKEN)).toEqual(expected)
  })

  it.each<[string, unknown]>([
    ['without a phone (a profile-api@v1 answer)', withoutPhone],
    ['with a null phone', { ...ayuBody, phone: null }],
    ['with a numeric phone', { ...ayuBody, phone: 6281234567890 }],
  ])('fetchProfile: a 200 %s is unavailable', async (_name, body) => {
    stubFetch(answering(body))
    expect(await fetchProfile(TOKEN)).toEqual({ ok: false, reason: 'unavailable' })
  })

  it('fetchProfile ignores fields it does not know (profile-api@v2)', async () => {
    stubFetch(answering({ ...ayuBody, nickname: 'Ayu' }))
    expect(await fetchProfile(TOKEN)).toEqual(profileCases['me-ayu'])
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
    const stub = stubFetch(loadFixture('profile-api.v2', 'me-ayu'))
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
