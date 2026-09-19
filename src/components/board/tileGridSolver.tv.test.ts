import { describe, expect, it } from "vitest";
import { solveTileGrid } from "./tileGridSolver";

/**
 * The measurement the television's layout was decided by.
 *
 * The board used to share the screen with the challenge cards, in two columns.
 * These are the numbers that ended that: at every television size the full-width
 * board deals a larger tile, and at the smallest one the two-column board does
 * not fit at all — it answers by scrolling, and **nobody scrolls a television**,
 * so the bottom of the board is simply a part of the game the room never sees.
 *
 * The cards did not lose anything by it. They are painted over the board when
 * they fire, where they have the whole screen instead of a column of it.
 */

/** Header, the current player at salon-name, and the gaps between them. */
const CHROME = 240;

/** What the board was given when it shared the row: 1.1 of 2.1, less the page gutter. */
const SPLIT_SHARE = 1.1 / 2.1;

const TELEVISIONS = [
  { name: "720p", width: 1280, height: 720 },
  { name: "1080p", width: 1920, height: 1080 },
  { name: "4K", width: 3840, height: 2160 },
];

function board (width: number, height: number) {
  return solveTileGrid({ width, height }, 49, { gap: 14 });
}

describe("the board on a television", () => {
  it.each(TELEVISIONS)("deals a bigger tile across the whole screen on $name", ({ width, height }) => {
    const box = height - CHROME;
    const split = board((width - 32) * SPLIT_SHARE, box);
    const full = board(width - 32, box);

    // Compared on what a room can actually see: a layout that only wins by
    // scrolling has not won, it has hidden the difference below the screen.
    const visible = (layout: typeof full) => layout.scrolls ? 0 : layout.tileWidth;

    expect(visible(full)).toBeGreaterThan(visible(split));
  });

  it.each(TELEVISIONS)("shows all forty-nine positions at once on $name", ({ width, height }) => {
    // The pool is the game's only board and a position nobody can see is a
    // position nobody taps. This is the requirement the two-column layout broke
    // on the smallest television.
    const full = board(width - 32, height - CHROME);

    expect(full.scrolls).toBe(false);
    expect(full.columns * full.rows).toBeGreaterThanOrEqual(49);
  });

  it("is the smallest television that decides it", () => {
    // 720p is where the two-column board gave up: nine rows of tiles in a box
    // that holds three.
    const split = board((1280 - 32) * SPLIT_SHARE, 720 - CHROME);

    expect(split.scrolls).toBe(true);
  });
});
