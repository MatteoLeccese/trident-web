import { cn } from "@/lib/utils";
import { TILE_VIEWBOX } from "./dominoPips";

/**
 * A place on the board with no tile in it, in the same box as `DominoFace` and
 * `DominoBack`.
 *
 * It exists so that a board which takes its tiles away keeps its geometry. All
 * three elements share one view box, so swapping a tile for this one changes no
 * length the grid was solved for: the columns, the rows and every neighbour stay
 * exactly where they were. A board that rearranged itself between turns is how
 * somebody taps the wrong tile.
 *
 * It is inert: no control, no face, no seat. What it draws is the outline of the
 * place the tile came out of — dashed, at low contrast, the recess and not the
 * tile — so the board reads as a table being cleared and not as a renderer that
 * failed.
 */

interface Props {

  /**
   * The 1-based pool position, which this element announces and never paints.
   * Null names no position, which is an empty place outside any grid.
   */
  position?: number | null;

  className?: string;
}

export function DominoGap ({ position = null, className }: Props) {
  return (
    <svg
      viewBox={TILE_VIEWBOX}
      role="img"
      aria-label={position === null ? "Empty place" : `Position ${position}, empty place`}
      preserveAspectRatio="xMidYMid meet"
      className={cn("block size-full", className)}
    >
      <rect
        data-gap=""
        x="4"
        y="4"
        width="92"
        height="192"
        rx="10"
        fill="var(--muted)"
        stroke="var(--tile-edge)"
        strokeWidth="2"
        strokeDasharray="8 8"
        opacity="0.4"
      />
    </svg>
  );
}
