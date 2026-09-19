# Trident — Web

The two screens of Trident: the phone that runs the game and gets passed around
the table, and the television that watches it live.

Next 16 (App Router) · React 19 · TypeScript strict · Tailwind v4 · Zustand ·
laravel-echo

---

## Running it

The API owns the shared Docker network, so **start it first** — see
[`../trident-api/README.md`](../trident-api/README.md).

```bash
cp .env.example .env
docker compose up -d --build
```

That is the whole first-time setup: the template is filled in and works against
the API on this machine.

```bash
curl -s localhost:3000/api/health
# {"status":"ok"}
```

Open `http://localhost:3000` on the phone and `http://localhost:3000/tv` on the
television. **Use a separate browser profile, another browser or a private window
for the television** — sharing a cookie jar gives it the controller credential,
and then it is not a television.

### One thing that surprises everybody

Every variable named `NEXT_PUBLIC_*` is **inlined into the bundle when the image
is built**, not read when it runs. Setting one on a running container changes
nothing, silently. Changing one means:

```bash
docker compose up -d --build
```

### Without Docker

```bash
npm install
npm run dev
```

You still need the API running, and `BACKEND_API_URL` in `.env.local` pointing at
it (`http://127.0.0.1:8000/api/v1`).

---

## Playing on a real table

The phone and the television reach this machine by its address on your wifi.
Find it, then open the same address on both devices:

```bash
# Linux / WSL
hostname -I | awk '{print $1}'
# On WSL, use the Windows host's LAN address instead — Docker Desktop already
# publishes the ports there, so nothing else is needed:
ipconfig.exe | grep -A5 -i 'Wi-Fi' | grep IPv4
```

| Device | Opens |
|---|---|
| Phone (runs the game) | `http://<lan-ip>:3000` |
| Television (watches) | `http://<lan-ip>:3000/tv`, then types the six-character code |

The Reverb host is resolved in the browser from the page's own origin, so the
image does **not** need rebuilding when your network changes — leave
`NEXT_PUBLIC_REVERB_HOST` empty and it follows you.

Two things do have to match, and both live on the API side:

- `NEXT_PUBLIC_REVERB_APP_KEY` here and `REVERB_APP_KEY` there.
- `REVERB_ALLOWED_ORIGINS` there has to include your LAN range, and
  `FRONTEND_URL` has to be the address the phones actually load.

---

## Checks

Everything that has to be green, in one command:

```bash
npm run check     # lint, typecheck, Vitest, build
```

There is no CI and there will not be one. These run locally before a session
closes, and they bind. The end-to-end suite is separate because it needs the
whole stack up:

```bash
npm run test:e2e
```

### Running parts of it

```bash
npm test          # Vitest
npm run lint      # ESLint, @stylistic, double quotes
npm run typecheck # tsc --noEmit
npm run build
```

### The two screens, end to end

`e2e/two-screen.spec.ts` drives the product as it is played: one browser context
is the phone, holding the write credential in its cookie jar, and another is the
television, holding nothing. The phone draws; the television has the tile in
under two seconds; a third context joins mid-game and lands on the board already
in play.

It needs the real stack — Laravel, Reverb, Postgres and Redis — because there is
nothing in it to fake. Two commands:

```bash
cd ../trident-api && docker compose up -d --build api reverb
cd ../trident-web && npm run test:e2e
```

The second one builds this app and serves it on **3100**, so it never collides
with, or reports on, the build the web compose file publishes on 3000. If the
stack is not up, the run stops before the first test with a line that names the
command above.

Nothing in that run reads `.env.local`: `NEXT_PUBLIC_*` is inlined at build time,
so the run builds with the values in `e2e/support/stack.ts` — which is also where
the API, Reverb and the ports are configured, each with a `TRIDENT_E2E_*`
override. The reconciliation poll is pushed out to ten minutes there on purpose:
with no poll inside the run, the socket is the only thing that can explain a
frame arriving, and the spec also counts the television's HTTP reads to say so.

A whole run is some sixty requests and the API allows a hundred and twenty a
minute, so two runs back to back reach its rate limit. The preflight recognises
that answer, says so and waits out the window rather than letting a throttled API
look like a broken product.

The browser binaries come from `npx playwright install chromium` and live in
`~/.cache/ms-playwright`; the run needs no display.

```bash
npm run test:e2e -- --headed          # watch both screens
npm run test:e2e -- --grep "joining" # one of them
TRIDENT_E2E_REUSE_SERVER=1 npm run test:e2e   # while iterating: serve the build already there
```

---

## Layout

```
src/
  app/            Routes and the BFF.
    api/          games, session, realtime/auth, proxy/[...path], health
    play/[id]     The phone.
    tv, tv/[id]   The television.
  domains/
    core/         The axios instance, the app store, shared types. Depends on nothing.
    game/         Types, service, hooks, components, the version guard.
  lib/            backend (server-only), session, error codes, cn.
```

---

## The two things most worth understanding

**The browser never holds the write credential.** Creating a game returns a
`controller_token` exactly once; `src/app/api/games/route.ts` stores it in an
httpOnly cookie and strips it from the response. Everything else goes through
`/api/proxy`, which injects the token server-side. `src/lib/backend.ts` is
`server-only`, so importing it from a client component is a build error, not a
production leak.

That cookie is marked `Secure` only when the request being answered really
arrived over TLS, which the server reads from `x-forwarded-proto`. A browser
discards a `Secure` cookie set from a plain-HTTP origin without saying so, and
this product is opened at a LAN address over plain HTTP: marked `Secure` in
every production build, the phone would arrive at the table with no write
credential and every tap would come back refused. If you put this behind a TLS
proxy, the proxy has to send that header.

**Incoming state is guarded, not trusted.** `domains/game/utils/applyGameState.ts`
is a pure function: it drops anything older than or equal to what is on screen,
applies the next version, and on a gap applies *and* asks for a resync. Because
every payload is a full snapshot, a lost frame heals itself — and late join,
reconnect and a television waking up are all the same code path, exercised on
every page load rather than in a rare error branch.

The television also reconciles every 30 seconds no matter what. With Reverb
entirely down, the screen falls thirty seconds behind instead of freezing.
