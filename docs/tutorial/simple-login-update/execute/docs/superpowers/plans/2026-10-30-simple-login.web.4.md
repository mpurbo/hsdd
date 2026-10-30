# simple-login.web.4: Phone number on Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the web app from profile-api@v1 to profile-api@v2 and show the signed-in user's phone number on Home, exactly as received (AC-2.1 amended, AC-2.4).

**Architecture:** The fixture stub serves the `profile-api.v2` fixtures and refuses v1's, so every test reads v2. The pure decider in `web/src/api/client.ts` requires `phone` as a string, so a 200 without it is `unavailable` (D3, and D5 on load). `HomeScreen` renders `phone` verbatim as a fourth `<dt>`/`<dd>` row between Email and Member since. Login, the session flow, storage and the messages are untouched.

**Tech Stack:** React 19, TypeScript, Vite, Vitest with jsdom and Testing Library (existing `web/` package).

**Spec:** `hsdd-context/superpowers/simple-login.web.4.md` (phase section: `hsdd/spec/simple-login.web.md`, "### simple-login.web.4: Phone number on Home"; contract: `hsdd/contract/profile-api.v2.md`; Screen: `hsdd/context/update-1-add-phone.md`, "## Screen").

All commands run from the repository root (`docs/tutorial/simple-login-update/execute/`, the directory holding `hsdd/`). One-time setup: `npm --prefix web install`.

## Global Constraints

1. Every plan task except the last starts with a step that writes a failing
   test and records its failing output. Implementation follows.
2. The last task writes the verification doc, and it is the only task without
   a failing-test step.
3. The plan has at most 4 tasks: the phase is sized to one review sitting.
4. Before the last task, run the gate `npm --prefix web run gate` and keep its output for
   the verification doc's Observed section.
5. The last task writes hsdd/verify/simple-login.web.4.verification.md from
   hsdd/templates/verification.md at spot-check depth, fills every section
   the template asks for at that depth, writes "- none" or dispositioned
   entries under Learnings, and leaves Sign-off for a human reviewer.
6. Nothing under hsdd/ changes except that verification doc. Contracts, ADRs,
   specs and conventions change only through hsdd-contract, hsdd-adr and
   hsdd-reconcile.
7. Build against the Interface and Guarantees of each consumed or produced
   contract in the Contracts section below (if any), test against the
   fixtures their Validation names, and never build against another node's
   internals. Use a `referenced` contract only as the phase's Scope says.
8. Review tier spot-check: design notes only for a decision this phase actually settles; short verification doc.

