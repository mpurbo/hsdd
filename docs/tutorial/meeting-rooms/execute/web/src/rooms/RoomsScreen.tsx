import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { fetchRooms } from '../api/client'
import type { Room } from '../api/types'
import { MESSAGES } from '../messages'
import { dayRange, todayIn, type DayRange, type Instant, type IsoDate, type ZoneName } from '../time/time'
import { BookingForm } from './BookingForm'
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
  // `date` is the date the rooms were fetched for, so they are never shown under another.
  // `now` is the browser's clock read when the answer arrived; the form derives its times from it.
  | { readonly kind: 'loaded'; readonly rooms: readonly Room[]; readonly date: IsoDate; readonly now: Instant }
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
 * rationale 5). A list shows only under the date it was fetched for; any
 * other date reads `Loading…` until its own answer arrives. Below a loaded
 * list sits the booking form. After a 201 the same date is fetched again with
 * the list kept on screen, so `Booked.` stays; a failed refetch replaces list
 * and form with D3's message, a 401 ends the session (D1).
 */
export function RoomsScreen({ token, zone, onHome, onSessionExpired }: RoomsScreenProps) {
  const dateId = useId()
  const [date, setDate] = useState<IsoDate>(() => todayIn(new Date().toISOString(), zone))
  const [list, setList] = useState<ListState>(LOADING)
  // Incremented by a booking; a new value fetches the date again.
  const [refresh, setRefresh] = useState(0)
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
    // A run for the date already loaded keeps its list, so a refetch never flashes Loading….
    setList((prev) => (prev.kind === 'loaded' && prev.date === date ? prev : LOADING))
    // D8: fetchRooms writes the instants into the query unencoded.
    void fetchRooms(token, range.start, range.end).then((result) => {
      if (stale) return
      if (result.ok) setList({ kind: 'loaded', rooms: result.value, date, now: new Date().toISOString() })
      else if (result.reason === 'unauthorized') onSessionExpiredRef.current() // D1
      else setList(UNAVAILABLE) // D3
    })
    return () => {
      stale = true
    }
  }, [token, zone, date, refresh])

  // The render after a date change still holds the previous date's list; the
  // effect above sets Loading… only after it. A list fetched for another date
  // reads Loading… in that render too, so no frame pairs one date's rooms with
  // another date (Scope: "While a fetch is in flight the list reads `Loading…`").
  const shownList: ListState = list.kind === 'loaded' && list.date !== date ? LOADING : list

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
        {shownList.kind === 'none' ? null : shownList.kind === 'loading' ? (
          <p className="rooms-message">Loading…</p>
        ) : shownList.kind === 'unavailable' ? (
          <p className="rooms-message" role="status">
            {MESSAGES.unavailable}
          </p>
        ) : (
          <ul className="rooms-list">
            {roomViews(shownList.rooms, shownList.date, zone).map((room) => (
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
        {shownList.kind === 'loaded' ? (
          <BookingForm
            token={token}
            zone={zone}
            date={shownList.date}
            rooms={shownList.rooms}
            now={shownList.now}
            onBooked={() => setRefresh((n) => n + 1)}
            onSessionExpired={onSessionExpired}
          />
        ) : null}
      </section>
    </main>
  )
}
