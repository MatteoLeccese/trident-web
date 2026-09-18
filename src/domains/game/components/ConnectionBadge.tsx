"use client";

import { cn } from "@/lib/utils";
import type { ChannelStatus } from "@/domains/game/hooks/useGameChannel";

/**
 * Make staleness visible rather than inferable.
 *
 * A stalled socket and a stalled game look identical from the sofa, and that is
 * how eight people spend ten minutes arguing with a frozen screen.
 */
interface Props {
  status: ChannelStatus;

  /** The television is read from three metres away; the phone, from thirty centimetres. */
  size?: "phone" | "tv";
}

export function ConnectionBadge ({ status, size = "phone" }: Props) {
  const label = {
    connecting: "Connecting…",
    connected: "Live",
    offline: "Offline",
  }[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-mono text-muted-foreground",
        size === "tv" ? "gap-[0.4em] text-[0.9em]" : "text-xs",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          size === "tv" ? "size-[0.5em]" : "size-2",
          "rounded-full",
          status === "connected" && "bg-[var(--success)]",
          status === "connecting" && "bg-accent",
          status === "offline" && "bg-destructive",
        )}
      />
      {label}
    </span>
  );
}
