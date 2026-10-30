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
    const stub = stubFetch(loadFixture('profile-api.v2', 'me-ayu'))
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Hello, Ayu Lestari' })).toBeInTheDocument()
    expect(stub.calls.map((c) => c.headers.authorization)).toEqual([`Bearer ${TOKEN}`])
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
    const stub = stubFetch(loadFixture('auth-api', 'login-success'), loadFixture('profile-api.v2', 'me-ayu'))
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
    expect(stub.calls.map((c) => `${c.method} ${c.path}`)).toEqual(['POST /api/login', 'GET /api/me', 'GET /api/me'])
  })
})
