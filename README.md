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
cp .env.example.local .env.local   # first time only

docker compose up -d --build
```

```bash
curl -s localhost:3000/api/health
# {"status":"ok"}
```

Open http://localhost:3000.

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
image does **not** need rebuilding when your network changes. What does have to
match is `NEXT_PUBLIC_REVERB_APP_KEY` here and `REVERB_APP_KEY` on the API, and
the API's `REVERB_ALLOWED_ORIGINS` has to include your LAN range (the default
covers `192.168.*`, `10.*` and `172.*`).

---

## Tests

```bash
npm test          # Vitest
npm run lint      # ESLint, @stylistic, double quotes
npm run typecheck # tsc --noEmit
npm run build
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

**Incoming state is guarded, not trusted.** `domains/game/utils/applyGameState.ts`
is a pure function: it drops anything older than or equal to what is on screen,
applies the next version, and on a gap applies *and* asks for a resync. Because
every payload is a full snapshot, a lost frame heals itself — and late join,
reconnect and a television waking up are all the same code path, exercised on
every page load rather than in a rare error branch.

The television also reconciles every 30 seconds no matter what. With Reverb
entirely down, the screen falls thirty seconds behind instead of freezing.
