"use client";

import { cn } from "@/lib/utils";
import type { Seat } from "@/domains/game/types";

interface Props {
  seats: Seat[];

  /** The television is read from three metres away; the phone, from thirty centimetres. */
  size?: "phone" | "tv";
  onRename?: (seat: Seat) => void;
}

export function SeatList ({ seats, size = "phone", onRename }: Props) {
  const isTv = size === "tv";

  return (
    <ul className={cn("grid gap-2", isTv && "gap-4 sm:grid-cols-2")}>
      {seats.map((seat) => (
        <li key={seat.seat}>
          <button
            type="button"
            disabled={onRename === undefined}
            onClick={() => onRename?.(seat)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg border border-border bg-card text-left",
              "transition-colors enabled:hover:border-accent disabled:cursor-default",
              isTv ? "px-6 py-5" : "px-4 py-3",
            )}
          >
            <span
              className={cn(
                "flex shrink-0 items-center justify-center rounded-md bg-muted font-mono tabular-nums text-muted-foreground",
                isTv ? "size-12 text-2xl" : "size-8 text-sm",
              )}
            >
              {seat.seat}
            </span>
            <span className={cn("truncate font-medium", isTv ? "text-4xl" : "text-lg")}>
              {seat.nickname}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
