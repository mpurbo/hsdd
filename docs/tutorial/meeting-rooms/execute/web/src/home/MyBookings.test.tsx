import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { loadFixture, stubFetch, stubFetchHanging, stubFetchUnreachable } from '../test/fetchStub'
import { MyBookings } from './MyBookings'

const TOKEN = 'q8Vn3xR2bT0kLw7YcZ1pHs5mJd9fAe4uGi6oNr2vXyQ'
const fixture = (name: string) => loadFixture('booking-api', name)

const lines = () =>
  screen.queryAllByRole('listitem').map((li) => {
    const [first, second] = Array.from(li.querySelectorAll('p'))
    return [first?.textContent, second?.querySelector('span')?.textContent]
  })

const renderList = (onSessionExpired = vi.fn()) => {
  const view = render(<MyBookings token={TOKEN} zone="Europe/London" onSessionExpired={onSessionExpired} />)
  return { ...view, onSessionExpired }
}

describe('MyBookings (AC-6.1, D1, D3)', () => {
  it("lists the user's bookings in the user's zone, each with Cancel", async () => {
    const stub = stubFetch(fixture('my-bookings-budi'))
    renderList()
    await screen.findAllByRole('listitem')
    expect(lines()).toEqual([
      ['Thu 5 Nov  09:00 to 10:00', 'Merapi · Ongoing sync'],
      ['Thu 5 Nov  10:00 to 11:00', 'Thames · Design review'],
      ['Thu 5 Nov  10:00 to 10:30', 'Kew · Quick check'],
      ['Thu 12 Nov  10:00 to 11:00', 'Merapi · Next week'],
    ])
    for (const li of screen.getAllByRole('listitem')) {
      expect(within(li).getAllByRole('button')).toHaveLength(1)
      expect(within(li).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    }
    expect(screen.getByRole('heading', { level: 2, name: 'My bookings' })).toBeInTheDocument()
    expect(stub.calls).toHaveLength(1)
    expect(stub.calls[0]).toMatchObject({
      method: 'GET',
      path: '/api/me/bookings',
      headers: { authorization: `Bearer ${TOKEN}` },
    })
  })

  it('says so when there are no bookings', async () => {
    stubFetch(fixture('my-bookings-none'))
    renderList()
    expect(await screen.findByText('(no bookings)')).toBeInTheDocument()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('reads Loading… while the first fetch is in flight', () => {
    stubFetchHanging()
    renderList()
    expect(screen.getByRole('region', { name: 'My bookings' })).toHaveTextContent('Loading…')
  })

  it('shows the D3 message when the server cannot be reached', async () => {
    stubFetchUnreachable()
    const { onSessionExpired } = renderList()
    expect(await screen.findByRole('status')).toHaveTextContent('Could not reach the server. Please try again.')
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(onSessionExpired).not.toHaveBeenCalled()
  })

  it('reports an expired session once', async () => {
    stubFetch(fixture('my-bookings-expired-token'))
    const { onSessionExpired } = renderList()
    await vi.waitFor(() => expect(onSessionExpired).toHaveBeenCalledTimes(1))
  })

  it('drops an answer that arrives after unmount (no onSessionExpired)', async () => {
    stubFetch(fixture('my-bookings-expired-token'))
    const { unmount, onSessionExpired } = renderList()
    unmount()
    await new Promise((r) => setTimeout(r, 0))
    expect(onSessionExpired).not.toHaveBeenCalled()
  })
})
