import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { loadFixture, stubFetch, stubFetchHanging, stubFetchUnreachable } from './test/fetchStub'

const TOKEN = 'q8Vn3xR2bT0kLw7YcZ1pHs5mJd9fAe4uGi6oNr2vXyQ'
const stored = { token: TOKEN, expiresAt: '2026-10-29T10:30:00.000Z' }
const store = (s = stored): void => sessionStorage.setItem('simple-login.session', JSON.stringify(s))

describe('App: the load check (AC-2.2, AC-2.3, D1)', () => {
  it('shows Login when nothing is stored, without a request', () => {
    const stub = stubFetch(loadFixture('profile-api.v2', 'me-ayu'))
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(stub.calls).toEqual([])
  })

  it('checks a stored session and shows Home (AC-2.2)', async () => {
    store()
    const stub = stubFetch(loadFixture('profile-api.v2', 'me-ayu'), loadFixture('booking-api', 'my-bookings-none'))
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Hello, Ayu Lestari' })).toBeInTheDocument()
    expect(stub.calls.map((c) => c.headers.authorization)).toEqual([`Bearer ${TOKEN}`, `Bearer ${TOKEN}`])
  })

  it('sends an expired session to Login with the expiry message and clears it (AC-2.3, D1)', async () => {
    store()
    stubFetch(loadFixture('profile-api.v2', 'me-expired-token'))
    render(<App />)
    expect(await screen.findByRole('status')).toHaveTextContent('Your session has expired. Please sign in again.')
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(sessionStorage.getItem('simple-login.session')).toBeNull()
  })

  it('keeps the session and shows the network message when the server is unreachable on load', async () => {
    store()
    stubFetchUnreachable()
    render(<App />)
    expect(await screen.findByRole('status')).toHaveTextContent('Could not reach the server. Please try again.')
    expect(sessionStorage.getItem('simple-login.session')).toBe(JSON.stringify(stored))
  })

  it('keeps the session and shows the network message when GET /api/me answers 200 without a phone (D3, D5)', async () => {
    store()
    const ayu = loadFixture('profile-api.v2', 'me-ayu')
    const body = Object.fromEntries(
      Object.entries(ayu.response.body as Record<string, unknown>).filter(([key]) => key !== 'phone'),
    )
    stubFetch({ ...ayu, response: { status: 200, body } })
    render(<App />)
    expect(await screen.findByRole('status')).toHaveTextContent('Could not reach the server. Please try again.')
    expect(screen.queryByRole('heading', { name: 'Hello, Ayu Lestari' })).toBeNull()
    expect(sessionStorage.getItem('simple-login.session')).toBe(JSON.stringify(stored))
  })

  it.each([
    ['me-ayu', 'Hello, Ayu Lestari', '+62 812 3456 7890'],
    ['me-budi', 'Hello, Budi Santoso', '+62 813 9876 5432'],
  ])('%s: Home shows the phone number from GET /api/me, character for character (AC-2.4)', async (name, heading, phone) => {
    store()
    stubFetch(loadFixture('profile-api.v2', name), loadFixture('booking-api', 'my-bookings-none'))
    render(<App />)
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
    expect(screen.getByText('Phone').nextElementSibling?.textContent).toBe(phone)
  })

  it('shows a loading line, not Login, while the stored session is checked', () => {
    store()
    stubFetchHanging()
    render(<App />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Sign in' })).toBeNull()
  })
})

describe('App: the walk (AC-1.1, AC-2.2, AC-3.1, D2)', () => {
  it('walks Login, Home, reload, Home, Sign out, Login, writing only the token and its expiry', async () => {
    const writes: Array<[string, string]> = []
    const realSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      writes.push([key, value])
      realSetItem.call(this, key, value)
    })
    const stub = stubFetch(loadFixture('auth-api', 'login-success'), loadFixture('profile-api.v2', 'me-ayu'), loadFixture('booking-api', 'my-bookings-none'))
    const user = userEvent.setup()

    const first = render(<App />)
    await user.type(screen.getByLabelText('Username'), 'ayu')
    await user.type(screen.getByLabelText('Password'), 'sunrise-42')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { name: 'Hello, Ayu Lestari' })).toBeInTheDocument()

    first.unmount() // reload: storage survives, React state does not
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Hello, Ayu Lestari' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).toBeNull() // AC-3.1: no notice after a deliberate sign-out
    expect(sessionStorage.getItem('simple-login.session')).toBeNull()

    expect(writes).toEqual([
      [
        'simple-login.session',
        '{"token":"q8Vn3xR2bT0kLw7YcZ1pHs5mJd9fAe4uGi6oNr2vXyQ","expiresAt":"2026-10-29T10:30:00.000Z"}',
      ],
    ])
    expect(localStorage.length).toBe(0)
    expect(document.cookie).toBe('')
    // ADR-001: Sign out sends no request.
    expect(stub.calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST /api/login',
      'GET /api/me',
      'GET /api/me/bookings',
      'GET /api/me',
      'GET /api/me/bookings',
    ])
  })
})

