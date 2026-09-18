import { cn } from "@/lib/utils";
import { TILE_VIEWBOX } from "./dominoPips";

/**
 * A tile face down, in the same box as `DominoFace`.
 *
 * Sharing the view box is what makes turning a tile over free: the two elements
 * occupy the same geometry, so the swap changes no layout and the board around
 * it does not move.
 *
 * It is drawn as the back of a domino and carries no emblem: the same bone body
 * and the same edge as a face, in the darker tone the material takes on the
 * other side, with an inset bevel and nothing else. The bevel is also what
 * separates it from a face at a glance — a face is split across the middle by
 * its divider, and a back never is, which is what keeps a tile face down from
 * reading as the double blank.
 *
 * It carries a tilt of a couple of degrees that is a function of the position,
 * so that a pool reads as tiles laid on a table and not as a spreadsheet of
 * identical rectangles. The tilt is a transform and never a layout property: it
 * moves no neighbour.
 */

/** The widest the tilt goes, in degrees. */
export const MAX_TILT_DEGREES = 2.2;

/**
 * Odd multiplier, taken modulo a power of two: it scatters consecutive positions
 * instead of walking them, which is the whole point when the positions on a
 * board are 1 to 49 in order.
 */
const TILT_SCATTER = 2654435761;

const TILT_PERIOD = 2048;

/**
 * The tilt of the tile at a position, in degrees.
 *
 * Deterministic: the same position tilts the same way on the phone and on the
 * television, and again after a reload, because it is a function of the position
 * and of nothing else — no random, no mount order, no state.
 */
export function backTiltDegrees (position: number): number {
  const scattered = Math.abs(Math.trunc(position) * TILT_SCATTER % TILT_PERIOD) / TILT_PERIOD;

  return Math.round((scattered * 2 - 1) * MAX_TILT_DEGREES * 1000) / 1000;
}

interface Props {

  /**
   * The 1-based pool position. It decides the tilt, and it is what this element
   * announces: face down, every back on the board draws the same picture, so the
   * number is the only thing that tells one cell from another out loud.
   */
  position: number;

  className?: string;
}

export function DominoBack ({ position, className }: Props) {
  return (
    <svg
      viewBox={TILE_VIEWBOX}
      role="img"
      aria-label={`Position ${position}, face down`}
      preserveAspectRatio="xMidYMid meet"
      style={{ transform: `rotate(${backTiltDegrees(position)}deg)` }}
      className={cn("block size-full", className)}
    >
      <rect
        x="1"
        y="1"
        width="98"
        height="198"
        rx="10"
        fill="var(--tile-back)"
        stroke="var(--tile-edge)"
        strokeWidth="2"
      />
      <rect
        data-bevel=""
        x="9"
        y="9"
        width="82"
        height="182"
        rx="6"
        fill="none"
        stroke="var(--tile-edge)"
        strokeWidth="2"
      />
    </svg>
  );
}
