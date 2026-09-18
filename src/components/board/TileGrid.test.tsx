import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PoolPosition } from "@/domains/game/types";
import { TileGrid } from "./TileGrid";
import { type GridBox, solveTileGrid } from "./tileGridSolver";

/**
 * The board measures itself with a `ResizeObserver`, which jsdom does not
 * implement. The stub below is the size the box would have reported, handed over
 * on demand, so the arrangement can be asserted at a phone's size and at a
 * television's without a browser.
 */

type Emit = (box: GridBox) => void;

let emit: Emit | null = null;

class StubResizeObserver {
  constructor (callback: ResizeObserverCallback) {
    emit = (box) => callback(
      [ { contentRect: box } as unknown as ResizeObserverEntry ],
      this as unknown as ResizeObserver,
    );
  }

  observe (): void {

    /* The test drives the callback itself. */
  }

  unobserve (): void {

    /* The test drives the callback itself. */
  }

  disconnect (): void {

    /* The test drives the callback itself. */
  }
}

beforeEach(() => {
  emit = null;
  vi.stubGlobal("ResizeObserver", StubResizeObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const PHONE: GridBox = { width: 360, height: 640 };

const TELEVISION: GridBox = { width: 1812, height: 972 };

/**
 * The pool a stage materialises: forty-nine positions, 1-based and never
 * renumbered (TR-01, TR-08).
 *
 * `taken` maps a position to `[face, seat]`, which is the pair the projection
 * always sends together: a taken position has both. `open` maps a position to a
 * face nobody has taken, which is a stage that publishes its board (TR-07), and
 * those carry no seat.
 *
 * Every value here is an arbitrary placeholder. No face, seat or stage the real
 * ruleset uses appears in this file, which is the evidence that the board
 * branches on none of them.
 */
function pool (
  taken: Record<number, [string, number]> = {},
  open: Record<number, string> = {},
  offBoard: number[] = [],
): PoolPosition[] {
  const cleared = new Set(offBoard);

  return Array.from({ length: 49 }, (_unused, index) => {
    const position = index + 1;
    const owned = taken[position];

    if (owned !== undefined) {
      return {
        position,
        tile: owned[0],
        taken: true,
        seat: owned[1],
        on_board: !cleared.has(position),
      };
    }

    if (open[position] !== undefined) {
      return { position, tile: open[position], taken: false, seat: null, on_board: true };
    }

    return { position, tile: null, taken: false, seat: null, on_board: true };
  });
}

/** Where every cell of the board is and how big it is, so two boards can be compared. */
function geometry (container: HTMLElement): Record<string, string> {
  const grid = container.querySelector<HTMLElement>("[data-tile-grid]");
  const boxes: Record<string, string> = {
    columns: grid?.dataset.columns ?? "",
    template: grid?.style.gridTemplateColumns ?? "",
    rows: grid?.style.gridAutoRows ?? "",
    gap: grid?.style.gap ?? "",
  };

  for (const element of cells(container)) {
    boxes[`position-${element.dataset.position}`] = element.className;
  }

  return boxes;
}

function measure (box: GridBox): void {
  act(() => emit?.(box));
}

function cells (container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("[data-position]"));
}

function cell (container: HTMLElement, position: number): HTMLElement {
  const found = container.querySelector<HTMLElement>(`[data-position="${position}"]`);

  if (found === null) {
    throw new Error(`Position ${position} is not on the board.`);
  }

  return found;
}

describe("the board", () => {
  it("shows every position of the pool at once", () => {
    // There is no progressive disclosure: a position a player cannot see is a
    // position nobody taps.
    const { container } = render(<TileGrid positions={pool()} />);

    measure(PHONE);

    expect(cells(container)).toHaveLength(49);
  });

  it("shows every position at a television's size too", () => {
    const { container } = render(<TileGrid positions={pool()} gap={12} />);

    measure(TELEVISION);

    expect(cells(container)).toHaveLength(49);
  });

  it("arranges the tiles as the solver says, and not as CSS would", () => {
    const { container } = render(<TileGrid positions={pool()} gap={12} />);

    measure(TELEVISION);

    const layout = solveTileGrid(TELEVISION, 49, { gap: 12 });
    const grid = container.querySelector<HTMLElement>("[data-tile-grid]");

    expect(grid?.dataset.columns).toBe(String(layout.columns));
    expect(grid?.style.gridTemplateColumns).toBe(`repeat(${layout.columns}, ${layout.tileWidth}px)`);
    expect(grid?.style.gridAutoRows).toBe(`${layout.tileHeight}px`);
  });

  it("re-arranges when the box changes, which is a phone being turned over", () => {
    const { container } = render(<TileGrid positions={pool()} />);

    measure(PHONE);

    const portrait = container.querySelector<HTMLElement>("[data-tile-grid]")?.dataset.columns;

    measure({ width: 740, height: 360 });

    const landscape = container.querySelector<HTMLElement>("[data-tile-grid]")?.dataset.columns;

    expect(portrait).not.toBe(landscape);
  });

  it("snaps the scroller to whole rows, and to the first tile of each one", () => {
    const { container } = render(<TileGrid positions={pool()} />);

    measure(PHONE);

    const layout = solveTileGrid(PHONE, 49, { gap: 8 });
    const snapped = cells(container)
      .map((element, index) => element.className.includes("snap-start") ? index : -1)
      .filter((index) => index >= 0);

    expect(snapped[0]).toBe(0);
    expect(snapped[1]).toBe(layout.columns);
    expect(snapped).toHaveLength(layout.rows);
  });

  it("keeps the header out of the scroller, so it does not scroll away", () => {
    const { container } = render(<TileGrid positions={pool()} header={<p>Header</p>} />);

    measure(PHONE);

    const scroller = container.querySelector("[data-board-scroller]");
    const header = screen.getByText("Header");

    expect(scroller).not.toBeNull();
    expect(scroller?.contains(header)).toBe(false);
  });

  it("paints nothing until it knows how big it is", () => {
    const { container } = render(<TileGrid positions={pool()} />);

    expect(container.querySelector("[data-tile-grid]")).toBeNull();
  });

  it("paints an empty pool as an empty board, which is a lobby", () => {
    const { container } = render(<TileGrid positions={[]} />);

    measure(PHONE);

    expect(container.querySelector("[data-tile-grid]")).toBeNull();
    expect(cells(container)).toHaveLength(0);
  });
});

describe("a position on the board", () => {
  it("is face down while it carries no face", () => {
    const { container } = render(<TileGrid positions={pool()} />);

    measure(PHONE);

    expect(cell(container, 4).querySelector("[data-emblem]")).not.toBeNull();
    expect(cell(container, 4).querySelector("[data-pips]")).toBeNull();
  });

  it("shows its face once it is taken, and keeps its number", () => {
    // A taken position is marked and never removed: renumbering would make a
    // stale tap land on a different tile (TR-08).
    const { container } = render(<TileGrid positions={pool({ 7: [ "62", 4 ] })} />);

    measure(PHONE);

    expect(cell(container, 7).querySelector("[data-pips]")).not.toBeNull();
    expect(cell(container, 8).querySelector("[data-emblem]")).not.toBeNull();
    expect(cells(container)).toHaveLength(49);
  });

  it("carries the seat the snapshot attributes it to, off the pool entry itself", () => {
    // The taker travels on the position, so there is one source for who filled
    // the board and no second map for a screen to pass in and get wrong.
    const { container } = render(<TileGrid positions={pool({ 7: [ "62", 4 ], 8: [ "51", 11 ] })} />);

    measure(PHONE);

    expect(cell(container, 7).querySelector("[data-seat]")?.textContent).toBe("4");
    expect(cell(container, 8).querySelector("[data-seat]")?.textContent).toBe("11");
  });

  it("names its seat out loud, so the board says who filled it", () => {
    const { container } = render(<TileGrid positions={pool({ 7: [ "62", 4 ] })} />);

    measure(PHONE);

    expect(cell(container, 7).querySelector("svg")?.getAttribute("aria-label"))
      .toBe("Position 7, tile 6 2, seat 4");
  });

  it("shows a face the stage has opened without claiming anybody took it", () => {
    // Hiding is a property of the pool and not of the viewer (TR-07): a stage
    // that opens the board sends faces on positions nobody has taken.
    const { container } = render(<TileGrid positions={pool({}, { 9: "30" })} />);

    measure(PHONE);

    expect(cell(container, 9).querySelector("[data-pips]")).not.toBeNull();
    expect(cell(container, 9).querySelector("[data-seat]")).toBeNull();
  });
});

describe("the tiles the table has drawn", () => {

  /*
   * The board is handed one boolean per position and never the setting behind
   * it: the fixtures below differ in `on_board` alone, which is exactly the
   * difference the projection resolves. Nothing in this file names the setting,
   * a stage or a value of either (R1).
   */

  const TAKEN = { 7: [ "62", 4 ] as [string, number], 20: [ "51", 2 ] as [string, number] };

  it("leaves a taken tile face up on the board when the snapshot keeps it there", () => {
    const { container } = render(<TileGrid positions={pool(TAKEN)} />);

    measure(PHONE);

    expect(cell(container, 7).querySelector("[data-pips]")).not.toBeNull();
    expect(cell(container, 7).querySelector("[data-seat]")?.textContent).toBe("4");
    expect(cell(container, 7)).not.toHaveAttribute("data-off-board");
    expect(cell(container, 7).querySelector("[data-gap]")).toBeNull();
  });

  it("paints an empty place where the snapshot has taken the tile off the board", () => {
    const { container } = render(<TileGrid positions={pool(TAKEN, {}, [ 7, 20 ])} />);

    measure(PHONE);

    expect(cell(container, 7).querySelector("[data-gap]")).not.toBeNull();
    expect(cell(container, 7).querySelector("[data-pips]")).toBeNull();
    expect(cell(container, 7).querySelector("[data-seat]")).toBeNull();
    expect(cell(container, 7)).toHaveAttribute("data-off-board");
  });

  it("paints two different boards from the two answers, which is the setting doing something", () => {
    const { container: keeps } = render(<TileGrid positions={pool(TAKEN)} />);

    measure(PHONE);

    const kept = keeps.innerHTML;

    cleanup();

    const { container: clears } = render(<TileGrid positions={pool(TAKEN, {}, [ 7, 20 ])} />);

    measure(PHONE);

    expect(clears.innerHTML).not.toBe(kept);
  });

  it("arranges both boards identically, so the grid never reflows between turns", () => {
    // A board that rearranges itself under a thumb between turns is how somebody
    // taps the wrong tile, so the empty place occupies the box the tile did.
    const { container: keeps } = render(<TileGrid positions={pool(TAKEN)} />);

    measure(PHONE);

    const kept = geometry(keeps);

    cleanup();

    const { container: clears } = render(<TileGrid positions={pool(TAKEN, {}, [ 7, 20 ])} />);

    measure(PHONE);

    expect(geometry(clears)).toEqual(kept);
  });

  it("keeps all forty-nine positions, numbered as they were, with tiles taken off the board", () => {
    // Taking a tile off the board is presentation: the position is still there,
    // still numbered and still never re-drawable (TR-08).
    const { container } = render(<TileGrid positions={pool(TAKEN, {}, [ 7, 20 ])} />);

    measure(PHONE);

    expect(cells(container)).toHaveLength(49);
    expect(cell(container, 8).querySelector("[data-emblem]")).not.toBeNull();
    expect(container.querySelectorAll("[data-off-board]")).toHaveLength(2);
  });

  it("offers no control on an empty place", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <TileGrid positions={pool(TAKEN, {}, [ 7 ])} onSelect={onSelect} />,
    );

    measure(PHONE);

    expect(cell(container, 7).querySelector("button")).toBeNull();
    expect(cell(container, 8).querySelector("button")).not.toBeNull();
  });

  it("never empties a position nobody has taken", () => {
    // `on_board` is false only on a taken position, and an untaken one is a tile
    // still to be drawn whatever the table chose.
    const { container } = render(<TileGrid positions={pool(TAKEN, { 9: "30" }, [ 7 ])} />);

    measure(PHONE);

    expect(cell(container, 9).querySelector("[data-gap]")).toBeNull();
    expect(cell(container, 9).querySelector("[data-pips]")).not.toBeNull();
    expect(cell(container, 30).querySelector("[data-emblem]")).not.toBeNull();
  });

  it("paints the record instead when the caller does not honour the snapshot's answer", () => {
    // The board as it ended: every position taken, so honouring it would leave
    // forty-nine empty places where the record should be.
    const { container } = render(
      <TileGrid positions={pool(TAKEN, {}, [ 7, 20 ])} honoursBoardPresence={false} />,
    );

    measure(PHONE);

    expect(container.querySelectorAll("[data-gap]")).toHaveLength(0);
    expect(cell(container, 7).querySelector("[data-pips]")).not.toBeNull();
    expect(cell(container, 7).querySelector("[data-seat]")?.textContent).toBe("4");
  });
});

