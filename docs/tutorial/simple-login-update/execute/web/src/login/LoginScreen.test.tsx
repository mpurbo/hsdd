import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { REQUEST_TIMEOUT_MS } from '../api/client'
import { loadFixture, stubFetch, stubFetchHanging, stubFetchUnreachable } from '../test/fetchStub'
import { LoginScreen, type LoginScreenProps } from './LoginScreen'

const setup = (props: Partial<LoginScreenProps> = {}) => {
  const onSignedIn = vi.fn()
  const user = userEvent.setup()
  render(<LoginScreen onSignedIn={onSignedIn} {...props} />)
  return {
    user,
    onSignedIn,
    username: screen.getByLabelText('Username'),
    password: screen.getByLabelText('Password'),
    button: screen.getByRole('button', { name: 'Sign in' }),
  }
}

const follows = (a: Node, b: Node): boolean => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

describe('LoginScreen: form and the AC-1.3 gate', () => {
  it('shows the wireframe: heading, two fields, the button', () => {
    const { username, password, button } = setup()
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(password).toHaveAttribute('type', 'password')
    expect(username).toHaveAttribute('maxLength', '64')
    expect(password).toHaveAttribute('maxLength', '128')
    expect(follows(username, password)).toBe(true)
    expect(follows(password, button)).toBe(true)
  })

  it('stops phone keyboards from rewriting the case-sensitive username', () => {
    const { username } = setup()
    expect(username).toHaveAttribute('autocapitalize', 'none')
    expect(username).toHaveAttribute('autocorrect', 'off')
    expect(username).toHaveAttribute('spellcheck', 'false')
  })

  it('disables Sign in while either field is empty (AC-1.3)', async () => {
    const { user, username, password, button } = setup()
    expect(button).toBeDisabled()
    await user.type(username, 'ayu')
    expect(button).toBeDisabled()
    await user.type(password, 'x')
    expect(button).toBeEnabled()
    await user.clear(username)
    expect(button).toBeDisabled()
  })

  it('counts a username of spaces as typed', async () => {
    const { user, username, password, button } = setup()
    await user.type(username, '   ')
    await user.type(password, 'x')
    expect(button).toBeEnabled()
  })

  it('sends nothing when Enter is pressed with a field empty', async () => {
    const stub = stubFetch(loadFixture('auth-api', 'login-success'))
    const { user, username } = setup()
    await user.type(username, 'ayu{Enter}')
    expect(stub.calls).toEqual([])
  })
})

describe('LoginScreen: signing in (AC-1.1)', () => {
  it('hands the session to its parent on success (AC-1.1)', async () => {
    const stub = stubFetch(loadFixture('auth-api', 'login-success'))
    const { user, username, password, button, onSignedIn } = setup()
    await user.type(username, 'ayu')
    await user.type(password, 'sunrise-42')
    await user.click(button)
    await waitFor(() =>
      expect(onSignedIn).toHaveBeenCalledWith({
        token: 'q8Vn3xR2bT0kLw7YcZ1pHs5mJd9fAe4uGi6oNr2vXyQ',
        expiresAt: '2026-10-29T10:30:00.000Z',
      }),
    )
    expect(onSignedIn).toHaveBeenCalledTimes(1)
    expect(stub.calls.map((c) => c.body)).toEqual([{ username: 'ayu', password: 'sunrise-42' }])
  })

  // Fake timers only for the in-flight period: Testing Library's async
  // wrapper (user-event, waitFor, findBy) waits on a real setTimeout(0) under
  // Vitest's fake timers and hangs, so these tests type with real timers,
  // then fake the clock and use fireEvent.
  it('is busy while the request is in flight and sends one request', async () => {
    const stub = stubFetchHanging()
    const { user, username, password, button } = setup()
    await user.type(username, 'ayu')
    await user.type(password, 'sunrise-42')
    vi.useFakeTimers()
    fireEvent.click(button)
    const busy = screen.getByRole('button', { name: 'Signing in…' })
    expect(busy).toBeDisabled()
    const form = busy.closest('form')!
    expect(form).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(busy)
    fireEvent.submit(form)
    expect(stub.calls).toHaveLength(1)
  })

  it('ends the busy state with the network message when the server never answers', async () => {
    stubFetchHanging()
    const { user, username, password, button } = setup()
    await user.type(username, 'ayu')
    await user.type(password, 'sunrise-42')
    vi.useFakeTimers()
    fireEvent.click(button)
    await act(() => vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS))
    expect(screen.getByRole('alert')).toHaveTextContent('Could not reach the server. Please try again.')
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })
})

describe('LoginScreen: failures (AC-1.2, D3)', () => {
  it.each(['login-wrong-password', 'login-unknown-user'])(
    '%s: shows the AC-1.2 message, keeps the username, clears and focuses the password',
    async (name) => {
      stubFetch(loadFixture('auth-api', name))
      const { user, username, password, button, onSignedIn } = setup()
      await user.type(username, 'ayu')
      await user.type(password, 'sunset-42')
      await user.click(button)
      expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect username or password.')
      expect(username).toHaveValue('ayu')
      expect(password).toHaveValue('')
      expect(password).toHaveFocus()
      expect(onSignedIn).not.toHaveBeenCalled()
    },
  )

  it('shows the AC-1.2 message for a 400 (invalid-input)', async () => {
    stubFetch(loadFixture('auth-api', 'login-empty-username'))
    const { user, username, password, button } = setup()
    await user.type(username, 'ayu')
    await user.type(password, 'x')
    await user.click(button)
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect username or password.')
  })

  it('shows the network message and keeps both fields when the server is unreachable', async () => {
    stubFetchUnreachable()
    const { user, username, password, button } = setup()
    await user.type(username, 'ayu')
    await user.type(password, 'sunrise-42')
    await user.click(button)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server. Please try again.')
    expect(username).toHaveValue('ayu')
    expect(password).toHaveValue('sunrise-42')
  })

  it('sends the username exactly as typed', async () => {
    const stub = stubFetch(loadFixture('auth-api', 'login-unknown-user'))
    const { user, username, password, button } = setup()
    await user.type(username, 'Ayu ')
    await user.type(password, 'sunrise-42')
    await user.click(button)
    await screen.findByRole('alert')
    expect(stub.calls.map((c) => c.body)).toEqual([{ username: 'Ayu ', password: 'sunrise-42' }])
  })

  it('a successful retry after a failure hands the session up', async () => {
    stubFetch(loadFixture('auth-api', 'login-wrong-password'))
    const { user, username, password, button, onSignedIn } = setup()
    await user.type(username, 'ayu')
    await user.type(password, 'sunset-42')
    await user.click(button)
    await screen.findByRole('alert')
    stubFetch(loadFixture('auth-api', 'login-success'))
    await user.type(password, 'sunrise-42')
    await user.click(button)
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1))
  })
})

describe("LoginScreen: the parent's notice", () => {
  const notice = 'Your session has expired. Please sign in again.'

  it('shows the notice its parent passes in, under the button', () => {
    const { button } = setup({ notice })
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(notice)
    expect(follows(button, status)).toBe(true)
  })

  it('replaces the notice once the user submits', async () => {
    stubFetch(loadFixture('auth-api', 'login-wrong-password'))
    const { user, username, password, button } = setup({ notice })
    await user.type(username, 'ayu')
    await user.type(password, 'sunset-42')
    await user.click(button)
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect username or password.')
    expect(screen.queryByText(notice)).toBeNull()
  })
})
