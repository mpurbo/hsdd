import type { Profile } from '../api/types'
import { MESSAGES } from '../messages'
import type { ZoneName } from '../time/time'
import { formatMemberSince } from './memberSince'
import { MyBookings } from './MyBookings'
import './HomeScreen.css'

export interface HomeScreenProps {
  readonly profile: Profile
  readonly token: string
  /** Validated once by App: `undefined` means D7 (no zone, so no bookings request). */
  readonly zone: ZoneName | undefined
  readonly onSignOut: () => void
  readonly onSessionExpired: () => void
}

/**
 * The PRD's Home wireframe with update 1's Phone row (AC-2.1 amended, AC-2.4).
 * `phone` is shown exactly as received, never reformatted (profile-api@v2).
 * Presentational: the parent owns the session.
 */
export function HomeScreen({ profile, token, zone, onSignOut, onSessionExpired }: HomeScreenProps) {
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
          <dt>Time zone</dt>
          <dd>{zone ?? MESSAGES.timeZoneNotAvailable}</dd>
          <dt>Member since</dt>
          <dd>{formatMemberSince(profile.memberSince)}</dd>
        </dl>
        {zone === undefined ? (
          <p className="home-bookings-unavailable">{MESSAGES.bookingsNeedTimeZone}</p>
        ) : (
          <MyBookings token={token} zone={zone} onSessionExpired={onSessionExpired} />
        )}
        <button type="button" onClick={onSignOut}>
          Sign out
        </button>
      </section>
    </main>
  )
}