describe("the board as a control", () => {
  it("reports the position that was tapped, by number", () => {
    // A draw carries a position and never a seat: the seat is the server's
    // `current_seat` (TR-11).
    const onSelect = vi.fn();
    const { container } = render(<TileGrid positions={pool()} onSelect={onSelect} />);

    measure(PHONE);

    fireEvent.click(cell(container, 12).querySelector("button") as HTMLButtonElement);

    expect(onSelect).toHaveBeenCalledWith(12);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("offers no control on a position already taken", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <TileGrid positions={pool({ 7: [ "62", 4 ] })} onSelect={onSelect} />,
    );

    measure(PHONE);

    expect(cell(container, 7).querySelector("button")).toBeNull();
    expect(cell(container, 8).querySelector("button")).not.toBeNull();
  });

  it("refuses every control while a write is in flight, and removes none of them", () => {

    /*
     * Disabled and not absent. The element a finger or a keyboard has just
     * activated is the element this phase change arrives on: unmounting it drops
     * the focus to the top of the document at the moment a modal opens
     * underneath, and nothing announces either.
     */
    const { container } = render(
      <TileGrid positions={pool()} onSelect={vi.fn()} disabled />,
    );

    measure(PHONE);

    const controls = Array.from(container.querySelectorAll("button"));

    expect(controls).toHaveLength(49);
    expect(controls.every((control) => control.disabled)).toBe(true);
    expect(cells(container)).toHaveLength(49);
  });

  it("refuses a tap while a write is in flight", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <TileGrid positions={pool()} onSelect={onSelect} disabled />,
    );

    measure(PHONE);

    fireEvent.click(cell(container, 12).querySelector("button") as HTMLButtonElement);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("is read-only when nobody is listening, which is what a television is", () => {
    const { container } = render(<TileGrid positions={pool()} gap={12} />);

    measure(TELEVISION);

    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(cells(container)).toHaveLength(49);
  });

  it("gives the control no name of its own, so the cell is named once", () => {

    /*
     * The element inside the control already announces the position, the face
     * and the seat. A name on the button would replace all three with a bare
     * position number, and then the same cell would be called two different
     * things depending on whether it happened to be tappable.
     */
    const { container } = render(<TileGrid positions={pool()} onSelect={vi.fn()} />);

    measure(PHONE);

    expect(cell(container, 49).querySelector("button")).not.toHaveAttribute("aria-label");
    expect(screen.getByRole("button", { name: "Position 49, face down" })).toBeInTheDocument();
  });

  it("names every read-only cell by its position, on the board a television paints", () => {

    /*
     * A television has no control to carry the number, and the board as it ended
     * has none either. Two positions can hold the same face taken by the same
     * seat, so without the number the two cells are the same string twice.
     */
    const { container } = render(
      <TileGrid positions={pool({ 7: [ "62", 4 ], 20: [ "62", 4 ] }, {}, [ 20 ])} gap={12} />,
    );

    measure(TELEVISION);

    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(cell(container, 1).querySelector("svg")?.getAttribute("aria-label"))
      .toBe("Position 1, face down");
    expect(cell(container, 49).querySelector("svg")?.getAttribute("aria-label"))
      .toBe("Position 49, face down");
    expect(cell(container, 7).querySelector("svg")?.getAttribute("aria-label"))
      .toBe("Position 7, tile 6 2, seat 4");
    expect(cell(container, 20).querySelector("svg")?.getAttribute("aria-label"))
      .toBe("Position 20, empty place");
  });
});

