import { useEffect, useRef, useState, type FormEvent } from 'react'
import { signIn } from '../api/client'
import type { Session, SignInFailure } from '../api/types'
import { MESSAGES } from '../messages'
import './LoginScreen.css'

export interface LoginScreenProps {
  readonly onSignedIn: (session: Session) => void
  /** A message from the parent, shown in the message slot until the first submit. */
  readonly notice?: string
}

type Status =
  | { readonly kind: 'idle' }
  | { readonly kind: 'busy' }
  | { readonly kind: 'failed'; readonly reason: SignInFailure }

/** D3: one message per failure. `invalid-input` cannot come from this form (see the plan's design notes). */
const messageFor = (reason: SignInFailure): string =>
  reason === 'unavailable' ? MESSAGES.unavailable : MESSAGES.invalidCredentials

export function LoginScreen({ onSignedIn, notice }: LoginScreenProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [submitted, setSubmitted] = useState(false)
  const passwordRef = useRef<HTMLInputElement>(null)
  const busy = status.kind === 'busy'
  const canSubmit = username !== '' && password !== ''

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!canSubmit || busy) return
    setSubmitted(true)
    setStatus({ kind: 'busy' })
    const result = await signIn(username, password)
    if (result.ok) {
      setStatus({ kind: 'idle' })
      onSignedIn(result.value)
      return
    }
    setStatus({ kind: 'failed', reason: result.reason })
    // AC-1.2: keep the username; the password is retyped. After `unavailable`
    // nothing was wrong with what was typed, so both fields stay.
    if (result.reason !== 'unavailable') setPassword('')
  }

  // Focus follows the clear: the password field is where the retry starts.
  useEffect(() => {
    if (status.kind === 'failed' && status.reason !== 'unavailable') passwordRef.current?.focus()
  }, [status])

  return (
    <main className="login">
      <form className="login-card" noValidate aria-busy={busy} onSubmit={submit}>
        <h1>Sign in</h1>
        <label className="login-field">
          <span>Username</span>
          <input
            name="username"
            autoComplete="username"
            // auth-api@v1 matches usernames exactly: no keyboard capitalization or correction.
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={64}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label className="login-field">
          <span>Password</span>
          <input
            ref={passwordRef}
            name="password"
            type="password"
            autoComplete="current-password"
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button type="submit" disabled={!canSubmit || busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        {status.kind === 'failed' ? (
          <p className="login-message" role="alert">
            {messageFor(status.reason)}
          </p>
        ) : notice !== undefined && !submitted ? (
          <p className="login-message" role="status">
            {notice}
          </p>
        ) : (
          <p className="login-message" />
        )}
      </form>
    </main>
  )
}