Values the spec pins:
- Fixture set: `hsdd/contract/fixture/profile-api.v2/` (`me-ayu`, `me-budi`, `me-expired-token`, `me-no-token`, `me-unknown-token`). After this phase no web test reads `hsdd/contract/fixture/profile-api/`.
- Phones: Ayu `+62 812 3456 7890`, Budi `+62 813 9876 5432`, shown character for character.
- Home row order (the request's Screen): Username, Email, Phone, Member since. Row label: `Phone`.
- Unchanged: D1 to D5, `MESSAGES`, `session/flow.ts`, `session/store.ts`, `login/`.

## Design notes

Only the decisions this phase settles; the rest is fixed by the spec.

- **The stub refuses v1 at runtime, not only by type.** `FixtureApi` becomes `'auth-api' | 'profile-api.v2'`, derived from one `FIXTURE_APIS` tuple that `fixtureDir` also checks, so a cast cannot reopen the v1 directory either. Trade-off: three lines of guard for a guarantee `tsc` already gives uncast callers; in exchange the Scope's "no web test reads v1" is a tested behavior with a runtime RED, and v1's retirement cannot break the gate silently.
- **No stylesheet change.** The existing `max-content 1fr` grid holds `+62 812 3456 7890` on one line inside the 22rem card at 360 px; Task 3 checks that by eye rather than adding `white-space: nowrap`, which would overflow on a narrower screen instead of wrapping.

## Review Focus

1. A backend still on profile-api@v1 answers 200 without `phone`: on load the user sees Login with the D3 network message and the stored session is kept (D5), not a Home with an empty Phone row. Pinned by Task 2's App test.
2. A 200 whose `phone` is `null` or a number: `unavailable`, never a profile with a non-string phone. Pinned by Task 2's client tests.
3. A later additive field (profile-api@v2 is `additive-only`): the profile still loads and the field is dropped, so Home is unchanged. Pinned by Task 2's client test.
4. A phone in a grouping other than the fixtures' (`+1 202 555 0142`, `+62 21 1234 5678`, `+44 20 7946 0958`): shown character for character, never regrouped. Pinned by Task 3's Home test.
5. At 360 px the Phone row reads as one line, as in the request's Screen. jsdom has no layout, so Task 3 checks it by eye with a headless Chrome screenshot.

---

### Task 1: The fixture stub serves profile-api@v2 only

**Files:**
- Modify: `web/src/test/fetchStub.ts:1-3` (header), `:9` (`FixtureApi`), `:34` (`fixtureDir`)
- Test: `web/src/test/fetchStub.test.ts:5-20` (listing), new refusal test
- Modify (fixture reads move to v2, no assertion changes): `web/src/api/client.test.ts:34,45,63`, `web/src/home/HomeScreen.test.tsx:8`, `web/src/session/flow.test.ts:10`, `web/src/App.test.tsx:13,21,29,61`

**Interfaces:**
- Consumes: none.
- Produces: `type FixtureApi = 'auth-api' | 'profile-api.v2'`; `loadFixture(api: FixtureApi, name: string): Fixture` and `listFixtures(api: FixtureApi): Fixture[]`, both throwing `Error('no fixture set <api>')` for any other `api`. `Fixture`, `stubFetch`, `stubFetchUnreachable`, `stubFetchHanging` unchanged.

- [ ] **Step 1: Write the failing test**

In `web/src/test/fetchStub.test.ts`, change the listing test's second expectation to `listFixtures('profile-api.v2')` (same five names), import `type FixtureApi`, and add:

```ts
it('refuses the profile-api@v1 fixtures: this node consumes profile-api@v2', () => {
  const retired = 'profile-api' as FixtureApi
  expect(() => loadFixture(retired, 'me-ayu')).toThrow('no fixture set profile-api')
  expect(() => listFixtures(retired)).toThrow('no fixture set profile-api')
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm --prefix web test -- src/test/fetchStub.test.ts` and `npm --prefix web run typecheck`
Expected: vitest FAIL on the refusal test ("expected [Function] to throw an error"); tsc fails with TS2345 on `'profile-api.v2'` not assignable to `FixtureApi`. Record both.

- [ ] **Step 3: Implement the allowlist in `web/src/test/fetchStub.ts`**

`const FIXTURE_APIS = ['auth-api', 'profile-api.v2'] as const`, `export type FixtureApi = (typeof FIXTURE_APIS)[number]`, and `fixtureDir` throws `no fixture set ${api}` when `api` is not in `FIXTURE_APIS`. Header comment names auth-api@v1 and profile-api@v2 and says v1's profile fixtures are refused.

- [ ] **Step 4: Move every profile fixture read to v2**

Replace the `'profile-api'` argument with `'profile-api.v2'` at the lines listed under Files. No assertion changes: the client still drops `phone`, so the existing expectations hold.
Check: `grep -rn "'profile-api'" web/src` prints only the refusal test's cast.

- [ ] **Step 5: Run the gate**

Run: `npm --prefix web run gate`
Expected: tsc clean, every test passes (one more than before), build succeeds.

- [ ] **Step 6: Commit**

```bash
git add web/src
# run the lane's pre-commit name check on `git diff --cached`; it must print nothing
git -c user.name="Purbo Mamad" -c user.email="m.purbo@gmail.com" commit -m "test(web): the fixture stub serves profile-api@v2 and refuses v1" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: fetchProfile requires and returns `phone`

**Files:**
- Modify: `web/src/api/types.ts:1-2,10-17` (`Profile`), `web/src/api/client.ts:1-3,58-75` (`PROFILE_FIELDS`, `decideProfile`), `web/vite.config.ts:7` (comment only)
- Test: `web/src/api/client.test.ts`, `web/src/App.test.tsx`

**Interfaces:**
- Consumes: Task 1's `loadFixture('profile-api.v2', name)`, `stubFetch(...fixtures)`, `type Fixture`.
- Produces: `Profile` = `{ readonly id, username, displayName, email, phone, memberSince: string }` (`phone` after `email`). `fetchProfile(token: string): Promise<Result<Profile, ProfileFailure>>` unchanged in signature; a 200 lacking any of the six as a string is `{ ok: false, reason: 'unavailable' }`; unknown fields are not copied.

- [ ] **Step 1: Write the failing tests**

In `web/src/api/client.test.ts`: add `phone: '+62 812 3456 7890'` to `me-ayu`'s value and `phone: '+62 813 9876 5432'` to `me-budi`'s, each after `email`. Import `type Fixture` from `../test/fetchStub`. Add test-local helpers and tests:

```ts
const ayuBody = loadFixture('profile-api.v2', 'me-ayu').response.body as Record<string, unknown>
const withoutPhone = Object.fromEntries(Object.entries(ayuBody).filter(([key]) => key !== 'phone'))
/** me-ayu's 200 with `body` in place of the fixture's profile. */
const answering = (body: unknown): Fixture => ({ ...loadFixture('profile-api.v2', 'me-ayu'), response: { status: 200, body } })

it.each<[string, unknown]>([
  ['without a phone (a profile-api@v1 answer)', withoutPhone],
  ['with a null phone', { ...ayuBody, phone: null }],
  ['with a numeric phone', { ...ayuBody, phone: 6281234567890 }],
])('fetchProfile: a 200 %s is unavailable', async (_name, body) => {
  stubFetch(answering(body))
  expect(await fetchProfile(TOKEN)).toEqual({ ok: false, reason: 'unavailable' })
})

it('fetchProfile ignores fields it does not know (profile-api@v2)', async () => {
  stubFetch(answering({ ...ayuBody, nickname: 'Ayu' }))
  expect(await fetchProfile(TOKEN)).toEqual(profileCases['me-ayu'])
})
```

In `web/src/App.test.tsx`, in the load-check `describe`:

```ts
it('keeps the session and shows the network message when GET /api/me answers 200 without a phone (D3, D5)', async () => {
  store()
  const ayu = loadFixture('profile-api.v2', 'me-ayu')
  const body = Object.fromEntries(Object.entries(ayu.response.body as Record<string, unknown>).filter(([key]) => key !== 'phone'))
  stubFetch({ ...ayu, response: { status: 200, body } })
  render(<App />)
  expect(await screen.findByRole('status')).toHaveTextContent('Could not reach the server. Please try again.')
  expect(screen.queryByRole('heading', { name: 'Hello, Ayu Lestari' })).toBeNull()
  expect(sessionStorage.getItem('simple-login.session')).toBe(JSON.stringify(stored))
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm --prefix web test -- src/api/client.test.ts src/App.test.tsx` and `npm --prefix web run typecheck`
Expected: vitest FAIL on `fetchProfile: me-ayu`, `fetchProfile: me-budi`, the three malformed cases (received `ok: true`), the unknown-field case (no `phone`), and the App test (Home shows); tsc fails with TS2353, `phone` does not exist in type `Profile`. Record them.

- [ ] **Step 3: Implement**

`Profile` gains `readonly phone: string` after `email`, its doc says six fields of profile-api@v2; `PROFILE_FIELDS` gains `'phone'` and `decideProfile` returns all six or `unavailable`. Header comments in `types.ts`, `client.ts` and the proxy comment in `vite.config.ts` name profile-api@v2 instead of v1.

- [ ] **Step 4: Run the gate**

Run: `npm --prefix web run gate`
Expected: tsc clean, every test passes, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add web
# run the lane's pre-commit name check on `git diff --cached`; it must print nothing
git -c user.name="Purbo Mamad" -c user.email="m.purbo@gmail.com" commit -m "feat(web): fetchProfile requires phone (profile-api@v2)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: Home shows the Phone row

**Files:**
- Modify: `web/src/home/HomeScreen.tsx:10,16-23`, `web/src/home/memberSince.ts:1` (comment only)
- Test: `web/src/home/HomeScreen.test.tsx`, `web/src/App.test.tsx`

**Interfaces:**
- Consumes: Task 2's `Profile.phone: string`; Task 1's `loadFixture('profile-api.v2', name)`.
- Produces: `HomeScreen({ profile, onSignOut })` unchanged in signature; its `<dl>` rows are Username, Email, Phone, Member since.

- [ ] **Step 1: Write the failing tests**

In `web/src/home/HomeScreen.test.tsx`, insert `['Phone', '+62 812 3456 7890']` and `['Phone', '+62 813 9876 5432']` between the Email and Member since rows of the Ayu and Budi tests; rename the first test to say "AC-2.1 amended". Add:

```ts
it.each(['+1 202 555 0142', '+62 21 1234 5678', '+44 20 7946 0958'])(
  'shows the phone %s exactly as received, never reformatted (AC-2.4)',
  (phone) => {
    render(<HomeScreen profile={{ ...profileOf('me-ayu'), phone }} onSignOut={vi.fn()} />)
    expect(rows()).toContainEqual(['Phone', phone])
  },
)
```

In `web/src/App.test.tsx`, in the load-check `describe`:

```ts
it.each([
  ['me-ayu', 'Hello, Ayu Lestari', '+62 812 3456 7890'],
  ['me-budi', 'Hello, Budi Santoso', '+62 813 9876 5432'],
])('%s: Home shows the phone number from GET /api/me, character for character (AC-2.4)', async (name, heading, phone) => {
  store()
  stubFetch(loadFixture('profile-api.v2', name))
  render(<App />)
  expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
  expect(screen.getByText('Phone').nextElementSibling?.textContent).toBe(phone)
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm --prefix web test -- src/home/HomeScreen.test.tsx src/App.test.tsx`
Expected: FAIL: the row lists lack `Phone`; the App cases find no `Phone` text. Record them.

- [ ] **Step 3: Implement**

`HomeScreen` renders `<dt>Phone</dt><dd>{profile.phone}</dd>` between Email and Member since, with no formatting call; its doc names the request's Screen (AC-2.1 amended, AC-2.4). `memberSince.ts`'s first comment line names profile-api@v2.

- [ ] **Step 4: Run the gate**

Run: `npm --prefix web run gate`
Expected: tsc clean, every test passes, build succeeds. Keep the full output in the scratchpad for Task 4 (Global Constraint 4).

- [ ] **Step 5: Eyeball Home at 360 px**

With a throwaway entry (`web/preview-360.html` loading `web/src/preview360.tsx`, which imports `index.css` and renders `<HomeScreen>` with the v2 `me-ayu` body, then `me-budi` on a second run), start `cd web && npx vite --port 5199 --strictPort` in the background, then run headless Chrome with `--headless=new --force-device-scale-factor=1 --hide-scrollbars --window-size=360,640 --screenshot=<scratchpad>/home-360-<name>.png http://localhost:5199/preview-360.html`. Expected: rows in the Screen's order, the phone on one line. Stop the server, delete both throwaway files; `git status --short web` shows only this task's changes.

- [ ] **Step 6: Commit**

```bash
git add web/src
# run the lane's pre-commit name check on `git diff --cached`; it must print nothing
git -c user.name="Purbo Mamad" -c user.email="m.purbo@gmail.com" commit -m "feat(web): Home shows the phone number as received (AC-2.1, AC-2.4)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: Verification doc

**Files:**
- Create: `hsdd/verify/simple-login.web.4.verification.md`

**Interfaces:**
- Consumes: the gate output from Task 3 Step 4 (or from the review fix pass, whichever is later), the 360 px screenshot, `hsdd/templates/verification.md`.
- Produces: the phase's verification doc; nothing else under `hsdd/` changes.

- [ ] **Step 1: Write the doc from the template at spot-check depth**

Title `# Verification: simple-login.web.4 — Phone number on Home` (the template's own form). Sections: Commands to run (`npm --prefix web install`, `npm --prefix web run gate`, the `grep` showing no test reads `profile-api/`), Expected output (exit 0, test count, the two phones), Observed (dated 2026-10-30: the gate's counts, the grep, the 360 px check), Outstanding (what could not be checked here), Learnings (`- none` or entries each with one disposition), Metrics (optional), Sign-off with every field left blank.

- [ ] **Step 2: Check it**

Run: `git status --short hsdd` and `git diff --stat a5d40eb -- hsdd`
Expected: only `hsdd/verify/simple-login.web.4.verification.md`.

- [ ] **Step 3: Commit**

```bash
git add hsdd/verify/simple-login.web.4.verification.md
# run the lane's pre-commit name check on `git diff --cached`; it must print nothing
git -c user.name="Purbo Mamad" -c user.email="m.purbo@gmail.com" commit -m "docs(hsdd): simple-login.web.4 verification doc" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
