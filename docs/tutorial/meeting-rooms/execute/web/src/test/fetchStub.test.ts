import { describe, expect, it } from 'vitest'
import { atPath, listFixtures, loadFixture, stubFetch, stubFetchHanging, stubFetchUnreachable, type FixtureApi } from './fetchStub'

describe('fixture-backed fetch stub', () => {
  it('lists the fixtures of each API', () => {
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
    expect(listFixtures('booking-api')).toHaveLength(35)
  })

  it("types a booking fixture's clock and given, and never sends them", async () => {
    const fixture = loadFixture('booking-api', 'book-overlap')
    const clock: string | undefined = fixture.clock
    expect(clock).toBe('2026-11-04T12:00:00.000Z')
    expect(fixture.given?.[0]?.id).toBe('00000000-0000-4000-8000-000000000023')
    stubFetch(fixture)
    const res = await fetch('/api/bookings', { method: 'POST', body: JSON.stringify(fixture.request.body) })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual(fixture.response.body)
  })

  it('answers a 204 with no body', async () => {
    stubFetch(loadFixture('booking-api', 'cancel-my-booking'))
    const res = await fetch('/api/bookings/00000000-0000-4000-8000-000000000031', { method: 'DELETE' })
    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
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

  it('answers several fixtures on one route in the order given, the last repeating', async () => {
    const budi = loadFixture('booking-api', 'my-bookings-budi')
    const none = loadFixture('booking-api', 'my-bookings-none')
    stubFetch(budi, none)
    const bodies = []
    for (let i = 0; i < 3; i++) bodies.push(await (await fetch('/api/me/bookings')).json())
    expect(bodies).toEqual([budi.response.body, none.response.body, none.response.body])
  })

  it("atPath answers a call at the named path with the fixture's response", async () => {
    const started = loadFixture('booking-api', 'cancel-started')
    stubFetch(atPath(started, '/api/bookings/00000000-0000-4000-8000-000000000011'))
    const res = await fetch('/api/bookings/00000000-0000-4000-8000-000000000011', { method: 'DELETE' })
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual(started.response.body)
    await expect(fetch(started.request.path, { method: 'DELETE' })).rejects.toThrow(
      'no fixture for DELETE /api/bookings/00000000-0000-4000-8000-000000000033',
    )
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
