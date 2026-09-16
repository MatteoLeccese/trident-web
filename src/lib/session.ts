import "server-only";
import { cookies } from "next/headers";
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
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  // A game does not last longer than one night.
  maxAge: 60 * 60 * 12,
} as const;

export async function rememberController (gameId: string, token: string): Promise<void> {
  const jar = await cookies();

  jar.set(CONTROLLER_COOKIE, token, COOKIE_OPTIONS);
  jar.set(GAME_COOKIE, gameId, COOKIE_OPTIONS);
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
