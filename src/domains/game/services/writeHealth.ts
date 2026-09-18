/**
 * Whether the server is still answering this phone.
 *
 * **It is a different question from the socket's**, and the difference is the
 * whole reason this exists. The socket is a read path: it can be perfectly
 * healthy while every write fails, and it can report itself connected while it
 * quietly swallows frames. The phone is the one client that writes, and the one
 * device a table cannot carry on without — so "is my last write landing?" is the
 * question its badge has to answer, and until now nothing in the client recorded
 * the answer at all.
 *
 * It is a module-level store and not React state because the thing that knows is
 * the write path, which is called from two places — the lobby's writes and the
 * draw — and threading a setter through both would put the same fact in two
 * hands. `useSyncExternalStore` is the supported way to read one of these, and
 * the store is reset when the phone moves to another game.
 */

export type WriteHealth =

  /** No write has been attempted yet. A fresh lobby is not a failing one. */
  | "idle"

  /** The server answered the last write, whatever it answered. */
  | "healthy"

  /** The last write never reached an answer, retries included. */
  | "failing";

let health: WriteHealth = "idle";

const listeners = new Set<() => void>();

function set (next: WriteHealth): void {
  if (next === health) {
    return;
  }

  health = next;

  for (const listener of listeners) {
    listener();
  }
}

/**
 * The server answered.
 *
 * A refusal counts. `422 game_version_conflict` and a validation error are the
 * server working exactly as designed, and a badge that painted them as a broken
 * connection would send a table to reboot a phone over a stale tap.
 */
export function writeLanded (): void {
  set("healthy");
}

/** The write never got an answer: a timeout, a dead network, a 5xx past its retries. */
export function writeFailed (): void {
  set("failing");
}

/** Forgets everything. Called when the phone moves to another game. */
export function resetWriteHealth (): void {
  set("idle");
}

export function writeHealthSnapshot (): WriteHealth {
  return health;
}

/** Rendered on the server, where no write has been made and none can be. */
export function writeHealthServerSnapshot (): WriteHealth {
  return "idle";
}

export function subscribeToWriteHealth (listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
