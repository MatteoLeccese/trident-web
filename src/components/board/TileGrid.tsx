"use client";

import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { DominoBack } from "@/components/domino/DominoBack";
import { DominoFace } from "@/components/domino/DominoFace";
import { DominoGap } from "@/components/domino/DominoGap";
import type { PoolPosition } from "@/domains/game/types";
import { cn } from "@/lib/utils";
import { type GridBox, solveTileGrid } from "./tileGridSolver";

/**
 * The board: every position of the pool, at the largest size that fits.
 *
 * It paints the pool exactly as the snapshot carries it and decides nothing
 * about it. A position with no face is face down because the stage keeps it so
 * (TR-07), a taken position stays where it is and keeps its number (TR-08), it
 * carries the seat the snapshot attributes it to, it shows a tile or an empty
 * place according to the snapshot's `on_board`, and which positions exist at all
 * is the ruleset's answer and not this component's.
 *
 * Nothing here composes a settings key or reads `room_config`: the table's
 * choice about the tiles it has drawn reaches this file already resolved, as one
 * boolean per position (R1).
 *
 * The arrangement comes from `solveTileGrid`, which is measured against the
 * scroller's own box: the header is a sibling of the scroller and not a child,
 * so it never scrolls away and never takes part in the measurement.
 */

interface Props {
  positions: PoolPosition[];

  /** Stays above the board, outside the scroller. */
  header?: ReactNode;

  /** Called with the position number. Absent leaves the board read-only, which is what a television is. */
  onSelect?: (position: number) => void;

  /**
   * Holds every position while a write is in flight.
   *
   * The controls stay mounted and are disabled, never removed: the element a
   * finger or a keyboard has just activated is the element the phase change
   * arrives on, and destroying it drops the focus to the top of the document
   * with a modal opening underneath.
   */
  disabled?: boolean;

  /**
   * Whether a taken position gives up its contrast (TR-08).
   *
   * It is the caller's answer and not this component's, because it depends on
   * what the screen is for: on a board being played, muting is what tells a
   * taken position from one that can still be tapped, and on the board as it
   * ended every position is taken, so muting all forty-nine drains the contrast
   * out of the whole record to draw a distinction that no longer exists.
   */
  mutesTakenPositions?: boolean;

  /**
   * Whether a position the snapshot has taken off the board is painted as an
   * empty place rather than as its tile.
   *
   * It is the caller's answer and not this component's, for the same reason
   * `mutesTakenPositions` is: on a board being played the empty place is the
   * whole point of the setting, and on the board as it ended every position is
   * taken, so honouring it would paint forty-nine empty places and leave no
   * record of the evening on the screen that exists to show one.
   */
  honoursBoardPresence?: boolean;

  /**
   * The position the phone has just touched.
   *
   * It drops to 0.96 **before anything reaches the network**, so the tile answers
   * the finger and the question that follows is clearly about that tile. It is
   * the one thing on the board a tap changes by itself: what the tile shows still
   * changes only when the state does.
   */
  pressedPosition?: number | null;

  /** Space between tiles. A television is read from three metres and wants more of it. */
  gap?: number;

  className?: string;
}

/** Reads the box the grid has to fill, and follows it: a rotated phone is a new box. */
function useElementBox (): [ RefObject<HTMLDivElement | null>, GridBox | null ] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [ box, setBox ] = useState<GridBox | null>(null);

  useEffect(() => {
    const node = ref.current;

    if (node === null || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (entry === undefined) {
        return;
      }

      const { width, height } = entry.contentRect;

      setBox((current) => current !== null && current.width === width && current.height === height
        ? current
        : { width, height });
    });

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return [ ref, box ];
}

export function TileGrid ({
  positions,
  header,
  onSelect,
  disabled = false,
  mutesTakenPositions = true,
  honoursBoardPresence = true,
  pressedPosition = null,
  gap = 8,
  className,
}: Props) {
  const [ scroller, box ] = useElementBox();
  const layout = box === null
    ? null
    : solveTileGrid(box, positions.length, { gap });

  return (
    <section className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {header !== undefined && (
        <div data-board-header="" className="shrink-0">
          {header}
        </div>
      )}
      <div
        ref={scroller}
        data-board-scroller=""
        className="min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
      >
        {layout !== null && layout.columns > 0 && (
          <ul
            data-tile-grid=""
            data-columns={layout.columns}
            className="grid content-start justify-center"
            style={{
              gridTemplateColumns: `repeat(${layout.columns}, ${layout.tileWidth}px)`,
              gridAutoRows: `${layout.tileHeight}px`,
              gap: `${gap}px`,
            }}
          >
            {positions.map((position, index) => {

              /*
               * A position off the board paints an empty place, and one still on
               * it paints its face or its back. `DominoGap` shares the view box
               * of both, so the swap costs the grid no length and no neighbour
               * moves.
               */
              const offBoard = honoursBoardPresence && !position.on_board;
              const controllable = onSelect !== undefined && !position.taken;
              let tile = <DominoBack position={position.position} />;

              if (offBoard) {
                tile = <DominoGap position={position.position} />;
              } else if (position.tile !== null) {
                tile = (
                  <DominoFace
                    tile={position.tile}
                    position={position.position}
                    muted={mutesTakenPositions && position.taken}
                    seat={position.seat}
                  />
                );
              }

              return (
                <li
                  key={position.position}
                  data-position={position.position}
                  data-pressed={position.position === pressedPosition ? "" : undefined}
                  data-off-board={offBoard ? "" : undefined}

                  /* The first tile of a row is where the scroller lands, so a scrolled board stops on whole rows. */
                  className={cn(
                    "size-full transition-transform",
                    index % layout.columns === 0 && "snap-start",
                    position.position === pressedPosition && "scale-[0.96]",
                  )}
                >
                  {/*
                    * The control carries no name of its own: the element inside
                    * it already announces the position, the face and the seat,
                    * and a second name on the button would replace all three
                    * with a bare position number. One cell, one name, and the
                    * board says the same thing whether or not it can be tapped.
                    */}
                  {controllable
                    ? (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onSelect(position.position)}
                        className="size-full rounded-[10%/5%] transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] enabled:hover:-translate-y-0.5"
                      >
                        {tile}
                      </button>
                    )
                    : tile}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
