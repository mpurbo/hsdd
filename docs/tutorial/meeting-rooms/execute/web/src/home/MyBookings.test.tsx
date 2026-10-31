import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  atPath,
  loadFixture,
  stubFetch,
  stubFetchHanging,
  stubFetchUnreachable,
  type Fixture,
  type RecordedCall,
} from '../test/fetchStub'
import { MyBookings } from './MyBookings'

const TOKEN = 'q8Vn3xR2bT0kLw7YcZ1pHs5mJd9fAe4uGi6oNr2vXyQ'
const fixture = (name: string) => loadFixture('booking-api', name)

const LIST = 'GET /api/me/bookings'
const DESIGN = '/api/bookings/00000000-0000-4000-8000-000000000011'
const QUICK = '/api/bookings/00000000-0000-4000-8000-000000000016'

const lines = () =>
  screen.queryAllByRole('listitem').map((li) => {
    const [first, second] = Array.from(li.querySelectorAll('p'))
    return [first?.textContent, second?.querySelector('span')?.textContent]
  })

const renderList = (onSessionExpired = vi.fn()) => {
  const user = userEvent.setup()
  const view = render(<MyBookings token={TOKEN} zone="Europe/London" onSessionExpired={onSessionExpired} />)
  return { ...view, user, onSessionExpired }
}

const routes = (calls: readonly RecordedCall[]) => calls.map((call) => `${call.method} ${call.path}`)

/** The list item whose second line ends with ` · {title}`. */
const itemOf = (title: string): HTMLElement => {
  const item = screen
    .getAllByRole('listitem')
    .find((li) => li.querySelector('span')?.textContent?.endsWith(` · ${title}`) === true)
  if (item === undefined) throw new Error(`no booking titled ${title}`)
  return item
}

const cancelOf = (title: string) => within(itemOf(title)).getByRole('button')

const follows = (a: Node, b: Node): boolean => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

/** The fixture with its response replaced. */
const answering = (base: Fixture, response: Fixture['response']): Fixture => ({ ...base, response })

interface DeferredCall {
  readonly route: string
  readonly resolve: (response: Response) => void
}

interface DeferredStub {
  /** `METHOD path` of each call, in the order sent. */
  readonly routes: () => string[]
  /** Answers call `index`, then lets everything the answer sets off settle inside act. */
  readonly answer: (index: number, status: number, body?: unknown) => Promise<void>
}

