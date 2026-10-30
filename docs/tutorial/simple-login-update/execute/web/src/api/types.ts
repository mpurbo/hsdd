// The web node's own types for auth-api@v1 and profile-api@v2 (no shared code
// package: each node writes its types from the contract's Interface).

/** What the web app keeps of a 200 from POST /api/login (D2). The token is opaque. */
export interface Session {
  readonly token: string
  readonly expiresAt: string
}

/** The six fields of a 200 from GET /api/me (profile-api@v2). `phone` is shown as given, never reformatted. */
export interface Profile {
  readonly id: string
  readonly username: string
  readonly displayName: string
  readonly email: string
  readonly phone: string
  readonly memberSince: string
}

export type SignInFailure = 'invalid-credentials' | 'invalid-input' | 'unavailable'

export type ProfileFailure = 'unauthorized' | 'unavailable'

export type Result<T, F> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: F }
