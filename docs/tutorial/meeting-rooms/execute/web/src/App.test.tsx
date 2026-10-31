import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
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
