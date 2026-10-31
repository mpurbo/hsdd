import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { bookRoom } from '../api/client'
import type { Room } from '../api/types'
import { MESSAGES } from '../messages'
import { endOptions, startOptions, type Instant, type IsoDate, type ZoneName } from '../time/time'
import { bookOutcome, keepOrFirst, timeChoices, titleAllowed, type TimeChoice } from './bookingRules'
import './BookingForm.css'

export interface BookingFormProps {
  readonly token: string
  readonly zone: ZoneName
  readonly date: IsoDate
  readonly rooms: readonly Room[]
  readonly now: Instant
  readonly onBooked: () => void
  readonly onSessionExpired: () => void
}

const valueOf = (choice: TimeChoice): Instant => choice.value

function TimeSelect({ label, choices, value, onChange }: {
  readonly label: string
  readonly choices: readonly TimeChoice[]
  readonly value: Instant | undefined
  readonly onChange: (value: Instant) => void
}) {
  return (
    <label>
      {label}
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {choices.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
    </label>
  )
}

/**
 * The form stores what the user chose and derives what it shows: a chosen
 * value still offered is kept, else the first offered. Book sends one request
 * per press and shows D10's answer after the button until the next press; a
 * 401 shows nothing and ends the session (D1). An answer after unmount is
 * dropped, `onSessionExpired` and `onBooked` included.
 */
export function BookingForm({ token, zone, date, rooms, now, onBooked, onSessionExpired }: BookingFormProps) {
  const [chosenRoom, setChosenRoom] = useState<string>()
  const [chosenStart, setChosenStart] = useState<Instant>()
  const [chosenEnd, setChosenEnd] = useState<Instant>()
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string>()
  // Counts the answers that have settled on screen; each one triggers the focus check below.
  const [settled, setSettled] = useState(0)
  const titleRef = useRef<HTMLInputElement>(null)
  const alive = useRef(false)
  // Read through refs, so an answer calls the latest callbacks. Written in a
  // layout effect, not during render; it commits before any answer can arrive.
  const onBookedRef = useRef(onBooked)
  const onSessionExpiredRef = useRef(onSessionExpired)
  useLayoutEffect(() => {
    onBookedRef.current = onBooked
    onSessionExpiredRef.current = onSessionExpired
  })

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  // A browser moves focus to the body when the focused Book button becomes
  // disabled. After an answer, focus left there moves to the title; focus the
  // user has put anywhere else stays.
  useLayoutEffect(() => {
    if (settled === 0) return
    const active = document.activeElement
    if (active === null || active === document.body) titleRef.current?.focus()
  }, [settled])

  const starts = useMemo(() => timeChoices(startOptions(date, zone, now), zone, date), [date, zone, now])
  const start = keepOrFirst(chosenStart, starts.map(valueOf))
  const ends = useMemo(
    () => (start === undefined ? [] : timeChoices(endOptions(start, date, zone), zone, date)),
    [start, date, zone],
  )
  const end = keepOrFirst(chosenEnd, ends.map(valueOf))
  const room = keepOrFirst(chosenRoom, rooms.map((r) => r.id))

  const canBook = room !== undefined && start !== undefined && end !== undefined && titleAllowed(title)

  // Enter in the title submits too, so the checks live here, not only on the button.
  const book = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (!canBook || busy) return
    setMessage(undefined)
    setBusy(true)
    // The title goes as typed, untrimmed.
    const result = await bookRoom(token, { roomId: room, start, end, title })
    if (!alive.current) return
    const outcome = bookOutcome(result, zone, date)
    if (outcome.kind === 'expired') {
      onSessionExpiredRef.current() // D1
    } else {
      setMessage(outcome.message)
      if (outcome.kind === 'booked') {
        setTitle('')
        onBookedRef.current()
      }
    }
    setBusy(false)
    setSettled((n) => n + 1)
  }

  return (
    <form className="booking-form" onSubmit={(e) => void book(e)}>
      <span>Book:</span>
      <label>
        room
        <select value={room ?? ''} onChange={(e) => setChosenRoom(e.target.value)}>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      {start === undefined ? (
        <p>{MESSAGES.noTimesLeft}</p>
      ) : (
        <>
          <TimeSelect label="start" choices={starts} value={start} onChange={setChosenStart} />
          <TimeSelect label="end" choices={ends} value={end} onChange={setChosenEnd} />
        </>
      )}
      <label>
        title
        <input ref={titleRef} type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <button type="submit" disabled={!canBook || busy}>
        {busy ? 'Booking…' : 'Book'}
      </button>
      {/* The outcome of the user's own action, so an alert, as Home's Cancel notice is. */}
      {message === undefined ? null : <p role="alert">{message}</p>}
    </form>
  )
}
