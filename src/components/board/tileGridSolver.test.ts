import { describe, expect, it } from "vitest";
import {
  MAX_TILE_WIDTH,
  MIN_TILE_WIDTH,
  type GridBox,
  type TileGridLayout,
  solveTileGrid,
} from "./tileGridSolver";

/**
 * The solver is tested as a function and never through a rendered board: a
 * layout that only exists inside a component is one nobody can debug when a
 * television shows ten rows and an overflow.
 */

/** The pool a stage materialises (TR-01). Every one of them is placed, always. */
const POOL_SIZE = 49;

interface Viewport {
  name: string;
  box: GridBox;
  gap: number;
}

const VIEWPORTS: Viewport[] = [
  { name: "a small phone in portrait", box: { width: 360, height: 640 }, gap: 8 },
  { name: "a phone in portrait", box: { width: 390, height: 740 }, gap: 8 },
  { name: "a phone in landscape", box: { width: 740, height: 360 }, gap: 8 },
  { name: "a tablet", box: { width: 1024, height: 768 }, gap: 10 },
  // 1080p less five per cent of overscan at each edge: the whole safe area.
  { name: "a television inside its safe area", box: { width: 1812, height: 972 }, gap: 12 },

  /*
   * The box a television in play really gives the board, which is not the safe
   * area: the screen splits into two columns and the board takes the wider one,
   * less the header, the idle notice and the cursor stacked above it. Measured
   * at 1080p that is about 888 by 696.
   */
  { name: "a television's board column in play", box: { width: 888, height: 696 }, gap: 14 },
];

function contentFits (layout: TileGridLayout, box: GridBox): boolean {
  return layout.contentWidth <= box.width && layout.contentHeight <= box.height;
}

describe("the tile grid solver, over a table of viewports", () => {
  it.each(VIEWPORTS)("places every tile on $name", ({ box, gap }) => {
    const layout = solveTileGrid(box, POOL_SIZE, { gap });

    expect(layout.columns * layout.rows).toBeGreaterThanOrEqual(POOL_SIZE);
    expect(layout.rows).toBe(Math.ceil(POOL_SIZE / layout.columns));
  });

  it.each(VIEWPORTS)("keeps the tile legible on $name", ({ box, gap }) => {
    const layout = solveTileGrid(box, POOL_SIZE, { gap });

    expect(layout.tileWidth).toBeGreaterThanOrEqual(MIN_TILE_WIDTH);
    expect(layout.tileWidth).toBeLessThanOrEqual(MAX_TILE_WIDTH);
  });

  it.each(VIEWPORTS)("keeps a domino a domino on $name", ({ box, gap }) => {
    const layout = solveTileGrid(box, POOL_SIZE, { gap });

    expect(layout.tileHeight).toBe(layout.tileWidth * 2);
  });

  it.each(VIEWPORTS)("never overflows sideways on $name", ({ box, gap }) => {
    // A horizontal overflow is the failure `repeat(auto-fit, minmax())` produces
    // and the reason the arrangement is searched instead of declared.
    const layout = solveTileGrid(box, POOL_SIZE, { gap });

    expect(layout.contentWidth).toBeLessThanOrEqual(box.width);
  });

  it.each(VIEWPORTS)("only reports scrolling when the board really is taller than $name", ({ box, gap }) => {
    const layout = solveTileGrid(box, POOL_SIZE, { gap });

    expect(layout.scrolls).toBe(layout.contentHeight > box.height);
  });

  it.each(VIEWPORTS)("shows at least two rows at once even when $name scrolls", ({ box, gap }) => {
    // Scrolling is designed for and not fallen into: a scroller showing one row
    // is a carousel, and the board stops reading as a board.
    const layout = solveTileGrid(box, POOL_SIZE, { gap });

    if (layout.scrolls) {
      expect(layout.tileHeight * 2 + gap).toBeLessThanOrEqual(box.height);
    }
  });
});

