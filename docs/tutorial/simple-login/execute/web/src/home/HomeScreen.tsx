import type { Profile } from '../api/types'
import { formatMemberSince } from './memberSince'
import './HomeScreen.css'

export interface HomeScreenProps {
  readonly profile: Profile
  readonly onSignOut: () => void
}

/** The PRD's Home wireframe (AC-2.1). Presentational: the parent owns the session. */
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
