/**
 * The two responses in the whole system that carry the write credential in the
 * clear, made safe to hand to a browser.
 *
 * Opening a game and opening the next one with the same table are the only
 * routes that emit a `controller_token`, and neither may go through the generic
 * proxy, which returns the backend's body exactly as it arrived. Each has a
 * route of this app's own whose job is this function: lift the token out, keep
 * it on the server, and pass on an envelope that no longer contains it.
 *
 * The rule it enforces, from the credential model: the browser never holds the
 * write credential. The spectator credential is painted on a television that
 * every guest photographs, so it can never be a write one.
 */

export interface IssuedGame {

  /** The plaintext token, to be written into an httpOnly cookie and nowhere else. */
  token: string | null;

  /** The game the token belongs to. */
  gameId: string | null;

  /** The same envelope with the token removed, which is what the browser receives. */
  sanitised: unknown;
}

function asRecord (value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function issuedGame (body: unknown): IssuedGame {
  const envelope = asRecord(body);
  const data = envelope === null ? null : asRecord(envelope.data);

  if (envelope === null || data === null) {
    // Nothing recognisable came back. It is passed on untouched rather than
    // rewritten, because a body that is not the envelope is a failure the client
    // has to see, and it carries no token to leak.
    return { token: null, gameId: null, sanitised: body };
  }

  const game = asRecord(data.game);
  const token = data.controller_token;

  return {
    token: typeof token === "string" && token !== "" ? token : null,
    gameId: game !== null && typeof game.game_id === "string" ? game.game_id : null,

    // The key is dropped and not blanked: an empty `controller_token` in a body
    // is still a field a future reader could try to use.
    sanitised: { ...envelope, data: { game: data.game ?? null } },
  };
}
