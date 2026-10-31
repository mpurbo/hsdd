import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { cancelBooking, fetchMyBookings } from '../api/client'
import type { Booking, CancelFailure } from '../api/types'
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
 * The notice above the list after a Cancel (design note 6): D10's message for
 * a refusal, D3's for anything else. The client decides the failure from
 * `error.code` alone, so `error.message` never reaches the screen (D10).
 * `unauthorized` has no notice: it ends the session (D1).
 */
const CANCEL_NOTICE: Readonly<Record<Exclude<CancelFailure, 'unauthorized'>, string>> = {
  started: MESSAGES.cancelStarted,
  'not-found': MESSAGES.cancelNotFound,
  'not-yours': MESSAGES.cancelNotYours,
  unavailable: MESSAGES.unavailable,
}

const including = (ids: ReadonlySet<string>, id: string): ReadonlySet<string> => new Set([...ids, id])

const excluding = (ids: ReadonlySet<string>, id: string): ReadonlySet<string> =>
  new Set([...ids].filter((other) => other !== id))

/**
 * The user's bookings (AC-6.1), each with Cancel (AC-6.2, D9). The list on
 * screen is always the last answer of GET /api/me/bookings, never edited here
 * (design note 2). Latest request wins, and an answer after unmount is
 * dropped, `onSessionExpired` included (design note 3).
 */
export function MyBookings({ token, zone, onSessionExpired }: MyBookingsProps) {
  const headingId = useId()
  const [list, setList] = useState<ListState>({ kind: 'loading' })
  const [notice, setNotice] = useState<string | undefined>(undefined)
  // Ids whose Cancel is in flight. Each stays busy until its DELETE and the
  // refetch it triggers have settled (design note 2).
  const [cancelling, setCancelling] = useState<ReadonlySet<string>>(() => new Set())
  const alive = useRef(false)
  const newest = useRef(0)
  // Design note 4: read through a ref, so a new callback identity never
  // refetches. Written in a layout effect, not during render; it commits
  // before any answer can arrive.
  const onSessionExpiredRef = useRef(onSessionExpired)
  useLayoutEffect(() => {
    onSessionExpiredRef.current = onSessionExpired
  })

  // The promise of the newest `load()` call.
  const latestLoad = useRef<Promise<void>>(Promise.resolve())

  // Settles once the list on screen comes from a request made no earlier than
  // this one, or at once after unmount. A stale answer is dropped and the call
  // settles with the newest call's promise, read from `latestLoad` when the
  // answer arrives, so a chain of supersessions resolves through the ref. A
  // Cancel awaiting it therefore stays busy until the list it shows postdates
  // the DELETE (design note 2).
  const load = useCallback((): Promise<void> => {
    const mine = ++newest.current
    const settled = (async (): Promise<void> => {
      const result = await fetchMyBookings(token)
      if (!alive.current) return
      if (mine !== newest.current) return latestLoad.current
      if (result.ok) setList({ kind: 'loaded', bookings: result.value })
      else if (result.reason === 'unauthorized') onSessionExpiredRef.current()
      else setList({ kind: 'unavailable' })
    })()
    latestLoad.current = settled
    return settled
  }, [token])

  useEffect(() => {
    alive.current = true
    void load()
    return () => {
      alive.current = false
    }
  }, [load])

  const cancel = async (id: string): Promise<void> => {
    setNotice(undefined)
    setCancelling((ids) => including(ids, id))
    const result = await cancelBooking(token, id)
    if (!alive.current) return
    if (result.ok) {
      await load()
    } else if (result.reason === 'unauthorized') {
      onSessionExpiredRef.current()
      return
    } else {
      setNotice(CANCEL_NOTICE[result.reason])
      // D3 keeps the list as it is; a refusal shows it fetched again (design note 6).
      if (result.reason !== 'unavailable') await load()
    }
    setCancelling((ids) => excluding(ids, id))
  }

  return (
    <section className="home-bookings" aria-labelledby={headingId}>
      <h2 id={headingId}>My bookings</h2>
      {notice === undefined ? null : <p role="status">{notice}</p>}
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
            const busy = cancelling.has(booking.id)
            return (
              <li key={line.id}>
                <p className="home-booking-when">{line.when}</p>
                <p className="home-booking-what">
                  <span>{line.what}</span>
                  <button type="button" disabled={busy} onClick={() => void cancel(booking.id)}>
                    {busy ? 'Cancelling…' : 'Cancel'}
                  </button>
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
