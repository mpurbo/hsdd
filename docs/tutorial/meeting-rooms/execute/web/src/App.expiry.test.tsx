// App's two expiry guards, each pinned on its own (D1). Rooms is replaced by a
// stub that keeps the latest `onSessionExpired` it was given, so a test can
// report an expiry from a screen of an earlier session after a newer sign-in,
// which the real Rooms never does once it has unmounted.
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { RoomsScreenProps } from './rooms/RoomsScreen'
import { loadFixture, stubFetch } from './test/fetchStub'

const shownRooms = vi.hoisted(() => ({ onSessionExpired: undefined as (() => void) | undefined }))

vi.mock('./rooms/RoomsScreen', () => ({
  RoomsScreen: ({ onHome, onSessionExpired }: RoomsScreenProps) => {
    shownRooms.onSessionExpired = onSessionExpired
    return (
      <main>
        <h1>Rooms on</h1>
        <button type="button" onClick={onHome}>
          Home
        </button>
      </main>
    )
  },
}))

const TOKEN = 'q8Vn3xR2bT0kLw7YcZ1pHs5mJd9fAe4uGi6oNr2vXyQ'
const NEWER = 'Zr4kP0aW8nE2xT6mQ1vB9cY3hL7dJ5sF0gU2iO4kN8q'
const EXPIRES_AT = '2026-10-29T10:30:00.000Z'
const store = (): void => sessionStorage.setItem('simple-login.session', JSON.stringify({ token: TOKEN, expiresAt: EXPIRES_AT }))
const storedSession = (): unknown => JSON.parse(sessionStorage.getItem('simple-login.session') ?? 'null')

/** The `onSessionExpired` the stub Rooms was last given. */
const capturedExpiry = (): (() => void) => {
  const onSessionExpired = shownRooms.onSessionExpired
  if (onSessionExpired === undefined) throw new Error('Rooms was never shown')
  return onSessionExpired
}

describe('App: an expiry ends only its own session (D1)', () => {
  beforeEach(() => {
    shownRooms.onSessionExpired = undefined
  })

  it('an expiry from a screen of an earlier session neither clears nor ends the newer one (D1)', async () => {
    store()
    const login = loadFixture('auth-api', 'login-success')
    const loginBody = login.response.body as Record<string, unknown>
    stubFetch(
      loadFixture('profile-api.v2', 'me-budi'),
      loadFixture('booking-api', 'my-bookings-none'),
      { ...login, response: { ...login.response, body: { ...loginBody, token: NEWER } } },
    )
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('(no bookings)')
    await user.click(screen.getByRole('button', { name: 'Book a room' }))
    expect(screen.getByRole('heading', { name: 'Rooms on' })).toBeInTheDocument()
    const earlier = capturedExpiry()
    await user.click(screen.getByRole('button', { name: 'Home' }))
    await screen.findByText('(no bookings)')
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    await user.type(screen.getByLabelText('Username'), 'budi')
    await user.type(screen.getByLabelText('Password'), 'harbor-17')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { name: 'Hello, Budi Santoso' })).toBeInTheDocument()
    await screen.findByText('(no bookings)')
    expect(storedSession()).toEqual({ token: NEWER, expiresAt: EXPIRES_AT })

    act(() => earlier())

    // The reducer's token check keeps the newer session on screen.
    expect(screen.getByRole('heading', { name: 'Hello, Budi Santoso' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).toBeNull()
    // The compare-and-clear keeps its stored session.
    expect(storedSession()).toEqual({ token: NEWER, expiresAt: EXPIRES_AT })
  })

  it('an expiry from the current Rooms ends the session (D1)', async () => {
    store()
    stubFetch(loadFixture('profile-api.v2', 'me-budi'), loadFixture('booking-api', 'my-bookings-none'))
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('(no bookings)')
    await user.click(screen.getByRole('button', { name: 'Book a room' }))
    expect(screen.getByRole('heading', { name: 'Rooms on' })).toBeInTheDocument()

    act(() => capturedExpiry()())

    expect(screen.getByRole('status')).toHaveTextContent('Your session has expired. Please sign in again.')
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(sessionStorage.length).toBe(0)
  })
})
