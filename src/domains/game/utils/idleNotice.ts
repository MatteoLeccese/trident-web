/**
 * Whether the watch screen should say the game looks abandoned.
 *
 * The threshold comes from the snapshot and never from the bundle: a television
 * arrives by join code and never saw the creation response, and two clients on
 * different bundles must not disagree about when a room has gone quiet.
 *
 * It is a notice and not an expiry. The server decides when a game is over; this
 * only tells a room that nothing has moved for a while, which is why every
 * uncertain case answers "not idle" — a screen that cried abandonment over an
 * unparseable timestamp would send people home from a game still in play.
 */

const MS_PER_MINUTE = 60_000;

/** Milliseconds since the last write the server recorded, or null when that cannot be known. */
export function silenceMs (lastActivityAt: string, now: number): number | null {
  const last = Date.parse(lastActivityAt);

  if (Number.isNaN(last)) {
    return null;
  }

  return Math.max(0, now - last);
}

export function isIdle (lastActivityAt: string, noticeMinutes: number, now: number): boolean {
  if (!Number.isFinite(noticeMinutes) || noticeMinutes <= 0) {
    return false;
  }

  const silence = silenceMs(lastActivityAt, now);

  return silence !== null && silence >= noticeMinutes * MS_PER_MINUTE;
}
