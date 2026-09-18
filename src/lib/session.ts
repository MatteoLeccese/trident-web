import "server-only";
import { cookies, headers } from "next/headers";
import type { ViewerRole } from "@/domains/game/types";

/**
 * The write credential lives **only** here: an httpOnly cookie that the
 * browser's JavaScript cannot read.
 *
 * See trident-api/documentation/conventions/credential-model.md. The sentence
 * that governs all of this: the spectator credential is shown on a television
 * and every guest photographs it, so it can never be a write one.
 */
const CONTROLLER_COOKIE = "trident_controller";
const GAME_COOKIE = "trident_game";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  // A game does not last longer than one night.
  maxAge: 60 * 60 * 12,
} as const;

/**
 * Whether the request being answered arrived over TLS.
 *
 * It is read from the request and never from the build mode. This product is
 * served over plain HTTP on a home LAN, and a browser silently discards a
 * `Secure` cookie that a non-trustworthy origin sets: a production build that
 * marked the cookie `Secure` would leave the phone on `http://192.168.x.x` with
 * no write credential at all, and every write it made would come back refused.
 *
 * A loopback origin is a trustworthy one, which is why a test run on
 * `127.0.0.1` cannot see that failure and a table can see nothing else.
 */
async function overTls (): Promise<boolean> {
  // The left-most entry is the scheme the browser actually spoke.
  const forwarded = (await headers()).get("x-forwarded-proto");

  return forwarded !== null && forwarded.split(",")[0]?.trim().toLowerCase() === "https";
}

export async function rememberController (gameId: string, token: string): Promise<void> {
  const jar = await cookies();
  const options = { ...COOKIE_OPTIONS, secure: await overTls() };

  jar.set(CONTROLLER_COOKIE, token, options);
  jar.set(GAME_COOKIE, gameId, options);
}

export async function controllerToken (): Promise<string | null> {
  return (await cookies()).get(CONTROLLER_COOKIE)?.value ?? null;
}

export async function currentSession (): Promise<{ gameId: string; role: ViewerRole; } | null> {
  const jar = await cookies();
  const gameId = jar.get(GAME_COOKIE)?.value;

  if (gameId === undefined || gameId === "") {
    return null;
  }

  return {
    gameId,
    role: jar.get(CONTROLLER_COOKIE)?.value ? "controller" : "spectator",
  };
}

export async function forgetController (): Promise<void> {
  const jar = await cookies();

  jar.delete(CONTROLLER_COOKIE);
  jar.delete(GAME_COOKIE);
}