const lines = () =>
  screen.queryAllByRole('listitem').map((li) => {
    const [first, second] = Array.from(li.querySelectorAll('p'))
    return [first?.textContent, second?.querySelector('span')?.textContent]
  })
const rowValues = () => screen.getAllByRole('term').map((dt) => [dt.textContent, dt.nextElementSibling?.textContent])

describe('App: Home with the time zone and My bookings (AC-2.1, AC-2.5, D1, D7)', () => {
  it("shows Budi's zone between Phone and Member since, then his four bookings, each with Cancel", async () => {
    store()
    stubFetch(loadFixture('profile-api.v2', 'me-budi'), loadFixture('booking-api', 'my-bookings-budi'))
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'My bookings' })).toBeInTheDocument()
    expect(rowValues().map(([k]) => k)).toEqual(['Username', 'Email', 'Phone', 'Time zone', 'Member since'])
    expect(rowValues()[3]).toEqual(['Time zone', 'Europe/London'])
    await screen.findAllByRole('listitem')
    expect(lines()).toEqual([
      ['Thu 5 Nov  09:00 to 10:00', 'Merapi · Ongoing sync'],
      ['Thu 5 Nov  10:00 to 11:00', 'Thames · Design review'],
      ['Thu 5 Nov  10:00 to 10:30', 'Kew · Quick check'],
      ['Thu 12 Nov  10:00 to 11:00', 'Merapi · Next week'],
    ])
    expect(screen.getAllByRole('button', { name: 'Cancel' })).toHaveLength(4)
  })

  it("shows Ayu's zone and (no bookings)", async () => {
    store()
    stubFetch(loadFixture('profile-api.v2', 'me-ayu'), loadFixture('booking-api', 'my-bookings-none'))
    render(<App />)
    expect(await screen.findByText('(no bookings)')).toBeInTheDocument()
    expect(rowValues()).toContainEqual(['Time zone', 'Asia/Jakarta'])
  })

  it('a 401 on the list sends Home to Login with the expiry message and clears the session (D1)', async () => {
    store()
    stubFetch(loadFixture('profile-api.v2', 'me-budi'), loadFixture('booking-api', 'my-bookings-expired-token'))
    render(<App />)
    expect(await screen.findByRole('status')).toHaveTextContent('Your session has expired. Please sign in again.')
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(sessionStorage.getItem('simple-login.session')).toBeNull()
  })

  it.each([
    ['no timeZone', undefined],
    ['a name Intl refuses', 'Mars/Olympus'],
  ])('with %s: Not available, the D7 line, and only GET /api/me is sent', async (_label, timeZone) => {
    store()
    const ayu = loadFixture('profile-api.v2', 'me-ayu')
    const { timeZone: _dropped, ...rest } = ayu.response.body as Record<string, unknown>
    const body = timeZone === undefined ? rest : { ...rest, timeZone }
    const stub = stubFetch({ ...ayu, response: { status: 200, body } }, loadFixture('booking-api', 'my-bookings-none'))
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Hello, Ayu Lestari' })).toBeInTheDocument()
    expect(rowValues()).toContainEqual(['Time zone', 'Not available'])
    expect(screen.getByText('Bookings need your time zone, which is not available.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'My bookings' })).toBeNull()
    expect(stub.calls.map((c) => `${c.method} ${c.path}`)).toEqual(['GET /api/me'])
  })
})

