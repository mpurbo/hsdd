// Test helper: answers stubbed `fetch` calls with the contract fixtures in
// hsdd/contract/fixture/. Only a fixture's `response` is used to answer; its
// `request.method` and `request.path` pick which fixture answers a call.
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { vi } from 'vitest'

export type FixtureApi = 'auth-api' | 'profile-api'

export interface Fixture {
  name: string
  description: string
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

const fixtureDir = (api: FixtureApi): string => join(fixtureRoot, api)

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

export function stubFetch(...fixtures: Fixture[]): FetchStub {
  const routes = new Map<string, Fixture>()
  for (const fixture of fixtures) {
    const route = routeOf(fixture.request.method, fixture.request.path)
    if (routes.has(route)) throw new Error(`two fixtures for ${route}`)
    routes.set(route, fixture)
  }
  return install(async (call) => {
    const route = routeOf(call.method, call.path)
    const fixture = routes.get(route)
    if (!fixture) throw new Error(`no fixture for ${route}`)
    return new Response(JSON.stringify(fixture.response.body), {
      status: fixture.response.status,
      headers: { 'content-type': 'application/json' },
    })
  })
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
