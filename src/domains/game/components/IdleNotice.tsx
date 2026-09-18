"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isIdle } from "@/domains/game/utils/idleNotice";

/**
 * The television saying that nothing has moved for a while.
 *
 * The threshold arrives **in the snapshot** and never from this bundle: a
 * television enters by join code and never saw the creation response, and two
 * clients built at different times must not disagree about when a room has gone
 * quiet. It sits outside the table's settings because the table does not choose
 * it.
 *
 * This is the one clock on any screen, and it advances nothing: it re-reads how
 * long the server has been silent so that a notice can appear. No game state
 * moves when it ticks, and every step of a turn still waits for a hand.
 *
 * It is a notice and not an expiry — the server decides when a game is over. So
 * it offers a way out and never takes one: the room can leave, or ignore it and
 * carry on.
 */

interface Props {

  /** The timestamp of the last write the server recorded. */
  lastActivityAt: string;

  /** Minutes of silence after which to say so, straight from the snapshot. */
  noticeMinutes: number;

  /** How often to re-read the clock. A prop so a test can drive it. */
  tickMs?: number;
}

export function IdleNotice ({ lastActivityAt, noticeMinutes, tickMs = 30_000 }: Props) {
  const [ now, setNow ] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), tickMs);

    return () => clearInterval(timer);
  }, [ tickMs ]);

  if (!isIdle(lastActivityAt, noticeMinutes, now)) {
    return null;
  }

  return (
    <aside
      data-idle-notice=""
      role="status"
      className="flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-accent bg-card p-[1.2em]"
    >
      <p className="salon-prose salon-lead">
        Nothing has happened here for {noticeMinutes} minutes. This game may have been left behind.
      </p>

      <Link
        href="/tv"
        data-idle-exit=""
        className="rounded-xl bg-primary px-[1em] py-[0.6em] font-semibold text-primary-foreground"
      >
        Watch another game
      </Link>
    </aside>
  );
}