/** Every fetch waits until the test answers it, so a test decides the order the answers arrive in. */
function stubFetchDeferred(): DeferredStub {
  const calls: DeferredCall[] = []
  vi.stubGlobal(
    'fetch',
    (input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((resolve) => {
        calls.push({ route: `${(init?.method ?? 'GET').toUpperCase()} ${String(input)}`, resolve })
      }),
  )
  return {
    routes: () => calls.map((call) => call.route),
    answer: (index, status, body) => {
      const call = calls[index]
      if (call === undefined) throw new Error(`no call ${index}`)
      return act(async () => {
        call.resolve(new Response(status === 204 ? null : JSON.stringify(body), { status }))
        await new Promise((r) => setTimeout(r, 0))
      })
    },
  }
}

const bodyOf = (name: string) => fixture(name).response.body

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

describe('MyBookings: Cancel (AC-6.2, D9, D10)', () => {
  it('cancels the booking and shows the list fetched again (AC-6.2)', async () => {
    const stub = stubFetch(
      fixture('my-bookings-budi'),
      fixture('my-bookings-none'),
      atPath(fixture('cancel-my-booking'), DESIGN),
    )
    const { user } = renderList()
    await screen.findAllByRole('listitem')
    await user.click(cancelOf('Design review'))
    expect(await screen.findByText('(no bookings)')).toBeInTheDocument()
    expect(stub.calls[1]).toMatchObject({ method: 'DELETE', path: DESIGN, headers: { authorization: `Bearer ${TOKEN}` } })
    expect(routes(stub.calls)).toEqual([LIST, `DELETE ${DESIGN}`, LIST])
    // The pressed button left with its booking, so focus fell to the body: it moves to the section's heading.
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'My bookings' })).toHaveFocus())
  })

  it.each([
    ['cancel-started', 'That booking has already started, so it cannot be cancelled.'],
    ['cancel-unknown', 'That booking was already cancelled.'],
    ['cancel-someone-elses', 'You can cancel only your own bookings.'],
  ])('%s: D10 message above the list, and the list fetched again', async (name, message) => {
    const stub = stubFetch(fixture('my-bookings-budi'), atPath(fixture(name), DESIGN))
    const { user } = renderList()
    await screen.findAllByRole('listitem')
    await user.click(cancelOf('Design review'))
    const notice = await screen.findByRole('alert')
    expect(notice.textContent).toBe(message)
    // Settled: the pressed Cancel is back once the refetch has answered (design note 2).
    await vi.waitFor(() => expect(within(itemOf('Design review')).getByRole('button', { name: 'Cancel' })).toBeEnabled())
    expect(follows(notice, screen.getByRole('list'))).toBe(true)
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    expect(routes(stub.calls)).toEqual([LIST, `DELETE ${DESIGN}`, LIST])
  })

  it('chooses the message by error.code, never error.message (Review Focus 5)', async () => {
    const base = fixture('cancel-someone-elses')
    const reworded = answering(base, {
      status: 403,
      body: { error: { code: 'BOOKING_NOT_YOURS', message: 'Something else.' } },
    })
    stubFetch(fixture('my-bookings-budi'), atPath(reworded, DESIGN))
    const { user } = renderList()
    await screen.findAllByRole('listitem')
    await user.click(cancelOf('Design review'))
    expect((await screen.findByRole('alert')).textContent).toBe('You can cancel only your own bookings.')
    await vi.waitFor(() => expect(within(itemOf('Design review')).getByRole('button', { name: 'Cancel' })).toBeEnabled())
  })

  it('reports an expired session once on a 401 (D1)', async () => {
    const stub = stubFetch(fixture('my-bookings-budi'), atPath(fixture('cancel-no-token'), DESIGN))
    const { user, onSessionExpired } = renderList()
    await screen.findAllByRole('listitem')
    await user.click(cancelOf('Design review'))
    await vi.waitFor(() => expect(onSessionExpired).toHaveBeenCalledTimes(1))
    await new Promise((r) => setTimeout(r, 0))
    expect(onSessionExpired).toHaveBeenCalledTimes(1)
    expect(routes(stub.calls)).toEqual([LIST, `DELETE ${DESIGN}`])
  })

  it('shows the D3 message above the list on an unexpected answer and keeps the list (D3)', async () => {
    const failing = answering(fixture('cancel-my-booking'), {
      status: 500,
      body: { error: { code: 'INTERNAL', message: 'x' } },
    })
    const stub = stubFetch(fixture('my-bookings-budi'), atPath(failing, DESIGN))
    const { user, onSessionExpired } = renderList()
    await screen.findAllByRole('listitem')
    await user.click(cancelOf('Design review'))
    const notice = await screen.findByRole('alert')
    expect(notice.textContent).toBe('Could not reach the server. Please try again.')
    expect(follows(notice, screen.getByRole('list'))).toBe(true)
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    expect(within(itemOf('Design review')).getByRole('button', { name: 'Cancel' })).toBeEnabled()
    expect(routes(stub.calls)).toEqual([LIST, `DELETE ${DESIGN}`])
    expect(onSessionExpired).not.toHaveBeenCalled()
  })

  it('clears the notice on the next Cancel (design note 6)', async () => {
    const stub = stubFetch(
      fixture('my-bookings-budi'),
      atPath(fixture('cancel-started'), DESIGN),
      atPath(fixture('cancel-my-booking'), QUICK),
    )
    const { user } = renderList()
    await screen.findAllByRole('listitem')
    await user.click(cancelOf('Design review'))
    await vi.waitFor(() => expect(within(itemOf('Design review')).getByRole('button', { name: 'Cancel' })).toBeEnabled())
    expect(screen.getByRole('alert')).toBeInTheDocument()
    await user.click(cancelOf('Quick check'))
    await vi.waitFor(() => expect(within(itemOf('Quick check')).getByRole('button', { name: 'Cancel' })).toBeEnabled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(routes(stub.calls)).toEqual([LIST, `DELETE ${DESIGN}`, LIST, `DELETE ${QUICK}`, LIST])
  })

  it('keeps the pressed Cancel busy while the others stay usable (D9)', async () => {
    const stub = stubFetchDeferred()
    const { user } = renderList()
    await stub.answer(0, 200, bodyOf('my-bookings-budi'))
    await user.click(cancelOf('Design review'))
    expect(within(itemOf('Design review')).getByRole('button', { name: 'Cancelling…' })).toBeDisabled()
    for (const title of ['Ongoing sync', 'Quick check', 'Next week']) {
      expect(within(itemOf(title)).getByRole('button', { name: 'Cancel' })).toBeEnabled()
    }
    await user.click(cancelOf('Quick check'))
    expect(stub.routes()).toEqual([LIST, `DELETE ${DESIGN}`, `DELETE ${QUICK}`])
    // Design note 2: still busy after the 204, until the refetch it triggers answers too.
    await stub.answer(1, 204)
    expect(stub.routes()).toEqual([LIST, `DELETE ${DESIGN}`, `DELETE ${QUICK}`, LIST])
    expect(within(itemOf('Design review')).getByRole('button', { name: 'Cancelling…' })).toBeDisabled()
  })

  it('drops a Cancel answer that arrives after unmount (no onSessionExpired, design note 3)', async () => {
    const stub = stubFetchDeferred()
    const { user, unmount, onSessionExpired } = renderList()
    await stub.answer(0, 200, bodyOf('my-bookings-budi'))
    await user.click(cancelOf('Design review'))
    unmount()
    await stub.answer(1, 401, bodyOf('cancel-no-token'))
    expect(onSessionExpired).not.toHaveBeenCalled()
    expect(stub.routes()).toEqual([LIST, `DELETE ${DESIGN}`])
  })

  it('shows the newest list request answer when two Cancels answer out of order (Review Focus 1)', async () => {
    const stub = stubFetchDeferred()
    const { user } = renderList()
    await stub.answer(0, 200, bodyOf('my-bookings-budi'))
    await user.click(cancelOf('Design review'))
    await user.click(cancelOf('Quick check'))
    expect(stub.routes()).toEqual([LIST, `DELETE ${DESIGN}`, `DELETE ${QUICK}`])
    await stub.answer(2, 204)
    await stub.answer(1, 204)
    // Call 3 is Quick check's refetch and call 4 Design review's: call 4 is the newest list request.
    expect(stub.routes()).toEqual([LIST, `DELETE ${DESIGN}`, `DELETE ${QUICK}`, LIST, LIST])
    await stub.answer(4, 200, bodyOf('my-bookings-none'))
    await stub.answer(3, 200, bodyOf('my-bookings-budi'))
    expect(screen.getByRole('region', { name: 'My bookings' })).toHaveTextContent('(no bookings)')
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('keeps both Cancels busy until the newest list request answers, the stale one answering first (design note 2)', async () => {
    const stub = stubFetchDeferred()
    const { user } = renderList()
    await stub.answer(0, 200, bodyOf('my-bookings-budi'))
    await user.click(cancelOf('Design review'))
    await user.click(cancelOf('Quick check'))
    await stub.answer(2, 204)
    await stub.answer(1, 204)
    // Call 3 is Quick check's refetch and call 4 Design review's: call 4 is the newest list request.
    expect(stub.routes()).toEqual([LIST, `DELETE ${DESIGN}`, `DELETE ${QUICK}`, LIST, LIST])
    await stub.answer(3, 200, bodyOf('my-bookings-budi'))
    // The stale answer is dropped; the backend has cancelled Quick check, so it must not offer Cancel again.
    expect(within(itemOf('Quick check')).getByRole('button', { name: 'Cancelling…' })).toBeDisabled()
    expect(within(itemOf('Design review')).getByRole('button', { name: 'Cancelling…' })).toBeDisabled()
    await stub.answer(4, 200, bodyOf('my-bookings-none'))
    expect(screen.getByRole('region', { name: 'My bookings' })).toHaveTextContent('(no bookings)')
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('leaves focus where the user moved it while the Cancel was in flight', async () => {
    const stub = stubFetchDeferred()
    const { user } = renderList()
    await stub.answer(0, 200, bodyOf('my-bookings-budi'))
    await user.click(cancelOf('Design review'))
    const quick = cancelOf('Quick check')
    quick.focus()
    await stub.answer(1, 422, bodyOf('cancel-started'))
    await stub.answer(2, 200, bodyOf('my-bookings-budi'))
    // Settled: the notice shows and the pressed Cancel is back.
    expect(screen.getByRole('alert')).toHaveTextContent('That booking has already started, so it cannot be cancelled.')
    expect(within(itemOf('Design review')).getByRole('button', { name: 'Cancel' })).toBeEnabled()
    expect(quick).toHaveFocus()
  })

  it("describes each Cancel by its booking's two lines, keeping the name Cancel", async () => {
    stubFetch(fixture('my-bookings-budi'))
    renderList()
    await screen.findAllByRole('listitem')
    const buttons = screen.getAllByRole('button', { name: 'Cancel' })
    expect(buttons).toHaveLength(4)
    // The accessible description flattens whitespace, so the line's two spaces read as one.
    const descriptions = [
      'Thu 5 Nov 09:00 to 10:00 Merapi · Ongoing sync',
      'Thu 5 Nov 10:00 to 11:00 Thames · Design review',
      'Thu 5 Nov 10:00 to 10:30 Kew · Quick check',
      'Thu 12 Nov 10:00 to 11:00 Merapi · Next week',
    ]
    buttons.forEach((button, i) => expect(button).toHaveAccessibleDescription(descriptions[i]))
  })
})
