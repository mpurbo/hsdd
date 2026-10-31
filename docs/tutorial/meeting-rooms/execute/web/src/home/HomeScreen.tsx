import type { Profile } from '../api/types'
import { formatMemberSince } from './memberSince'
import './HomeScreen.css'

export interface HomeScreenProps {
  readonly profile: Profile
  readonly onSignOut: () => void
}

/**
 * The PRD's Home wireframe with update 1's Phone row (AC-2.1 amended, AC-2.4).
 * `phone` is shown exactly as received, never reformatted (profile-api@v2).
 * Presentational: the parent owns the session.
 */
export function HomeScreen({ profile, onSignOut }: HomeScreenProps) {
  return (
    <main className="home">
      <section className="home-card">
        <h1>Hello, {profile.displayName}</h1>
        <dl className="home-details">
          <dt>Username</dt>
          <dd>{profile.username}</dd>
          <dt>Email</dt>
          <dd>{profile.email}</dd>
          <dt>Phone</dt>
          <dd>{profile.phone}</dd>
          <dt>Member since</dt>
          <dd>{formatMemberSince(profile.memberSince)}</dd>
        </dl>
        <button type="button" onClick={onSignOut}>
          Sign out
        </button>
      </section>
    </main>
  )
}
