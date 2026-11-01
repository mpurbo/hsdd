# Update 1: Show the phone number on Home

- **Status:** approved
- **Date:** 2026-10-30
- **Owner:** product
- **Amends:** `prd-simple-login.md` (AC-2.1, Demo accounts)
- **Read time:** 1 minute

## Why

Support staff ask users to confirm the phone number on their account. Users
cannot see it anywhere today.

## Change

**AC-2.1 (amended).** Home shows my display name, username, email, phone
number and the date I joined.

- AC-2.4 The phone number appears exactly as the account stores it,
  international format with spaces, for example `+62 812 3456 7890`.

Nothing else in the PRD changes: sign in, sign out, reload and session
expiry behave as before.

## Screen

```text
 Home
+--------------------------------+
|  Hello, Ayu Lestari            |
|                                |
|  Username      ayu             |
|  Email         ayu@example.com |
|  Phone         +62 812 3456 7890
|  Member since  14 March 2024   |
|                                |
|  [ Sign out ]                  |
+--------------------------------+
```

## Demo accounts

Both built-in accounts gain a phone number:

| Username | Phone |
|----------|-------|
| ayu | `+62 812 3456 7890` |
| budi | `+62 813 9876 5432` |

## Scope

- **In:** showing the phone number on Home.
- **Out:** editing it, verifying it, sign-in by phone, any other field.

## Delivery

The same two developers, in parallel, as before. Local demo only.
