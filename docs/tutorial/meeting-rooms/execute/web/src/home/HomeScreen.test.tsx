import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Profile } from '../api/types'
import { asTimeZone } from '../time/time'
import { loadFixture, stubFetch } from '../test/fetchStub'
import { HomeScreen } from './HomeScreen'

const profileOf = (name: string): Profile => loadFixture('profile-api.v2', name).response.body as Profile
const TOKEN = 'q8Vn3xR2bT0kLw7YcZ1pHs5mJd9fAe4uGi6oNr2vXyQ'
const zoneOf = (profile: Profile) => (profile.timeZone === undefined ? undefined : asTimeZone(profile.timeZone))
const renderHome = (profile: Profile, over: { onSignOut?: () => void; zone?: ReturnType<typeof zoneOf> } = {}) =>
  render(
    <HomeScreen
      profile={profile}
      token={TOKEN}
      zone={'zone' in over ? over.zone : zoneOf(profile)}
      onSignOut={over.onSignOut ?? vi.fn()}
      onSessionExpired={vi.fn()}
    />,
  )
const rows = () => screen.getAllByRole('term').map((dt) => [dt.textContent, dt.nextElementSibling?.textContent])

describe('HomeScreen (AC-2.1 amended, AC-2.4)', () => {
  beforeEach(() => {
    stubFetch(loadFixture('booking-api', 'my-bookings-none'))
  })

  it("greets the user and lists their details in the Screen's order (AC-2.1 amended)", () => {
    renderHome(profileOf('me-ayu'))
    expect(screen.getByRole('heading', { name: 'Hello, Ayu Lestari' })).toBeInTheDocument()
    expect(rows()).toEqual([
      ['Username', 'ayu'],
      ['Email', 'ayu@example.com'],
      ['Phone', '+62 812 3456 7890'],
      ['Time zone', 'Asia/Jakarta'],
      ['Member since', '14 March 2024'],
    ])
  })

  it("shows Budi's own details", () => {
    renderHome(profileOf('me-budi'))
    expect(screen.getByRole('heading', { name: 'Hello, Budi Santoso' })).toBeInTheDocument()
    expect(rows()).toEqual([
      ['Username', 'budi'],
      ['Email', 'budi@example.com'],
      ['Phone', '+62 813 9876 5432'],
      ['Time zone', 'Europe/London'],
      ['Member since', '9 January 2025'],
    ])
  })

  it.each(['+1 202 555 0142', '+62 21 1234 5678', '+44 20 7946 0958'])(
    'shows the phone %s exactly as received, never reformatted (AC-2.4)',
    (phone) => {
      renderHome({ ...profileOf('me-ayu'), phone })
      expect(rows()).toContainEqual(['Phone', phone])
    },
  )

  it('Sign out calls its parent', async () => {
    const onSignOut = vi.fn()
    renderHome(profileOf('me-ayu'), { onSignOut })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign out' }))
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })

  it('without a zone (D7): the row reads Not available, the page says why, and nothing is requested', () => {
    const stub = stubFetch(loadFixture('booking-api', 'my-bookings-none'))
    const { timeZone: _omitted, ...withoutZone } = profileOf('me-ayu')
    renderHome(withoutZone, { zone: undefined })
    expect(rows()).toContainEqual(['Time zone', 'Not available'])
    expect(screen.getByText('Bookings need your time zone, which is not available.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'My bookings' })).toBeNull()
    expect(stub.calls).toEqual([])
  })
})
