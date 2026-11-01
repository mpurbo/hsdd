# PRD: Simple Login

- **Status:** approved
- **Date:** 2026-10-29
- **Owner:** product
- **Read time:** 2 minutes

## Problem

People with an account need a place to sign in and see their own details.
Today there is nothing: no sign-in, no profile page.

## Goal

A signed-in user sees their own profile within seconds. A user who types the
wrong password is told so, plainly, and can try again.

## Users

Registered users. Accounts already exist; there is no sign-up.

## User stories

**US-1. Sign in.** As a user, I sign in with my username and password.

- AC-1.1 Correct username and password take me to the Home screen.
- AC-1.2 A wrong username or password shows "Incorrect username or
  password." and keeps me on the Login screen. It never says which of the
  two was wrong.
- AC-1.3 I cannot submit the form with an empty username or password.

**US-2. See my profile.** As a signed-in user, the Home screen shows my
details.

- AC-2.1 Home shows my display name, username, email and the date I joined.
- AC-2.2 Reloading the page keeps me signed in.
- AC-2.3 If my session has expired, I am sent back to Login with the message
  "Your session has expired. Please sign in again."

**US-3. Sign out.** As a signed-in user, I can sign out from Home.

- AC-3.1 Signing out returns me to the Login screen.

## Screens

```text
 Login                              Home
+------------------------------+   +------------------------------+
|  Sign in                     |   |  Hello, Ayu Lestari          |
|                              |   |                              |
|  Username [______________]   |   |  Username      ayu           |
|  Password [______________]   |   |  Email         ayu@example.com
|                              |   |  Member since  14 March 2024 |
|  [ Sign in ]                 |   |                              |
|  (error message here)        |   |  [ Sign out ]                |
+------------------------------+   +------------------------------+
```

## Demo accounts

There is no database. These accounts are built in:

| Username | Password | Display name | Email | Member since |
|----------|----------|--------------|-------|--------------|
| ayu | `sunrise-42` | Ayu Lestari | ayu@example.com | 2024-03-14 |
| budi | `harbor-17` | Budi Santoso | budi@example.com | 2025-01-09 |

## Scope

- **In:** the Login screen, the Home screen, sign out; a backend HTTP
  service with exactly two endpoints (sign in, get my profile).
- **Out:** sign-up, password reset, editing the profile, remembering me
  across browser sessions, a database, multi-factor sign-in, rate limiting.

## Team and delivery

- One backend developer builds the service; one frontend developer builds
  the web app. They work in parallel and ship separately.
- Local demo only for now: both run on a developer laptop.

## Success

- A demo user reaches Home in under 3 seconds after pressing Sign in.
- Every acceptance criterion above passes in a scripted test.
