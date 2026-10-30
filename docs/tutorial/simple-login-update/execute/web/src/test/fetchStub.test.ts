import { describe, expect, it } from 'vitest'
import { listFixtures, loadFixture, stubFetch, stubFetchHanging, stubFetchUnreachable, type FixtureApi } from './fetchStub'

describe('fixture-backed fetch stub', () => {
  it('lists the five fixtures of each API', () => {
    expect(listFixtures('auth-api').map((f) => f.name)).toEqual([
      'login-empty-username',
      'login-missing-password',
      'login-success',
      'login-unknown-user',
      'login-wrong-password',
    ])
    expect(listFixtures('profile-api.v2').map((f) => f.name)).toEqual([
      'me-ayu',
      'me-budi',
      'me-expired-token',
      'me-no-token',
      'me-unknown-token',
    ])
  })

  it('refuses the profile-api@v1 fixtures: this node consumes profile-api@v2', () => {
    const retired = 'profile-api' as FixtureApi
    expect(() => loadFixture(retired, 'me-ayu')).toThrow('no fixture set profile-api')
    expect(() => listFixtures(retired)).toThrow('no fixture set profile-api')
  })

  it('answers a matching call with the fixture response and records it', async () => {
    const fixture = loadFixture('auth-api', 'login-success')
    const stub = stubFetch(fixture)
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ayu', password: 'sunrise-42' }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(fixture.response.body)
    expect(stub.calls).toEqual([
      {
        method: 'POST',
        path: '/api/login',
        headers: { 'content-type': 'application/json' },
        body: { username: 'ayu', password: 'sunrise-42' },
      },
    ])
  })

  it('rejects a call no fixture matches', async () => {
    stubFetch(loadFixture('auth-api', 'login-success'))
    await expect(fetch('/api/me')).rejects.toThrow('no fixture for GET /api/me')
  })

  it('refuses two fixtures on one route', () => {
    expect(() =>
      stubFetch(loadFixture('auth-api', 'login-success'), loadFixture('auth-api', 'login-wrong-password')),
    ).toThrow('two fixtures for POST /api/login')
  })

  it('simulates an unreachable server', async () => {
    stubFetchUnreachable()
    await expect(fetch('/api/login', { method: 'POST' })).rejects.toBeInstanceOf(TypeError)
  })

  it('simulates a server that never answers, until the request is aborted', async () => {
    stubFetchHanging()
    const controller = new AbortController()
    const pending = fetch('/api/me', { signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
})
