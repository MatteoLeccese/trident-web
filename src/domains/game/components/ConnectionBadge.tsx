"use client";

import type { ChannelStatus } from "@/domains/game/hooks/useGameChannel";
import type { WriteHealth } from "@/domains/game/services/writeHealth";
import { cn } from "@/lib/utils";

/**
 * Make staleness visible rather than inferable.
 *
 * A stalled socket and a stalled game look identical from the sofa, and that is
 * how eight people spend ten minutes arguing with a frozen screen.
 *
 * **The phone is told about its writes and not only about its socket.** They are
 * different paths and they fail separately: the socket is how a screen hears,
 * and the phone is the one device that speaks. A phone whose socket is perfectly
 * connected while every write times out is the worst case this badge exists for,
 * because everything on screen looks right — the board, the name, the green dot
 * — and the game has stopped. The television is given no such thing: it never
 * writes, so it has nothing to report.
 *
 * **A write that was refused is not a write that failed.** A stale version and a
 * rejected value are the server answering; only a write that reached no answer
 * at all makes this say so, and a phone that has not written yet says nothing
 * about writes.
 */

interface Props {
  status: ChannelStatus;

  /**
   * What the phone's writes are doing. Absent on a television, which has none.
   */
  writes?: WriteHealth;

  /** The television is read from three metres away; the phone, from thirty centimetres. */
  size?: "phone" | "tv";
}

type Health = "live" | "connecting" | "offline" | "not-saving";

/**
 * What the two signals mean together.
 *
 * A dead socket wins: a screen that cannot hear has nothing to say about whether
 * it can speak, and telling a room two things at once tells it nothing.
 */
export function badgeHealth (status: ChannelStatus, writes: WriteHealth): Health {
  if (status === "offline") {
    return "offline";
  }

  if (writes === "failing") {
    return "not-saving";
  }

  return status === "connecting" ? "connecting" : "live";
}

const LABELS: Record<Health, string> = {
  live: "Live",
  connecting: "Connecting…",
  offline: "Offline",
  "not-saving": "Not saving",
};

const DOTS: Record<Health, string> = {
  live: "bg-[var(--success)]",
  connecting: "bg-accent",
  offline: "bg-destructive",
  "not-saving": "bg-destructive",
};

export function ConnectionBadge ({ status, writes = "idle", size = "phone" }: Props) {
  const health = badgeHealth(status, writes);

  return (
    <span
      data-connection={health}
      className={cn(
        "inline-flex items-center gap-2 font-mono",
        health === "not-saving" ? "text-destructive" : "text-muted-foreground",
        size === "tv" ? "gap-[0.4em] text-[0.9em]" : "text-xs",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(size === "tv" ? "size-[0.5em]" : "size-2", "rounded-full", DOTS[health])}
      />
      {LABELS[health]}
    </span>
  );
}
