import { useMemo, useState, type FormEvent } from 'react'
import type { Room } from '../api/types'
import { MESSAGES } from '../messages'
import { endOptions, startOptions, type Instant, type IsoDate, type ZoneName } from '../time/time'
import { keepOrFirst, timeChoices, titleAllowed, type TimeChoice } from './bookingRules'
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

/** The form stores what the user chose and derives what it shows: a chosen value still offered is kept, else the first offered. */
export function BookingForm({ zone, date, rooms, now }: BookingFormProps) {
  const [chosenRoom, setChosenRoom] = useState<string>()
  const [chosenStart, setChosenStart] = useState<Instant>()
  const [chosenEnd, setChosenEnd] = useState<Instant>()
  const [title, setTitle] = useState('')

  const starts = useMemo(() => timeChoices(startOptions(date, zone, now), zone, date), [date, zone, now])
  const start = keepOrFirst(chosenStart, starts.map(valueOf))
  const ends = useMemo(
    () => (start === undefined ? [] : timeChoices(endOptions(start, date, zone), zone, date)),
    [start, date, zone],
  )
  const end = keepOrFirst(chosenEnd, ends.map(valueOf))
  const room = keepOrFirst(chosenRoom, rooms.map((r) => r.id))

  const canBook = room !== undefined && start !== undefined && end !== undefined && titleAllowed(title)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
  }

  return (
    <form className="booking-form" onSubmit={onSubmit}>
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
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <button type="submit" disabled={!canBook}>
        Book
      </button>
    </form>
  )
}
