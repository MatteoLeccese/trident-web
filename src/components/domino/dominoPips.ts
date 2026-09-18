/**
 * The facts a domino has of its own: how a face lays its pips out, and what a
 * tile string is.
 *
 * `pipCoordsMap` and `getPipMask` are the salvaged renderer's, unchanged
 * (`SALVAGE.md`). Everything that paints a tile inherits them.
 *
 * Nothing here singles a face out. The map treats every face the same way and
 * no caller branches on a value: a tile is the two-character string the wire
 * carries (TR-02), `21` and `12` are different tiles, and which face means what
 * is the ruleset's business and never a component's.
 */

// Defines which grid cells get a dot for each pip‐count (0–6)
export const pipCoordsMap: Record<number, [number, number][]> = {
  0: [],
  1: [ [ 1, 1 ] ],
  2: [ [ 0, 0 ], [ 2, 2 ] ],
  3: [ [ 0, 0 ], [ 1, 1 ], [ 2, 2 ] ],
  4: [ [ 0, 0 ], [ 0, 2 ], [ 2, 0 ], [ 2, 2 ] ],
  5: [ [ 0, 0 ], [ 0, 2 ], [ 1, 1 ], [ 2, 0 ], [ 2, 2 ] ],
  6: [ [ 0, 0 ], [ 0, 2 ], [ 1, 0 ], [ 1, 2 ], [ 2, 0 ], [ 2, 2 ] ],
};

/**
 * Returns a flat array of length 9 (3×3) where true means “draw a dot”
 */
export function getPipMask (count: number): boolean[] {
  const mask: boolean[] = Array(9).fill(false);

  for (const [ r, c ] of pipCoordsMap[count] || []) {
    mask[r * 3 + c] = true;
  }

  return mask;
}

/** The cells of the 3×3 grid, and therefore the length of a mask. */
export const PIP_CELLS = 9;

/** Columns of the 3×3 grid: a mask index is `row * PIP_GRID_SIZE + column`. */
export const PIP_GRID_SIZE = 3;

/**
 * The coordinate box both the face and the back are drawn in.
 *
 * They share it so that turning a tile over swaps one `<svg>` for another of
 * identical geometry: the flip changes no layout and the board does not reflow.
 */
export const TILE_VIEWBOX = "0 0 100 200";

/** A domino is twice as tall as it is wide, which is a constraint of any layout that places one. */
export const TILE_ASPECT = 2;

/** Half of the view box, and the y offset of the second face. */
export const TILE_HALF_HEIGHT = 100;

/** A tile the pip map can draw: two characters, one per face. */
const TILE_PATTERN = /^[0-6]{2}$/;

/** Whether the string is a tile this renderer knows how to draw. */
export function isTileValue (value: string): boolean {
  return TILE_PATTERN.test(value);
}

/**
 * The two faces of a tile, in wire order, or null when the string is not one
 * this renderer can draw.
 *
 * The order is the string's and is never sorted: the left face and the right
 * face are distinct positions of the same tile (TR-02).
 */
export function tileFaces (value: string): [number, number] | null {
  if (!isTileValue(value)) {
    return null;
  }

  return [ parseInt(value[0], 10), parseInt(value[1], 10) ];
}
