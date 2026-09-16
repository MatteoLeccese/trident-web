"use client";

import { cn } from "@/lib/utils";
import type { ChannelStatus } from "@/domains/game/hooks/useGameChannel";

/**
 * Make staleness visible rather than inferable.
 *
 * A stalled socket and a stalled game look identical from the sofa, and that is
 * how eight people spend ten minutes arguing with a frozen screen.
 */
export function ConnectionBadge ({ status }: { status: ChannelStatus; }) {
  const label = {
    connecting: "Conectando…",
    connected: "En vivo",
    offline: "Sin conexión",
  }[status];

  return (
    <span className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground">
      <span
        aria-hidden="true"
        className={cn(
          "size-2 rounded-full",
          status === "connected" && "bg-[var(--success)]",
          status === "connecting" && "bg-accent",
          status === "offline" && "bg-destructive",
        )}
      />
      {label}
    </span>
  );
}
