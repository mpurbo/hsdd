import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Profile } from '../api/types'
import { loadFixture } from '../test/fetchStub'
import { HomeScreen } from './HomeScreen'

const profileOf = (name: string): Profile => loadFixture('profile-api.v2', name).response.body as Profile
const rows = () => screen.getAllByRole('term').map((dt) => [dt.textContent, dt.nextElementSibling?.textContent])

describe('HomeScreen (AC-2.1 amended, AC-2.4)', () => {
  it("greets the user and lists their details in the Screen's order (AC-2.1 amended)", () => {
    render(<HomeScreen profile={profileOf('me-ayu')} onSignOut={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Hello, Ayu Lestari' })).toBeInTheDocument()
    expect(rows()).toEqual([
      ['Username', 'ayu'],
      ['Email', 'ayu@example.com'],
      ['Phone', '+62 812 3456 7890'],
      ['Member since', '14 March 2024'],
    ])
  })

  it("shows Budi's own details", () => {
    render(<HomeScreen profile={profileOf('me-budi')} onSignOut={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Hello, Budi Santoso' })).toBeInTheDocument()
    expect(rows()).toEqual([
      ['Username', 'budi'],
      ['Email', 'budi@example.com'],
      ['Phone', '+62 813 9876 5432'],
      ['Member since', '9 January 2025'],
    ])
  })

  it.each(['+1 202 555 0142', '+62 21 1234 5678', '+44 20 7946 0958'])(
    'shows the phone %s exactly as received, never reformatted (AC-2.4)',
    (phone) => {
      render(<HomeScreen profile={{ ...profileOf('me-ayu'), phone }} onSignOut={vi.fn()} />)
      expect(rows()).toContainEqual(['Phone', phone])
    },
  )

  it('Sign out calls its parent', async () => {
    const onSignOut = vi.fn()
    render(<HomeScreen profile={profileOf('me-ayu')} onSignOut={onSignOut} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign out' }))
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })
})
