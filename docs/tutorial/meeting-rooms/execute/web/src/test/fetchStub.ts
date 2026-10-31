// Test helper: answers stubbed `fetch` calls with the contract fixtures in
// hsdd/contract/fixture/: auth-api@v1's, profile-api@v2's and booking-api@v1's.
// profile-api@v1's are refused, so no test of this node can depend on them
// (simple-login.web.4). Only a fixture's `response` is used to answer; its
// `request.method` and `request.path` pick which fixture answers a call, and
// its `clock` and `given` only explain the answer: they are never sent.
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { vi } from 'vitest'

/** The fixture directories this node's tests may read. */
const FIXTURE_APIS = ['auth-api', 'profile-api.v2', 'booking-api'] as const

export type FixtureApi = (typeof FIXTURE_APIS)[number]

/** A booking that exists before a booking-api@v1 fixture's request. */
export interface GivenBooking {
  id: string
  account: string
  roomId: string
  title: string
  start: string
  end: string
}

export interface Fixture {
  name: string
  description: string
  /** booking-api@v1 only: the instant the producer's clock reads. */
  clock?: string
  /** booking-api@v1 only: the bookings that exist before the request. */
  given?: GivenBooking[]
  request: { method: string; path: string; headers: Record<string, string>; body?: unknown }
  response: { status: number; body: unknown }
  replay: 'exact' | 'schema'
}

export interface RecordedCall {
  method: string
  path: string
  headers: Record<string, string>
  body: unknown
}

export interface FetchStub {
  readonly calls: RecordedCall[]
}

// Resolved with node:path, not `new URL(literal, import.meta.url)`: Vite
// rewrites that pattern into a dev-server asset URL.
const fixtureRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../hsdd/contract/fixture')

// Checked at run time too, so a cast cannot reach a refused directory.
function fixtureDir(api: FixtureApi): string {
  if (!FIXTURE_APIS.includes(api)) throw new Error(`no fixture set ${api}`)
  return join(fixtureRoot, api)
}

export function loadFixture(api: FixtureApi, name: string): Fixture {
  return JSON.parse(readFileSync(join(fixtureDir(api), `${name}.json`), 'utf8')) as Fixture
}

export function listFixtures(api: FixtureApi): Fixture[] {
  return readdirSync(fixtureDir(api))
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => loadFixture(api, file.slice(0, -'.json'.length)))
}

const routeOf = (method: string, path: string): string => `${method.toUpperCase()} ${path}`

function record(input: RequestInfo | URL, init: RequestInit | undefined): RecordedCall {
  const raw = typeof init?.body === 'string' ? init.body : undefined
  return {
    method: (init?.method ?? 'GET').toUpperCase(),
    path: String(input),
    headers: Object.fromEntries(new Headers(init?.headers).entries()),
    body: raw === undefined ? undefined : (JSON.parse(raw) as unknown),
  }
}

function install(answer: (call: RecordedCall, signal: AbortSignal | undefined) => Promise<Response>): FetchStub {
  const calls: RecordedCall[] = []
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const call = record(input, init)
    calls.push(call)
    return answer(call, init?.signal ?? undefined)
  })
  return { calls }
}

/** A 204 has no body: `Response` throws when given one, even `null` as JSON. */
function responseOf(fixture: Fixture): Response {
  const { status, body } = fixture.response
  if (status === 204) return new Response(null, { status })
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/**
 * Answers each call with the fixture for its method and path. Several fixtures
 * on one route answer in the order given, and the last one repeats (a list
 * fetched before and after a Cancel).
 */
export function stubFetch(...fixtures: Fixture[]): FetchStub {
  const routes = new Map<string, Fixture[]>()
  for (const fixture of fixtures) {
    const route = routeOf(fixture.request.method, fixture.request.path)
    routes.set(route, [...(routes.get(route) ?? []), fixture])
  }
  return install(async (call) => {
    const route = routeOf(call.method, call.path)
    const queue = routes.get(route)
    const fixture = queue?.[0]
    if (!queue || !fixture) throw new Error(`no fixture for ${route}`)
    if (queue.length > 1) queue.shift()
    return responseOf(fixture)
  })
}

/**
 * The fixture, answering at `path` instead of its own: for a call no fixture
 * names, such as a Cancel on a listed booking. Method, status and body stay
 * the fixture's.
 */
export function atPath(fixture: Fixture, path: string): Fixture {
  return { ...fixture, request: { ...fixture.request, path } }
}

export function stubFetchUnreachable(): FetchStub {
  return install(async () => {
    throw new TypeError('Failed to fetch')
  })
}

/** A server that accepts the connection and never answers; like real fetch, the call rejects when its signal aborts. */
export function stubFetchHanging(): FetchStub {
  return install(
    (_call, signal) =>
      new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')))
      }),
  )
}
