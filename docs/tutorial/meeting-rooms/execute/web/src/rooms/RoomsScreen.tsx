import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { fetchRooms } from '../api/client'
import type { Room } from '../api/types'
import { MESSAGES } from '../messages'
import { dayRange, todayIn, type DayRange, type IsoDate, type ZoneName } from '../time/time'
import { roomViews } from './roomViews'
import './RoomsScreen.css'

export interface RoomsScreenProps {
  readonly token: string
  readonly zone: ZoneName
  readonly onHome: () => void
  readonly onSessionExpired: () => void
}

type ListState =
  | { readonly kind: 'none' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly rooms: readonly Room[] }
  | { readonly kind: 'unavailable' }

// Shared values, so setting a state the screen already holds renders nothing again.
const NONE: ListState = { kind: 'none' }
const LOADING: ListState = { kind: 'loading' }
const UNAVAILABLE: ListState = { kind: 'unavailable' }

/**
 * The date's range in the zone, or `undefined` for a date `dayRange` refuses:
 * `''` while the input is cleared or half typed, or a year below 0100 such as
 * `0002-10-31` on the way to `2027-10-31` (design rationale 4).
 */
function rangeOf(date: IsoDate, zone: ZoneName): DayRange | undefined {
  try {
    return dayRange(date, zone)
  } catch (e) {
    if (e instanceof RangeError) return undefined
    throw e
  }
}

/**
 * Rooms on a date (AC-4.1 to AC-4.4). The date opens on the user's today,
 * from the browser's clock read once on mount (ADR-002 Decision 5), and each
 * date fetches its own day, `dayRange` in the user's zone (AC-4.2, AC-4.4,
 * D8). The lines come from `roomViews`, rooms and bookings in the order
 * received (G13). The latest date wins: an answer for an earlier date, or
 * one after unmount, is dropped, `onSessionExpired` included (design
 * rationale 5).
 */
export function RoomsScreen({ token, zone, onHome, onSessionExpired }: RoomsScreenProps) {
  const dateId = useId()
  const [date, setDate] = useState<IsoDate>(() => todayIn(new Date().toISOString(), zone))
  const [list, setList] = useState<ListState>(LOADING)
  // Read through a ref, so a new callback identity never refetches. Written in
  // a layout effect, not during render; it commits before any answer can arrive.
  const onSessionExpiredRef = useRef(onSessionExpired)
  useLayoutEffect(() => {
    onSessionExpiredRef.current = onSessionExpired
  })

  useEffect(() => {
    const range = rangeOf(date, zone)
    // A refused date sends nothing and shows no list; no message (design rationale 4).
    if (range === undefined) {
      setList(NONE)
      return
    }
    // The cleanup runs before the next date's run and on unmount; a stale run
    // sets no state and calls nothing (design rationale 5).
    let stale = false
    setList(LOADING)
    // D8: fetchRooms writes the instants into the query unencoded.
    void fetchRooms(token, range.start, range.end).then((result) => {
      if (stale) return
      if (result.ok) setList({ kind: 'loaded', rooms: result.value })
      else if (result.reason === 'unauthorized') onSessionExpiredRef.current() // D1
      else setList(UNAVAILABLE) // D3
    })
    return () => {
      stale = true
    }
  }, [token, zone, date])

  return (
    <main className="rooms">
      <section className="rooms-card">
        <header className="rooms-header">
          <h1>
            <label htmlFor={dateId}>Rooms on</label>
          </h1>
          <input id={dateId} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <button type="button" onClick={onHome}>
            Home
          </button>
        </header>
        {list.kind === 'none' ? null : list.kind === 'loading' ? (
          <p className="rooms-message">Loading…</p>
        ) : list.kind === 'unavailable' ? (
          <p className="rooms-message" role="status">
            {MESSAGES.unavailable}
          </p>
        ) : (
          <ul className="rooms-list">
            {roomViews(list.rooms, date, zone).map((room) => (
              <li key={room.id}>
                <p className="rooms-room">{room.heading}</p>
                {room.bookings.length === 0 ? (
                  <p className="rooms-none">{MESSAGES.noBookings}</p>
                ) : (
                  room.bookings.map((booking) => (
                    <Fragment key={booking.id}>
                      <p className="rooms-booking">{booking.line}</p>
                      {booking.local === undefined ? null : <p className="rooms-local">{booking.local}</p>}
                    </Fragment>
                  ))
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
