import { describe, expect, it, vi } from 'vitest'
import { listFixtures, loadFixture, stubFetch, stubFetchHanging, stubFetchUnreachable, type Fixture } from '../test/fetchStub'
import { REQUEST_TIMEOUT_MS, bookRoom, fetchMyBookings, fetchProfile, fetchRooms, signIn } from './client'
import type {
  BookResult,
  Booking,
  BookingRequest,
  MyBookingsFailure,
  Profile,
  ProfileFailure,
  Result,
  Room,
  RoomsFailure,
  Session,
  SignInFailure,
} from './types'

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
      timeZone: 'Asia/Jakarta',
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
      timeZone: 'Europe/London',
    },
  },
  'me-expired-token': { ok: false, reason: 'unauthorized' },
  'me-no-token': { ok: false, reason: 'unauthorized' },
  'me-unknown-token': { ok: false, reason: 'unauthorized' },
}

const ayuBody = loadFixture('profile-api.v2', 'me-ayu').response.body as Record<string, unknown>
const without = (key: string): Record<string, unknown> =>
  Object.fromEntries(Object.entries(ayuBody).filter(([k]) => k !== key))
const withoutPhone = without('phone')
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
    ['with a numeric timeZone', { ...ayuBody, timeZone: 7 }],
    ['with a null timeZone', { ...ayuBody, timeZone: null }],
  ])('fetchProfile: a 200 %s is unavailable', async (_name, body) => {
    stubFetch(answering(body))
    expect(await fetchProfile(TOKEN)).toEqual({ ok: false, reason: 'unavailable' })
  })

  it('fetchProfile: a 200 without timeZone decodes with none (D7)', async () => {
    stubFetch(answering(without('timeZone')))
    const result = await fetchProfile(TOKEN)
    expect(result).toEqual({
      ok: true,
      value: {
        id: 'u_001',
        username: 'ayu',
        displayName: 'Ayu Lestari',
        email: 'ayu@example.com',
        phone: '+62 812 3456 7890',
        memberSince: '2024-03-14',
      },
    })
    expect(result.ok && 'timeZone' in result.value).toBe(false)
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

// booking-api@v1. Each fixture's `request` names the call; its token
// placeholder is replaced by TOKEN, and only its `response` answers.
type Json = { [key: string]: any }
const bookingFixture = (name: string): Fixture => loadFixture('booking-api', name)
const bodyOf = (name: string): Json => bookingFixture(name).response.body as Json
/** The fixture with its response body edited on a deep copy. */
const editBody = (name: string, edit: (body: Json) => void): Fixture => {
  const fixture = bookingFixture(name)
  const body = structuredClone(fixture.response.body) as Json
  edit(body)
  return { ...fixture, response: { ...fixture.response, body } }
}
const roomsOf = (name: string): Room[] => bodyOf(name).rooms as Room[]
const bookingsOf = (name: string): Booking[] => bodyOf(name).bookings as Booking[]
/** `from` and `to` as the fixture's path writes them (D8: unencoded). */
const roomsQuery = (path: string): [string, string] => {
  const match = /^\/api\/rooms\?from=(.*)&to=(.*)$/.exec(path)
  if (!match) throw new Error(`not a rooms path: ${path}`)
  return [match[1] ?? '', match[2] ?? '']
}
const bearerGet = (path: string) => [{ method: 'GET', path, headers: { authorization: `Bearer ${TOKEN}` }, body: undefined }]

const roomsCases: Record<string, Result<readonly Room[], RoomsFailure>> = {
  'rooms-from-not-before-to': { ok: false, reason: 'unavailable' },
  'rooms-instant-without-milliseconds': { ok: false, reason: 'unavailable' },
  'rooms-no-token': { ok: false, reason: 'unauthorized' },
  'rooms-on-a-clock-change-day': { ok: true, value: roomsOf('rooms-on-a-clock-change-day') },
  'rooms-on-a-date': { ok: true, value: roomsOf('rooms-on-a-date') },
  'rooms-range-edges': { ok: true, value: roomsOf('rooms-range-edges') },
}

const myBookingsCases: Record<string, Result<readonly Booking[], MyBookingsFailure>> = {
  'my-bookings-budi': { ok: true, value: bookingsOf('my-bookings-budi') },
  'my-bookings-expired-token': { ok: false, reason: 'unauthorized' },
  'my-bookings-none': { ok: true, value: [] },
}

const booked = (name: string): BookResult => ({ ok: true, value: bodyOf(name) as Booking })
const conflictOf = (name: string): BookResult => ({ ok: false, reason: 'conflict', conflict: bodyOf(name).error.conflict as Booking })

const bookCases: Record<string, BookResult> = {
  'book-365-days-ahead': booked('book-365-days-ahead'),
  'book-a-room': booked('book-a-room'),
  'book-eight-hours': booked('book-eight-hours'),
  'book-end-not-after-start': { ok: false, reason: 'invalid' },
  'book-in-the-repeated-hour': booked('book-in-the-repeated-hour'),
  'book-instant-with-offset': { ok: false, reason: 'invalid' },
  'book-not-on-a-quarter-hour': { ok: false, reason: 'invalid' },
  'book-overlap': conflictOf('book-overlap'),
  'book-overlap-several': conflictOf('book-overlap-several'),
  'book-same-time-other-room': booked('book-same-time-other-room'),
  'book-started': { ok: false, reason: 'started' },
  'book-started-and-overlapping': { ok: false, reason: 'started' },
  'book-title-80-characters': booked('book-title-80-characters'),
  'book-title-blank': { ok: false, reason: 'invalid' },
  'book-title-too-long': { ok: false, reason: 'invalid' },
  'book-too-far-ahead': { ok: false, reason: 'too-far-ahead' },
  'book-too-long': { ok: false, reason: 'too-long' },
  'book-touching': booked('book-touching'),
  'book-unknown-room': { ok: false, reason: 'invalid' },
  'book-unknown-token': { ok: false, reason: 'unauthorized' },
}

const sprintPlanning: BookingRequest = {
  roomId: 'merapi',
  start: '2026-11-05T02:00:00.000Z',
  end: '2026-11-05T03:00:00.000Z',
  title: 'Sprint planning',
}

describe('API client: booking-api@v1', () => {
  it.each(Object.entries(roomsCases))('fetchRooms: %s', async (name, expected) => {
    const fixture = bookingFixture(name)
    const stub = stubFetch(fixture)
    const [from, to] = roomsQuery(fixture.request.path)
    expect(await fetchRooms(TOKEN, from, to)).toEqual(expected)
    expect(stub.calls).toEqual(bearerGet(fixture.request.path))
  })

  it.each(Object.entries(myBookingsCases))('fetchMyBookings: %s', async (name, expected) => {
    const fixture = bookingFixture(name)
    const stub = stubFetch(fixture)
    expect(await fetchMyBookings(TOKEN)).toEqual(expected)
    expect(stub.calls).toEqual(bearerGet('/api/me/bookings'))
  })

  it.each(Object.entries(bookCases))('bookRoom: %s', async (name, expected) => {
    const fixture = bookingFixture(name)
    const stub = stubFetch(fixture)
    expect(await bookRoom(TOKEN, fixture.request.body as BookingRequest)).toEqual(expected)
    expect(stub.calls).toEqual([
      {
        method: 'POST',
        path: '/api/bookings',
        headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
        body: fixture.request.body,
      },
    ])
  })

  it('bookRoom: the conflict names the other booking (G6, G18)', async () => {
    stubFetch(bookingFixture('book-overlap'))
    const result = await bookRoom(TOKEN, { ...sprintPlanning, start: '2026-11-05T02:30:00.000Z', end: '2026-11-05T03:30:00.000Z' })
    expect(result.ok === false && result.reason === 'conflict' && result.conflict).toMatchObject({
      roomName: 'Merapi',
      start: '2026-11-05T02:00:00.000Z',
      end: '2026-11-05T03:00:00.000Z',
    })
  })

  it('bookRoom sends exactly the four fields, the title as typed', async () => {
    const stub = stubFetch(bookingFixture('book-a-room'))
    const request = { ...sprintPlanning, title: '  Retro  ', note: 'x' }
    await bookRoom(TOKEN, request)
    expect(stub.calls[0]?.body).toStrictEqual({
      roomId: 'merapi',
      start: '2026-11-05T02:00:00.000Z',
      end: '2026-11-05T03:00:00.000Z',
      title: '  Retro  ',
    })
  })

  it.each<[string, (body: Json) => void]>([
    ['without a conflict', (body) => delete body.error.conflict],
    ['with a conflict without roomName', (body) => delete body.error.conflict.roomName],
    ['with a conflict start with an offset', (body) => (body.error.conflict.start = '2026-11-05T09:30:00.000+07:00')],
  ])('bookRoom: a 409 %s is unavailable (G6)', async (_name, edit) => {
    stubFetch(editBody('book-overlap', edit))
    expect(await bookRoom(TOKEN, sprintPlanning)).toEqual({ ok: false, reason: 'unavailable' })
  })

  it.each<[string, (body: Json) => void]>([
    ['an end on a date that does not exist', (body) => (body.end = '2026-02-30T00:00:00.000Z')],
    ['no id', (body) => delete body.id],
  ])('bookRoom: a 201 with %s is unavailable', async (_name, edit) => {
    stubFetch(editBody('book-a-room', edit))
    expect(await bookRoom(TOKEN, sprintPlanning)).toEqual({ ok: false, reason: 'unavailable' })
  })

  it('bookRoom drops fields it does not know in a 201 and in a conflict (G18)', async () => {
    stubFetch(editBody('book-a-room', (body) => (body.owner = 'ayu')))
    expect(await bookRoom(TOKEN, sprintPlanning)).toEqual(booked('book-a-room'))
    stubFetch(editBody('book-overlap', (body) => (body.error.conflict.owner = 'budi')))
    expect(await bookRoom(TOKEN, sprintPlanning)).toEqual(conflictOf('book-overlap'))
  })

  it("fetchRooms keeps the rooms' order (G13)", async () => {
    stubFetch(bookingFixture('rooms-on-a-date'))
    const result = await fetchRooms(TOKEN, '2026-11-05T00:00:00.000Z', '2026-11-06T00:00:00.000Z')
    expect(result.ok && result.value.map((room) => room.id)).toEqual(['merapi', 'bromo', 'thames', 'kew'])
  })

  it('fetchMyBookings keeps the order received, with no client sort (G14)', async () => {
    stubFetch(editBody('my-bookings-budi', (body) => body.bookings.reverse()))
    expect(await fetchMyBookings(TOKEN)).toEqual({ ok: true, value: [...bookingsOf('my-bookings-budi')].reverse() })
  })

  it.each<[string, (body: Json) => void]>([
    ['a booking start with an offset', (body) => (body.rooms[0].bookings[0].start = '2026-11-05T09:00:00.000+07:00')],
    ['a booking start without milliseconds', (body) => (body.rooms[0].bookings[0].start = '2026-11-05T02:00:00Z')],
    ['a booking start on a date that does not exist', (body) => (body.rooms[0].bookings[0].start = '2026-02-30T00:00:00.000Z')],
    ['a room without timeZone', (body) => delete body.rooms[1].timeZone],
    ['seats as a string', (body) => (body.rooms[0].seats = '8')],
    ['rooms that is not a list', (body) => (body.rooms = {})],
    ['a booking without title', (body) => delete body.rooms[2].bookings[0].title],
  ])('fetchRooms: a 200 with %s is unavailable', async (_name, edit) => {
    stubFetch(editBody('rooms-on-a-date', edit))
    expect(await fetchRooms(TOKEN, '2026-11-05T00:00:00.000Z', '2026-11-06T00:00:00.000Z')).toEqual({
      ok: false,
      reason: 'unavailable',
    })
  })

  it('fetchMyBookings: a 200 with an end without Z is unavailable (G1)', async () => {
    stubFetch(editBody('my-bookings-budi', (body) => (body.bookings[0].end = '2026-11-05T11:00:00.000')))
    expect(await fetchMyBookings(TOKEN)).toEqual({ ok: false, reason: 'unavailable' })
  })

  it('fetchRooms drops fields it does not know (G18)', async () => {
    stubFetch(
      editBody('rooms-on-a-date', (body) => {
        body.rooms[0].floor = 3
        body.rooms[0].bookings[0].owner = 'budi'
      }),
    )
    expect(await fetchRooms(TOKEN, '2026-11-05T00:00:00.000Z', '2026-11-06T00:00:00.000Z')).toEqual({
      ok: true,
      value: roomsOf('rooms-on-a-date'),
    })
  })
})