describe("the tile a finger is on", () => {
  it("drops the tapped position before anything reaches the network", () => {
    // The tile answers the finger, so the question that follows is clearly
    // about that tile. It is the one thing on the board a tap changes by itself.
    const { container } = render(<TileGrid positions={pool()} onSelect={vi.fn()} pressedPosition={7} />);

    measure(PHONE);

    expect(cell(container, 7)).toHaveAttribute("data-pressed");
    expect(cell(container, 7).className).toContain("scale-[0.96]");
  });

  it("leaves every other position where it was", () => {
    const { container } = render(<TileGrid positions={pool()} onSelect={vi.fn()} pressedPosition={7} />);

    measure(PHONE);

    expect(container.querySelectorAll("[data-pressed]")).toHaveLength(1);
    expect(cell(container, 8)).not.toHaveAttribute("data-pressed");
  });

  it("presses nothing when nothing has been touched", () => {
    const { container } = render(<TileGrid positions={pool()} onSelect={vi.fn()} />);

    measure(PHONE);

    expect(container.querySelectorAll("[data-pressed]")).toHaveLength(0);
  });

  it("holds every position while a write is in flight, without unmounting the board", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <TileGrid positions={pool()} onSelect={onSelect} disabled pressedPosition={7} />,
    );

    measure(PHONE);

    // The control the finger is on is still the same element, so the focus that
    // was on it is still on it.
    expect(container.querySelectorAll("button")).toHaveLength(49);
    expect(cell(container, 7).querySelector("button")).toBeDisabled();
    expect(cell(container, 7)).toHaveAttribute("data-pressed");
  });
});
