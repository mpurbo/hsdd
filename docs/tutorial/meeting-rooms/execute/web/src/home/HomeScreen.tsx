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
 * Home as PRD v2 Screens draws it (AC-2.1, AC-2.5): the user's details in the
 * Screen's order, `phone` exactly as received, never reformatted (AC-2.4,
 * profile-api@v2), and a Time zone row showing the zone exactly as received,
 * or `Not available` without a usable one. With a zone, `MyBookings` follows,
 * given the token, the zone and `onSessionExpired`. Without one, D7's line
 * takes the place of My bookings and no booking request is sent. The parent
 * owns the session.
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
