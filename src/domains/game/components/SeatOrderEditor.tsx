"use client";

import { useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import type { Seat } from "@/domains/game/types";
import { isSameOrder, moveSeat, seatOrder } from "@/domains/game/utils/seatOrder";
import { nicknameOf } from "@/domains/game/utils/seats";
import { cn } from "@/lib/utils";

/**
 * The order the phone travels in, edited in the lobby.
 *
 * **Pointer events and not HTML5 drag and drop.** `dragstart` never fires from a
 * touch, and a touch is the entire platform: one phone, passed around a table.
 * Pointer events are the one API that covers a finger, a mouse and a stylus with
 * the same handlers.
 *
 * **`touch-action: none` is on the handle and nowhere else.** Put it on the row
 * or on the list and the list stops scrolling, which with twelve players means
 * the names at the bottom become unreachable — a worse bug than the one it
 * fixes. The handle is a deliberate target; everything around it still scrolls.
 *
 * **The up and down buttons are always visible.** They are the accessible path,
 * the thumb path and the one-handed path at once, and a table sorting itself out
 * uses them far more than the drag. They are not a fallback that appears when
 * something else fails.
 *
 * What is written is an **absolute permutation** of the ring, never a move, so
 * sending it twice lands on the same order.
 */

interface Props {
  seats: Seat[];

  /** Closed once the game leaves the lobby: the ring is fixed when play begins. */
  disabled?: boolean;

  onSave: (order: number[]) => void;

  saving?: boolean;

  error?: string | null;
}

export function SeatOrderEditor ({ seats, disabled = false, onSave, saving = false, error = null }: Props) {
  const saved = seatOrder(seats);
  const [ order, setOrder ] = useState<number[]>(saved);
  const [ dragging, setDragging ] = useState<number | null>(null);
  const listRef = useRef<HTMLOListElement | null>(null);

  // A roster that changed under the editor — a rename, a reorder from elsewhere —
  // replaces an edit that no longer applies to this table.
  const [ base, setBase ] = useState<number[]>(saved);

  if (!isSameOrder(base, saved)) {
    setBase(saved);
    setOrder(saved);
  }

  const dirty = !isSameOrder(order, saved);
  const locked = disabled || saving;

  /** The row the pointer is over, by index, using the midpoint of each row. */
  const indexAt = (clientY: number): number | null => {
    const list = listRef.current;

    if (list === null) {
      return null;
    }

    const rows = Array.from(list.querySelectorAll<HTMLElement>("[data-seat-row]"));

    for (const [ index, row ] of rows.entries()) {
      const rect = row.getBoundingClientRect();

      if (clientY < rect.top + rect.height / 2) {
        return index;
      }
    }

    return rows.length === 0 ? null : rows.length - 1;
  };

  const move = (from: number, to: number) => {
    if (locked) {
      return;
    }

    setOrder((current) => moveSeat(current, from, to));
  };

  return (
    <div data-seat-order="" className="flex flex-col gap-4">
      <ol ref={listRef} className="flex flex-col gap-2">
        {order.map((seat, index) => {
          const name = nicknameOf(seats, seat);

          return (
            <li
              key={seat}
              data-seat-row={seat}
              data-dragging={dragging === index ? "" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-lg border bg-card px-2 py-2",
                dragging === index ? "border-accent" : "border-border",
              )}
            >
              <button
                type="button"
                aria-label={`Reorder ${name ?? `seat ${seat}`}`}
                data-drag-handle={seat}
                disabled={locked}

                /* Only the handle refuses the browser's own gestures; the list still scrolls. */
                style={{ touchAction: "none" }}
                onPointerDown={(event) => {
                  if (locked) {
                    return;
                  }

                  event.currentTarget.setPointerCapture?.(event.pointerId);
                  setDragging(index);
                }}
                onPointerMove={(event) => {
                  if (dragging === null) {
                    return;
                  }

                  const to = indexAt(event.clientY);

                  if (to !== null && to !== dragging) {
                    move(dragging, to);
                    setDragging(to);
                  }
                }}
                onPointerUp={() => setDragging(null)}
                onPointerCancel={() => setDragging(null)}
                className="cursor-grab rounded-md p-2 text-muted-foreground disabled:opacity-40"
              >
                <GripVertical className="size-5" aria-hidden="true" />
              </button>

              <span className="w-8 shrink-0 text-center font-mono text-sm tabular-nums text-muted-foreground">
                {index + 1}
              </span>

              <span className="flex-1 truncate font-medium">{name ?? `Seat ${seat}`}</span>

              <button
                type="button"
                aria-label={`Move ${name ?? `seat ${seat}`} up`}
                disabled={locked || index === 0}
                onClick={() => move(index, index - 1)}
                className="rounded-md border border-border px-3 py-2 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move ${name ?? `seat ${seat}`} down`}
                disabled={locked || index === order.length - 1}
                onClick={() => move(index, index + 1)}
                className="rounded-md border border-border px-3 py-2 disabled:opacity-30"
              >
                ↓
              </button>
            </li>
          );
        })}
      </ol>

      {error !== null && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={locked || !dirty}
          onClick={() => setOrder(saved)}
          className="rounded-lg border border-border px-4 py-2 disabled:opacity-40"
        >
          Undo
        </button>
        <button
          type="button"
          disabled={locked || !dirty}
          onClick={() => onSave(order)}
          data-save-order=""
          className="flex-1 rounded-lg bg-primary py-2 font-medium text-primary-foreground disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save the order"}
        </button>
      </div>
    </div>
  );
}
