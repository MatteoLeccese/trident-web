import { TILE_ASPECT } from "@/components/domino/dominoPips";

/**
 * Where all forty-nine tiles go.
 *
 * The board shows every position at once and never hides one behind a fold, a
 * page or a "show more": the pool is the game's only board and a position a
 * player cannot see is a position nobody taps. CSS cannot arrange it —
 * `repeat(auto-fit, minmax())` resolves the wide axis alone and cannot trade a
 * column for a row, so it answers a short wide box with ten rows and an
 * overflow. This searches both axes instead: for every column count it works out
 * how wide a 1:2 tile may be across and down, keeps the smaller, and takes the
 * arrangement whose tile comes out largest.
 *
 * When no arrangement reaches a legible size the answer is scrolling, deliberately
 * and not by accident: the tile stays large, the grid keeps as many columns as fit
 * at that size, and the caller scrolls a board that is honestly taller than the
 * screen.
 *
 * It is a pure function of a box and a count, so a layout can be asserted against
 * a table of viewports without rendering anything.
 */

export interface GridBox {
  width: number;
  height: number;
}

export interface TileGridOptions {

  /** Space between tiles, on both axes. */
  gap: number;

  /** Tile height over tile width. */
  aspect: number;

  /** Below this the pips stop reading, so the layout scrolls rather than shrink past it. */
  minTileWidth: number;

  /** Above this a tile stops gaining legibility and only costs the board its columns. */
  maxTileWidth: number;

  /** Rows that must be visible at once when the board scrolls, so that it reads as a grid. */
  minVisibleRows: number;
}

export interface TileGridLayout {
  columns: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
  contentWidth: number;
  contentHeight: number;

  /** Whether the arrangement is taller than the box it was solved for. */
  scrolls: boolean;
}

/**
 * The smallest tile whose pips still read: a pip is a fifth of the tile's width,
 * so this is a dot of about nine device pixels at arm's length.
 */
export const MIN_TILE_WIDTH = 46;

/** A tile as wide as a hand on a television. Past it the board only loses columns. */
export const MAX_TILE_WIDTH = 340;

export const defaultTileGridOptions: TileGridOptions = {
  gap: 8,
  aspect: TILE_ASPECT,
  minTileWidth: MIN_TILE_WIDTH,
  maxTileWidth: MAX_TILE_WIDTH,
  minVisibleRows: 2,
};

const EMPTY_LAYOUT: TileGridLayout = {
  columns: 0,
  rows: 0,
  tileWidth: 0,
  tileHeight: 0,
  contentWidth: 0,
  contentHeight: 0,
  scrolls: false,
};

/** How wide a tile may be if `columns` of them share the width. */
function widthAcross (box: GridBox, options: TileGridOptions, columns: number): number {
  return (box.width - options.gap * (columns - 1)) / columns;
}

/** How wide a tile may be if `rows` of them share the height, at the aspect a domino has. */
function widthDown (box: GridBox, options: TileGridOptions, rows: number): number {
  return (box.height - options.gap * (rows - 1)) / rows / options.aspect;
}

function rowsFor (count: number, columns: number): number {
  return Math.ceil(count / columns);
}

function layoutOf (box: GridBox, options: TileGridOptions, count: number, columns: number, width: number): TileGridLayout {
  const tileWidth = Math.max(0, Math.floor(width));
  const tileHeight = Math.floor(tileWidth * options.aspect);
  const rows = rowsFor(count, columns);
  const contentWidth = columns * tileWidth + options.gap * (columns - 1);
  const contentHeight = rows * tileHeight + options.gap * (rows - 1);

  return {
    columns,
    rows,
    tileWidth,
    tileHeight,
    contentWidth,
    contentHeight,
    scrolls: contentHeight > box.height,
  };
}

/**
 * The column count whose tile comes out largest with everything inside the box.
 *
 * Ties are broken towards fewer rows and then fewer columns, which is the same
 * board packed tighter: at an equal tile size a shorter, narrower block leaves
 * the ragged last row shorter and the whole grid centred.
 */
function bestFittingColumns (box: GridBox, options: TileGridOptions, count: number): { columns: number; width: number; } {
  let best = { columns: 1, width: Number.NEGATIVE_INFINITY, rows: count };

  for (let columns = 1; columns <= count; columns += 1) {
    const rows = rowsFor(count, columns);
    const width = Math.min(
      widthAcross(box, options, columns),
      widthDown(box, options, rows),
      options.maxTileWidth,
    );

    const better = width > best.width
      || (width === best.width && rows < best.rows);

    if (better) {
      best = { columns, width, rows };
    }
  }

  return { columns: best.columns, width: best.width };
}

/**
 * The arrangement of `count` tiles inside `box`.
 *
 * Never returns fewer positions than it was asked for: `columns * rows` covers
 * the count, and the last row is short rather than the board being cut.
 */
export function solveTileGrid (box: GridBox, count: number, options: Partial<TileGridOptions> = {}): TileGridLayout {
  const settings: TileGridOptions = { ...defaultTileGridOptions, ...options };

  if (count <= 0) {
    return EMPTY_LAYOUT;
  }

  const fitted = bestFittingColumns(box, settings, count);

  if (fitted.width >= settings.minTileWidth) {
    return layoutOf(box, settings, count, fitted.columns, fitted.width);
  }

  /*
   * Nothing fits legibly, so the board scrolls. The tile is capped by the rows
   * that have to stay visible, never by the height of the whole board, and the
   * legible minimum outranks that cap: a box too short for two rows of legible
   * tiles gets two legible tiles and more scrolling, not a grid of pips nobody
   * can read.
   */
  const cap = Math.min(settings.maxTileWidth, widthDown(box, settings, settings.minVisibleRows));
  let columns = 1;

  while (columns < count && widthAcross(box, settings, columns) > cap) {
    columns += 1;
  }

  while (columns > 1 && widthAcross(box, settings, columns) < settings.minTileWidth) {
    columns -= 1;
  }

  return layoutOf(box, settings, count, columns, widthAcross(box, settings, columns));
}
