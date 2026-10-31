# PRD: Simple Login, version 2: meeting rooms

- **Status:** approved
- **Version:** 2
- **Date:** 2026-10-31
- **Owner:** product
- **Supersedes:** `prd-simple-login.md` (version 1) together with
  `update-1-add-phone.md`
- **Read time:** 4 minutes

## Problem

Our two offices, Jakarta and London, book meeting rooms in a shared
spreadsheet. Two people book the same room for the same hour about once a
week, and people in one office misread the other office's times. Everyone
already signs in to Simple Login, so that is where room booking goes.

## Goal

A signed-in user finds a free room and books it in under a minute. A room
is never booked twice for the same time, not even when two people press
Book at the same moment. Every time on screen is in the user's own time
zone.

## Users

Registered users, the same accounts as version 1. There is still no
sign-up. Rooms are pre-loaded; nobody manages them in the app.

## User stories

Stories 1 to 3 are version 1's, with update 1's amendment and one new
criterion (AC-2.5). Stories 4 to 6 are new.

**US-1. Sign in.** As a user, I sign in with my username and password.

- AC-1.1 Correct username and password take me to the Home screen.
- AC-1.2 A wrong username or password shows "Incorrect username or
  password." and keeps me on the Login screen. It never says which of the
  two was wrong.
- AC-1.3 I cannot submit the form with an empty username or password.

**US-2. See my profile.** As a signed-in user, the Home screen shows my
details.

- AC-2.1 Home shows my display name, username, email, phone number, time
  zone and the date I joined.
- AC-2.2 Reloading the page keeps me signed in.
- AC-2.3 If my session has expired, I am sent back to Login with the message
  "Your session has expired. Please sign in again."
- AC-2.4 The phone number appears exactly as the account stores it,
  international format with spaces, for example `+62 812 3456 7890`.
- AC-2.5 The time zone appears as its name, for example `Asia/Jakarta`.
  Every time the app shows me is in this zone.

**US-3. Sign out.** As a signed-in user, I can sign out from Home.

- AC-3.1 Signing out returns me to the Login screen.

**US-4. Find a free room.** As a signed-in user, I pick a date and see
every room's bookings on that date.

- AC-4.1 The Rooms screen lists every room with its name, office and
  number of seats.
- AC-4.2 The date I pick is a date in my time zone. Under each room I see
  the bookings that overlap that date, earliest first, each with its title
  and its start and end times.
- AC-4.3 When a room's office is in another time zone than mine, each of
  its bookings also shows the room's local times, for example
  `09:00 to 10:00 (16:00 to 17:00 in Jakarta)`.
- AC-4.4 Times are right on the days London's clocks change (the last
  Sundays of March and October).

**US-5. Book a room.** As a signed-in user, I book a room for a time.

- AC-5.1 I choose a room, a date, a start time, an end time and a title.
- AC-5.2 Start and end fall on a quarter hour (:00, :15, :30, :45), and the
  end is after the start.
- AC-5.3 A booking that overlaps another booking of the same room is
  refused with "Merapi is already booked from 10:00 to 11:00." (the room's
  name and the other booking's times, in my time zone). Bookings that only
  touch, one ending at 10:00 and the next starting at 10:00, do not
  overlap.
- AC-5.4 When two people try to book overlapping times in the same room at
  the same moment, exactly one of them succeeds. The other sees AC-5.3's
  message.
- AC-5.5 I cannot book a time that has already started.
- AC-5.6 The title is required and at most 80 characters.

**US-6. My bookings.** As a signed-in user, I see and cancel my bookings.

- AC-6.1 Home lists my bookings that have not ended, soonest first, each
  with its room, title and times.
- AC-6.2 I can cancel a booking of mine that has not started. It leaves my
  list, and its time is free for anyone at once.
- AC-6.3 I cannot cancel somebody else's booking.

## Screens

```text
 Home                                     Rooms
+----------------------------------+     +--------------------------------------------+
|  Hello, Budi Santoso             |     |  Rooms on [ 2026-11-05 ]        [ Home ]   |
|                                  |     |                                            |
|  Username      budi              |     |  Merapi · Jakarta · 8 seats                |
|  Email         budi@example.com  |     |    02:00 to 03:00  Sprint planning         |
|  Phone         +62 813 9876 5432 |     |      (09:00 to 10:00 in Jakarta)           |
|  Time zone     Europe/London     |     |  Bromo · Jakarta · 4 seats                 |
|  Member since  9 January 2025    |     |    (no bookings)                           |
|                                  |     |  Thames · London · 10 seats                |
|  My bookings                     |     |    10:00 to 11:00  Design review           |
|  Thu 5 Nov  10:00 to 11:00       |     |  Kew · London · 4 seats                    |
|    Thames · Design review [Cancel]     |    (no bookings)                           |
|                                  |     |                                            |
|  [ Book a room ]  [ Sign out ]   |     |  Book: room [Thames v] start [10:00 v]     |
+----------------------------------+     |        end [11:00 v] title [__________]    |
                                         |        [ Book ]  (message here)            |
                                         +--------------------------------------------+
```

## Demo accounts

There is still no sign-up. These accounts are built in:

| Username | Password | Display name | Email | Phone | Time zone | Member since |
|----------|----------|--------------|-------|-------|-----------|--------------|
| ayu | `sunrise-42` | Ayu Lestari | ayu@example.com | `+62 812 3456 7890` | Asia/Jakarta | 2024-03-14 |
| budi | `harbor-17` | Budi Santoso | budi@example.com | `+62 813 9876 5432` | Europe/London | 2025-01-09 |

## Rooms

Pre-loaded; nobody adds, edits or removes a room in the app.

| Room | Office | Office time zone | Seats |
|------|--------|------------------|-------|
| Merapi | Jakarta | Asia/Jakarta | 8 |
| Bromo | Jakarta | Asia/Jakarta | 4 |
| Thames | London | Europe/London | 10 |
| Kew | London | Europe/London | 4 |

## Constraints

- Bookings are kept in PostgreSQL 17, run on the laptop with Docker
  Compose. On macOS the team runs Docker through Colima.
- Tests that read or write bookings run against a real PostgreSQL, never a
  mock or an in-memory stand-in.
- Bookings survive a restart of the service.
- Local laptop only, as before.

## Scope

- **In:** the Rooms screen, booking a room, my bookings on Home,
  cancelling, the time zone on Home, keeping bookings in PostgreSQL.
- **Out:** editing a booking (cancel and book again), recurring bookings,
  attendees and invitations, reminders, managing rooms, sign-up, password
  reset, editing the profile, multi-factor sign-in, rate limiting,
  deployment beyond the laptop.

## Left to engineering

Product has no preference on these; engineering decides and says what it
chose.

- The longest booking allowed, if there is a limit.
- How far ahead a room can be booked, if there is a limit.
- Whether signing in survives a restart of the service, now that a
  database exists. Either is acceptable for the demo.

## Team and delivery

- The same two developers: the backend developer builds the service and
  owns the database; the frontend developer builds the web app. They work
  in parallel and ship separately.

## Success

- In a scripted test, 20 simultaneous attempts to book the same room for
  the same time produce exactly one booking.
- Every acceptance criterion above passes in a scripted test, including on
  London's clock-change days.
- Restarting the service keeps every booking.
