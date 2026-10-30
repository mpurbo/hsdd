import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Profile } from '../api/types'
import { loadFixture } from '../test/fetchStub'
import { HomeScreen } from './HomeScreen'

const profileOf = (name: string): Profile => loadFixture('profile-api', name).response.body as Profile
const rows = () => screen.getAllByRole('term').map((dt) => [dt.textContent, dt.nextElementSibling?.textContent])

describe('HomeScreen (AC-2.1)', () => {
  it('greets the user and lists their details in wireframe order (AC-2.1)', () => {
    render(<HomeScreen profile={profileOf('me-ayu')} onSignOut={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Hello, Ayu Lestari' })).toBeInTheDocument()
    expect(rows()).toEqual([
      ['Username', 'ayu'],
      ['Email', 'ayu@example.com'],
      ['Member since', '14 March 2024'],
    ])
  })

  it("shows Budi's own details", () => {
    render(<HomeScreen profile={profileOf('me-budi')} onSignOut={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Hello, Budi Santoso' })).toBeInTheDocument()
    expect(rows()).toEqual([
      ['Username', 'budi'],
      ['Email', 'budi@example.com'],
      ['Member since', '9 January 2025'],
    ])
  })

  it('Sign out calls its parent', async () => {
    const onSignOut = vi.fn()
    render(<HomeScreen profile={profileOf('me-ayu')} onSignOut={onSignOut} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign out' }))
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })
})
