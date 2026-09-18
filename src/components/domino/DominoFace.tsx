import type { ReactElement } from "react";
import { cn } from "@/lib/utils";
import {
  PIP_GRID_SIZE,
  TILE_HALF_HEIGHT,
  TILE_VIEWBOX,
  getPipMask,
  tileFaces,
} from "./dominoPips";

/**
 * A tile with its faces up, as one inline `<svg>` of eleven nodes.
 *
 * It scales by its box and not by a pixel size: the same element is a thumb-wide
 * tile on a phone and a hand-wide tile on a television, because every length it
 * draws is in view-box units.
 *
 * It paints the string it is given and reads nothing else. A tile it cannot draw
 * comes out blank rather than missing, so a face this build has never seen
 * leaves the board complete.
 */

/** Centres of the 3×3 grid within a 100-unit half, on both axes. */
const PIP_CENTRES = [ 26, 50, 74 ];

const PIP_RADIUS = 9;

/** The pips of a taken position keep their shape and give up their contrast. */
const MUTED_PIP_OPACITY = 0.3;

const MUTED_FACE_OPACITY = 0.55;

interface Props {

  /** The two-character tile value (TR-02). */
  tile: string;

  /**
   * The 1-based pool position, which this element announces and never paints.
   *
   * Null is a tile that is not on a board — the one just turned over, shown on
   * its own — and it names no position because it is in no grid. On a board it
   * is always given: two positions of the same pool can hold the same face taken
   * by the same seat, and without the number a screen reader hears one cell
   * twice and cannot map either onto the position somebody said out loud.
   */
  position?: number | null;

  /**
   * The seat this position is attributed to, painted in brass over the tile so
   * the board reads as a list of names from a sofa. Null paints no badge.
   */
  seat?: number | null;

  /** Drains the tile's contrast, which is what a position already taken looks like (TR-08). */
  muted?: boolean;

  className?: string;
}

function halfPips (face: number, offsetY: number): ReactElement[] {
  return getPipMask(face).flatMap((lit, cell) => {
    if (!lit) {
      return [];
    }

    const row = Math.floor(cell / PIP_GRID_SIZE);
    const column = cell % PIP_GRID_SIZE;

    return [
      <circle
        key={`${offsetY}-${cell}`}
        cx={PIP_CENTRES[column]}
        cy={PIP_CENTRES[row] + offsetY}
        r={PIP_RADIUS}
      />,
    ];
  });
}

export function DominoFace ({ tile, position = null, seat = null, muted = false, className }: Props) {
  const faces = tileFaces(tile);

  /*
   * The name is built clause by clause, so a clause the renderer cannot fill
   * never takes another one with it: a tile string this build's pip map cannot
   * draw loses its two faces from the name and keeps its position and its seat,
   * which is what the badge over it is already telling anybody who can see it.
   */
  const facePart = faces === null ? "tile" : `tile ${faces[0]} ${faces[1]}`;
  const seatPart = seat === null ? "" : `, seat ${seat}`;
  const label = position === null
    ? `${facePart.charAt(0).toUpperCase()}${facePart.slice(1)}${seatPart}`
    : `Position ${position}, ${facePart}${seatPart}`;

  return (
    <svg
      viewBox={TILE_VIEWBOX}
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid meet"
      className={cn("block size-full", className)}
    >
      <rect
        x="1"
        y="1"
        width="98"
        height="198"
        rx="10"
        fill="var(--tile-face)"
        stroke="var(--tile-edge)"
        strokeWidth="2"
        opacity={muted ? MUTED_FACE_OPACITY : 1}
      />
      <line
        x1="12"
        y1={TILE_HALF_HEIGHT}
        x2="88"
        y2={TILE_HALF_HEIGHT}
        stroke="var(--tile-edge)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity={muted ? MUTED_FACE_OPACITY : 1}
      />
      {faces !== null && (
        <g data-pips="" fill="var(--tile-pip)" opacity={muted ? MUTED_PIP_OPACITY : 1}>
          {halfPips(faces[0], 0)}
          {halfPips(faces[1], TILE_HALF_HEIGHT)}
        </g>
      )}
      {seat !== null && (
        <g data-seat={seat}>
          <circle
            cx="50"
            cy={TILE_HALF_HEIGHT}
            r="30"
            fill="var(--accent)"
            stroke="var(--tile-face)"
            strokeWidth="3"
          />
          <text
            x="50"
            y={TILE_HALF_HEIGHT}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="34"
            fontWeight="700"
            fill="var(--accent-foreground)"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {seat}
          </text>
        </g>
      )}
    </svg>
  );
}
