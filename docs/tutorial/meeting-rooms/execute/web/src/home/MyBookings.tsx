import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { fetchMyBookings } from '../api/client'
import type { Booking } from '../api/types'
import { MESSAGES } from '../messages'
import type { ZoneName } from '../time/time'
import { bookingLine } from './bookingLines'

export interface MyBookingsProps {
  readonly token: string
  readonly zone: ZoneName
  readonly onSessionExpired: () => void
}

type ListState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly bookings: readonly Booking[] }
  | { readonly kind: 'unavailable' }

/**
 * The user's bookings (AC-6.1). The list on screen is always the last answer of
 * GET /api/me/bookings (design note 2). Latest request wins, and an answer
 * after unmount is dropped, `onSessionExpired` included (design note 3).
 */
export function MyBookings({ token, zone, onSessionExpired }: MyBookingsProps) {
  const headingId = useId()
  const [list, setList] = useState<ListState>({ kind: 'loading' })
  const alive = useRef(false)
  const newest = useRef(0)
  // Design note 4: read through a ref, so a new callback identity never refetches.
  const onSessionExpiredRef = useRef(onSessionExpired)
  onSessionExpiredRef.current = onSessionExpired

  // Settles after its answer has been applied, or dropped as stale or after unmount.
  const load = useCallback(async (): Promise<void> => {
    const mine = ++newest.current
    const result = await fetchMyBookings(token)
    if (!alive.current || mine !== newest.current) return
    if (result.ok) setList({ kind: 'loaded', bookings: result.value })
    else if (result.reason === 'unauthorized') onSessionExpiredRef.current()
    else setList({ kind: 'unavailable' })
  }, [token])

  useEffect(() => {
    alive.current = true
    void load()
    return () => {
      alive.current = false
    }
  }, [load])

  return (
    <section className="home-bookings" aria-labelledby={headingId}>
      <h2 id={headingId}>My bookings</h2>
      {list.kind === 'loading' ? (
        <p>Loading…</p>
      ) : list.kind === 'unavailable' ? (
        <p role="status">{MESSAGES.unavailable}</p>
      ) : list.bookings.length === 0 ? (
        <p>{MESSAGES.noBookings}</p>
      ) : (
        <ul className="home-booking-list">
          {list.bookings.map((booking) => {
            const line = bookingLine(booking, zone)
            return (
              <li key={line.id}>
                <p className="home-booking-when">{line.when}</p>
                <p className="home-booking-what">
                  <span>{line.what}</span>
                  <button type="button">Cancel</button>
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