const NOW = '2026-11-05T09:30:00.000Z'
const NEWER = 'Zr4kP0aW8nE2xT6mQ1vB9cY3hL7dJ5sF0gU2iO4kN8q'
const ROOMS_ON_A_DATE = 'GET /api/rooms?from=2026-11-05T00:00:00.000Z&to=2026-11-06T00:00:00.000Z'
const ROOMS_ON_A_CLOCK_CHANGE_DAY = 'GET /api/rooms?from=2027-10-30T23:00:00.000Z&to=2027-11-01T00:00:00.000Z'

/** The browser's clock reads `now`; only `Date` is faked, so timers stay real (as in RoomsScreen.test.tsx). */
const clockAt = (now: string): void => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(now))
}
const routes = (calls: ReadonlyArray<{ method: string; path: string }>) => calls.map((c) => `${c.method} ${c.path}`)
const roomLines = () => Array.from(document.querySelectorAll('.rooms-list p'), (p) => p.textContent)
const dateInput = () => screen.getByLabelText<HTMLInputElement>('Rooms on')
const storedSession = (): unknown => JSON.parse(sessionStorage.getItem('simple-login.session') ?? 'null')

const signInAsBudi = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.type(screen.getByLabelText('Username'), 'budi')
  await user.type(screen.getByLabelText('Password'), 'harbor-17')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('App: Home and Rooms (AC-4.1, D1, D2, D4)', () => {
  beforeEach(() => clockAt(NOW))

  it('walks Login, Home, Book a room, Rooms, Home, Sign out, Login (D4)', async () => {
    const stub = stubFetch(
      loadFixture('auth-api', 'login-success'),
      loadFixture('profile-api.v2', 'me-budi'),
      loadFixture('booking-api', 'my-bookings-none'),
      loadFixture('booking-api', 'rooms-on-a-date'),
    )
    const user = userEvent.setup()
    render(<App />)
    await signInAsBudi(user)
    expect(await screen.findByRole('heading', { name: 'Hello, Budi Santoso' })).toBeInTheDocument()
    await screen.findByText('(no bookings)')

    await user.click(screen.getByRole('button', { name: 'Book a room' }))
    expect(screen.getByRole('heading', { name: 'Rooms on' })).toBeInTheDocument()
    expect(dateInput().value).toBe('2026-11-05')
    await waitFor(() => expect(roomLines()[0]).toBe('Merapi · Jakarta · 8 seats'))

    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(screen.getByRole('heading', { name: 'Hello, Budi Santoso' })).toBeInTheDocument()
    expect(await screen.findByText('(no bookings)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    // D4: the screen was never stored, and Sign out removed the session.
    expect(sessionStorage.length).toBe(0)
    expect(localStorage.length).toBe(0)
    expect(routes(stub.calls)).toEqual([
      'POST /api/login',
      'GET /api/me',
      'GET /api/me/bookings',
      ROOMS_ON_A_DATE,
      'GET /api/me/bookings',
    ])
  })

  it('a reload on Rooms shows Home (D2, D4)', async () => {
    store()
    stubFetch(
      loadFixture('profile-api.v2', 'me-budi'),
      loadFixture('booking-api', 'my-bookings-none'),
      loadFixture('booking-api', 'rooms-on-a-date'),
    )
    const user = userEvent.setup()
    const first = render(<App />)
    await screen.findByText('(no bookings)')
    await user.click(screen.getByRole('button', { name: 'Book a room' }))
    await waitFor(() => expect(roomLines()[0]).toBe('Merapi · Jakarta · 8 seats'))

    first.unmount() // reload: storage survives, React state does not
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Hello, Budi Santoso' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Rooms on' })).toBeNull()
    await screen.findByText('(no bookings)')
  })

  it('rooms-no-token: a 401 on Rooms lands on Login with the expiry message, nothing stored (D1)', async () => {
    store()
    stubFetch(
      loadFixture('profile-api.v2', 'me-budi'),
      loadFixture('booking-api', 'my-bookings-none'),
      loadFixture('booking-api', 'rooms-no-token'),
    )
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('(no bookings)')
    await user.click(screen.getByRole('button', { name: 'Book a room' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Your session has expired. Please sign in again.')
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(sessionStorage.getItem('simple-login.session')).toBeNull()
  })

  // App's two guards are pinned in App.expiry.test.tsx; this test covers Rooms' own drop of an answer after unmount.
  it('a late 401 from Rooms cannot clear a newer session (D1, Review Focus 3)', async () => {
    store()
    const login = loadFixture('auth-api', 'login-success')
    const loginBody = login.response.body as Record<string, unknown>
    stubFetch(
      loadFixture('profile-api.v2', 'me-budi'),
      loadFixture('booking-api', 'my-bookings-none'),
      { ...login, response: { ...login.response, body: { ...loginBody, token: NEWER } } },
    )
    // Every GET /api/rooms call is held until the test answers it; the rest go to the fixtures.
    const answered = globalThis.fetch
    const held: Array<{ readonly authorization: string | null; readonly answer: (response: Response) => void }> = []
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).startsWith('/api/rooms')
        ? new Promise<Response>((resolve) => {
            held.push({ authorization: new Headers(init?.headers).get('authorization'), answer: resolve })
          })
        : answered(input, init),
    )
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('(no bookings)')
    await user.click(screen.getByRole('button', { name: 'Book a room' }))
    expect(screen.getByRole('heading', { name: 'Rooms on' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Home' }))
    await screen.findByText('(no bookings)')
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    await signInAsBudi(user)
    expect(await screen.findByRole('heading', { name: 'Hello, Budi Santoso' })).toBeInTheDocument()
    await screen.findByText('(no bookings)')
    expect(storedSession()).toEqual({ token: NEWER, expiresAt: '2026-10-29T10:30:00.000Z' })
    // The one held call is the first session's.
    expect(held.map((call) => call.authorization)).toEqual([`Bearer ${TOKEN}`])

    const unauthorized = loadFixture('booking-api', 'rooms-no-token').response
    await act(async () => {
      held[0]?.answer(new Response(JSON.stringify(unauthorized.body), { status: unauthorized.status }))
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(screen.getByRole('heading', { name: 'Hello, Budi Santoso' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).toBeNull()
    expect(storedSession()).toEqual({ token: NEWER, expiresAt: '2026-10-29T10:30:00.000Z' })
  })

  it('Rooms opens on today each time it shows (D4)', async () => {
    store()
    const stub = stubFetch(
      loadFixture('profile-api.v2', 'me-budi'),
      loadFixture('booking-api', 'my-bookings-none'),
      loadFixture('booking-api', 'rooms-on-a-date'),
      loadFixture('booking-api', 'rooms-on-a-clock-change-day'),
    )
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('(no bookings)')
    await user.click(screen.getByRole('button', { name: 'Book a room' }))
    await waitFor(() => expect(roomLines()[0]).toBe('Merapi · Jakarta · 8 seats'))
    fireEvent.change(dateInput(), { target: { value: '2027-10-31' } })
    expect(dateInput().value).toBe('2027-10-31')
    await waitFor(() => expect(roomLines()).toContain('00:00 to 01:30 BST  Midnight launch'))

    await user.click(screen.getByRole('button', { name: 'Home' }))
    await screen.findByText('(no bookings)')
    await user.click(screen.getByRole('button', { name: 'Book a room' }))
    expect(dateInput().value).toBe('2026-11-05')
    await waitFor(() => expect(roomLines()[0]).toBe('Merapi · Jakarta · 8 seats'))
    expect(routes(stub.calls)).toEqual([
      'GET /api/me',
      'GET /api/me/bookings',
      ROOMS_ON_A_DATE,
      ROOMS_ON_A_CLOCK_CHANGE_DAY,
      'GET /api/me/bookings',
      ROOMS_ON_A_DATE,
    ])
  })

  it('without a usable zone, Book a room is not offered', async () => {
    store()
    const ayu = loadFixture('profile-api.v2', 'me-ayu')
    const { timeZone: _dropped, ...body } = ayu.response.body as Record<string, unknown>
    stubFetch({ ...ayu, response: { status: 200, body } })
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Hello, Ayu Lestari' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Book a room' })).toBeNull()
  })
})