describe("the tile grid solver", () => {
  it("fits all forty-nine on a television without scrolling, at a tile that reads from a sofa", () => {
    const box = { width: 1812, height: 972 };
    const layout = solveTileGrid(box, POOL_SIZE, { gap: 12 });

    expect(layout.scrolls).toBe(false);
    expect(contentFits(layout, box)).toBe(true);
    expect(layout.tileWidth).toBeGreaterThanOrEqual(100);
  });

  it("answers the column a television really gives the board with a tile smaller than a phone's", () => {

    /*
     * Pinned because it is a surprise and not a design: the screen read from
     * three metres lays out a smaller tile than the screen read at arm's length,
     * because the phone gives the board the whole width and scrolls, while the
     * television gives it half the width and must fit all forty-nine.
     *
     * Everything drawn on a tile is in view-box units, so every one of them
     * scales with this number: at 64 pixels across, a pip is under 6 across and
     * the seat digit is a 34/100 glyph, about 15 pixels tall. This assertion is
     * here so that a change to the television's layout is read as a change to
     * the legibility of the board, which is what it is.
     */
    const board = solveTileGrid({ width: 888, height: 696 }, POOL_SIZE, { gap: 14 });
    const phone = solveTileGrid({ width: 360, height: 640 }, POOL_SIZE, { gap: 10 });

    expect(board.columns).toBe(10);
    expect(board.tileWidth).toBe(64);
    expect(board.scrolls).toBe(false);
    expect(board.tileWidth).toBeLessThan(phone.tileWidth);
  });

  it("answers a small phone with a few large columns and scrolling, not with forty-nine crumbs", () => {
    const box = { width: 360, height: 640 };
    const layout = solveTileGrid(box, POOL_SIZE, { gap: 8 });

    expect(layout.columns).toBe(3);
    expect(layout.scrolls).toBe(true);
    expect(layout.tileWidth).toBeGreaterThan(100);
  });

  it("trades a column for a row when the box turns short and wide", () => {
    // The case CSS cannot express: the same area, laid out differently because
    // the height changed.
    const tall = solveTileGrid({ width: 700, height: 900 }, POOL_SIZE, { gap: 8 });
    const wide = solveTileGrid({ width: 900, height: 700 }, POOL_SIZE, { gap: 8 });

    expect(wide.columns).toBeGreaterThan(tall.columns);
    expect(wide.rows).toBeLessThan(tall.rows);
  });

  it("grows the tile with the box, up to the point where a tile stops gaining anything", () => {
    const television = solveTileGrid({ width: 1812, height: 972 }, POOL_SIZE, { gap: 12 });
    const wall = solveTileGrid({ width: 3648, height: 1980 }, POOL_SIZE, { gap: 16 });

    expect(wall.tileWidth).toBeGreaterThan(television.tileWidth);
    expect(wall.tileWidth).toBeLessThanOrEqual(MAX_TILE_WIDTH);
  });

  it("never lets the tile exceed the cap, however much room there is", () => {
    const layout = solveTileGrid({ width: 20000, height: 20000 }, POOL_SIZE, { gap: 8 });

    expect(layout.tileWidth).toBeLessThanOrEqual(MAX_TILE_WIDTH);
    expect(layout.tileWidth).toBeGreaterThanOrEqual(MIN_TILE_WIDTH);
  });

  it("takes the arrangement with the largest tile, and on a tie the one with fewer rows", () => {
    const layout = solveTileGrid({ width: 1024, height: 768 }, POOL_SIZE, { gap: 10 });

    for (let columns = 1; columns <= POOL_SIZE; columns += 1) {
      const rows = Math.ceil(POOL_SIZE / columns);
      const across = (1024 - 10 * (columns - 1)) / columns;
      const down = (768 - 10 * (rows - 1)) / rows / 2;
      const candidate = Math.min(across, down, MAX_TILE_WIDTH);

      expect(candidate).toBeLessThanOrEqual(layout.tileWidth + 1);

      if (Math.floor(candidate) === layout.tileWidth) {
        expect(rows).toBeGreaterThanOrEqual(layout.rows);
      }
    }
  });

  it("keeps the tile legible rather than obey the cap on a box too short for two rows of them", () => {
    const layout = solveTileGrid({ width: 200, height: 120 }, POOL_SIZE, { gap: 8 });

    expect(layout.tileWidth).toBeGreaterThanOrEqual(MIN_TILE_WIDTH);
    expect(layout.contentWidth).toBeLessThanOrEqual(200);
    expect(layout.scrolls).toBe(true);
  });

  it("holds every property over a sweep of boxes", () => {
    for (let width = 320; width <= 1920; width += 37) {
      for (let height = 400; height <= 1200; height += 53) {
        const layout = solveTileGrid({ width, height }, POOL_SIZE, { gap: 8 });

        expect(layout.columns * layout.rows).toBeGreaterThanOrEqual(POOL_SIZE);
        expect(layout.contentWidth).toBeLessThanOrEqual(width);
        expect(layout.tileWidth).toBeGreaterThanOrEqual(MIN_TILE_WIDTH);
        expect(layout.tileHeight).toBe(layout.tileWidth * 2);
      }
    }
  });

  it("returns an empty arrangement for an empty pool, which is a lobby", () => {
    const layout = solveTileGrid({ width: 390, height: 740 }, 0);

    expect(layout).toMatchObject({ columns: 0, rows: 0, tileWidth: 0, scrolls: false });
  });

  it("places a single tile without dividing by zero", () => {
    const layout = solveTileGrid({ width: 390, height: 740 }, 1);

    expect(layout.columns).toBe(1);
    expect(layout.rows).toBe(1);
    expect(layout.tileWidth).toBe(MAX_TILE_WIDTH);
  });

  it("survives a box of no size, which is what a hidden element measures", () => {
    const layout = solveTileGrid({ width: 0, height: 0 }, POOL_SIZE);

    expect(layout.tileWidth).toBe(0);
    expect(layout.tileHeight).toBe(0);
    expect(layout.columns).toBeGreaterThanOrEqual(1);
  });

  it("accepts a caller's own gap without changing anything else about the search", () => {
    const tight = solveTileGrid({ width: 1024, height: 768 }, POOL_SIZE, { gap: 0 });
    const loose = solveTileGrid({ width: 1024, height: 768 }, POOL_SIZE, { gap: 24 });

    expect(tight.tileWidth).toBeGreaterThan(loose.tileWidth);
    expect(tight.contentWidth).toBeLessThanOrEqual(1024);
    expect(loose.contentWidth).toBeLessThanOrEqual(1024);
  });
});
