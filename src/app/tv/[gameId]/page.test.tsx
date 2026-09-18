import { Suspense } from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameState } from "@/domains/game/types";
import { gameState, pool, seat } from "@/domains/game/testing/snapshot";

/**
 * The watch screen's board.
 *
 * This is the screen the board exists for: from a sofa the room watches the
 * board filling up and reads **who** filled it, without counting a pip. What is
 * asserted here is that the snapshot's two board fields reach it — the seat on
 * every taken position, and whether the position still carries a tile — and that
 * the answer to the second one changes the screen.
 *
 * The board measures itself with a ResizeObserver, which jsdom does not have, so
 * the box a television would have reported is handed over on observe.
 */

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  spec: vi.fn(),
  channel: vi.fn(),
}));

vi.mock("@/domains/game/services/gameApi", () => ({
  gameApi: { get: mocks.get, roomConfigSpec: mocks.spec },
}));

vi.mock("@/domains/game/hooks/useGameChannel", () => ({
  useGameChannel: (options: { onState: (state: unknown) => void; }) => {
    mocks.channel(options);

    return "connected";
  },
}));

const { default: TvPage } = await import("./page");

const GAME_ID = "00000000-0000-4000-8000-000000000001";

const SEATS = [ seat(1, "Ana"), seat(2, "Bruno"), seat(3, "Carla") ];

class StubResizeObserver {
  constructor (private readonly callback: ResizeObserverCallback) {}

  observe (): void {
    this.callback(
      [ { contentRect: { width: 1280, height: 900 } } as unknown as ResizeObserverEntry ],
      this as unknown as ResizeObserver,
    );
  }

  unobserve (): void {

    /* Nothing to do: the box never changes in a test. */
  }

  disconnect (): void {

    /* Nothing to do: the box never changes in a test. */
  }
}

async function openOn (state: GameState): Promise<void> {
  mocks.get.mockResolvedValue(state);

  await act(async () => {
    render(
      <Suspense fallback={null}>
        <TvPage params={Promise.resolve({ gameId: GAME_ID })} searchParams={Promise.resolve({})} />
      </Suspense>,
    );
  });

  await waitFor(() => expect(document.querySelector("[data-tile-grid]")).not.toBeNull());
}

function cell (position: number): HTMLElement {
  const found = document.querySelector<HTMLElement>(`[data-position="${position}"]`);

  if (found === null) {
    throw new Error(`Position ${position} is not on the board.`);
  }

  return found;
}

/** The arrangement, which must not depend on what the tiles are. */
function geometry (): Record<string, string> {
  const grid = document.querySelector<HTMLElement>("[data-tile-grid]");

  return {
    columns: grid?.dataset.columns ?? "",
    template: grid?.style.gridTemplateColumns ?? "",
    rows: grid?.style.gridAutoRows ?? "",
    gap: grid?.style.gap ?? "",
    count: String(document.querySelectorAll("[data-position]").length),
  };
}

/** A board the table has played eight positions of, by two different seats. */
const PLAYED = { 3: "21", 4: "50", 11: "62" };

const TAKERS = { takers: { 3: 2, 4: 3, 11: 2 } };

/** An opaque declaration: a card takes its title from this and never from the key. */
const SPEC = {
  rule_set_id: "some.ruleset",
  fields: [
    { key: "some.setting", kind: "text", label: "A Thing", default: "x", max_length: 80, options: [] },
  ],
};

/** Hands a new snapshot to the screen the way the socket does. */
function receive (state: GameState): void {
  const options = mocks.channel.mock.calls.at(-1)?.[0] as { onState: (received: unknown) => void; } | undefined;

  if (options === undefined) {
    throw new Error("The screen never subscribed to a channel.");
  }

  options.onState(state);
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", StubResizeObserver);
  mocks.spec.mockResolvedValue(SPEC);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the board on a television", () => {
  it("names the seat that turned each position over", async () => {
    // The whole value of this screen on the table: the board fills up and says
    // who filled it, with no number to add up anywhere (TR-54).
    await openOn(gameState({
      status: "running",
      currentSeat: 1,
      seats: SEATS,
      pool: pool(49, PLAYED, TAKERS),
    }));

    expect(cell(3).querySelector("[data-seat]")?.textContent).toBe("2");
    expect(cell(4).querySelector("[data-seat]")?.textContent).toBe("3");
    expect(cell(11).querySelector("[data-seat]")?.textContent).toBe("2");
  });

  it("puts no seat on a position nobody has taken", async () => {
    await openOn(gameState({
      status: "running",
      currentSeat: 1,
      seats: SEATS,
      pool: pool(49, PLAYED, TAKERS),
    }));

    expect(cell(5).querySelector("[data-seat]")).toBeNull();
    expect(cell(5).querySelector("[data-bevel]")).not.toBeNull();
  });

  it("keeps the taken tiles on the board when the snapshot keeps them there", async () => {
    await openOn(gameState({
      status: "running",
      currentSeat: 1,
      seats: SEATS,
      pool: pool(49, PLAYED, TAKERS),
    }));

    expect(cell(3).querySelector("[data-pips]")).not.toBeNull();
    expect(document.querySelectorAll("[data-gap]")).toHaveLength(0);
  });

  it("shows an empty place where the snapshot has taken the tile off the board", async () => {
    await openOn(gameState({
      status: "running",
      currentSeat: 1,
      seats: SEATS,
      pool: pool(49, PLAYED, { ...TAKERS, offBoard: [ 3, 4, 11 ] }),
    }));

    expect(document.querySelectorAll("[data-gap]")).toHaveLength(3);
    expect(cell(3).querySelector("[data-pips]")).toBeNull();
    expect(cell(3)).toHaveAttribute("data-off-board");
  });

  it("arranges the board the same way either way, from the same forty-nine positions", async () => {
    // The two answers differ in what a position draws and never in where it is.
    await openOn(gameState({
      status: "running",
      currentSeat: 1,
      seats: SEATS,
      pool: pool(49, PLAYED, TAKERS),
    }));

    const kept = geometry();

    cleanup();

    await openOn(gameState({
      status: "running",
      currentSeat: 1,
      seats: SEATS,
      pool: pool(49, PLAYED, { ...TAKERS, offBoard: [ 3, 4, 11 ] }),
    }));

    expect(geometry()).toEqual(kept);
    expect(geometry().count).toBe("49");
  });

  it("reads the board off the snapshot and never off the settings the table wrote", async () => {
    // The projection resolves the table's choice before it reaches any screen,
    // so a settings map that says one thing changes nothing while the board
    // says the other (R1).
    await openOn(gameState({
      status: "running",
      currentSeat: 1,
      seats: SEATS,
      pool: pool(49, PLAYED, TAKERS),
      roomConfig: { "some.setting": "a value no screen reads" },
    }));

    expect(document.querySelectorAll("[data-gap]")).toHaveLength(0);
    expect(cell(3).querySelector("[data-pips]")).not.toBeNull();
  });

  it("offers no control on any position, because a television cannot write", async () => {
    await openOn(gameState({
      status: "running",
      currentSeat: 1,
      seats: SEATS,
      pool: pool(49, PLAYED, TAKERS),
    }));

    expect(document.querySelectorAll("[data-tile-grid] button")).toHaveLength(0);
  });
});

describe("the board on a television when the game is over", () => {

  /**
   * The board a default game ends on.
   *
   * The stage that ends the game ends when its pool is exhausted, so every
   * position is taken, and the table's shipped answer takes a taken tile off the
   * board: every entry arrives with `on_board` false. The end screen does not
   * honour it, and this is the screen that says so from three metres away.
   */
  const ENDED = gameState({
    status: "finished",
    joinCode: null,
    currentSeat: null,
    seats: SEATS,
    pool: pool(
      6,
      { 1: "21", 2: "50", 3: "62", 4: "05", 5: "14", 6: "32" },
      { takers: { 1: 1, 2: 2, 3: 3, 4: 1, 5: 2, 6: 3 }, offBoard: [ 1, 2, 3, 4, 5, 6 ] },
    ),
  });

  it("paints the record and not six empty places", async () => {
    await openOn(ENDED);

    expect(document.querySelector("[data-game-over]")).not.toBeNull();
    expect(document.querySelectorAll("[data-gap]")).toHaveLength(0);
    expect(document.querySelectorAll("[data-off-board]")).toHaveLength(0);
    expect(document.querySelectorAll("[data-pips]")).toHaveLength(6);
  });

  it("still says who turned each position over", async () => {
    await openOn(ENDED);

    expect(cell(1).querySelector("[data-seat]")?.textContent).toBe("1");
    expect(cell(6).querySelector("[data-seat]")?.textContent).toBe("3");
    expect(cell(6).querySelector("svg")?.getAttribute("aria-label"))
      .toBe("Position 6, tile 3 2, seat 3");
  });

  it("offers a way off the screen and never a rematch, which belongs to the phone", async () => {
    await openOn(ENDED);

    expect(document.querySelector("[data-watch-another]")).not.toBeNull();
    expect(document.querySelector("[data-play-again]")).toBeNull();
  });
});

describe("the last draw on a television", () => {
  const RUNNING = gameState({
    status: "running",
    currentSeat: 2,
    seats: SEATS,
    pool: pool(49, PLAYED, TAKERS),
    lastDraw: { position: 11, tile: "62", seat: 3 },
    effects: [ { kind: "challenge", seat: 3, config_key: "some.setting" } ],
  });

  it("says whose draw the cards belong to, which is not the seat it says is playing", async () => {
    // The defect this exists for: the cursor names the next seat and the cards
    // below it belong to the draw before, so unlabelled the room reads them as
    // the current player's choice.
    await openOn(RUNNING);

    expect(document.querySelector("[data-current-player-name]")?.textContent).toBe("Bruno");
    expect(document.querySelector("[data-last-play]")?.textContent).toContain("Last play by");
    expect(document.querySelector("[data-last-play-name]")?.textContent).toBe("Carla");
  });

  it("heads a challenge with the label the ruleset declares", async () => {
    await openOn(RUNNING);

    await waitFor(() => expect(document.querySelector("[data-challenge-title]")).not.toBeNull());

    expect(document.querySelector("[data-challenge-title]")?.textContent).toBe("A Thing");
    expect(document.querySelector("[data-challenge-recipient-name]")?.textContent).toBe("Carla");
  });
});

describe("the end of the game on a television", () => {
  it("holds the last turn on its own before the record replaces it", async () => {
    // The write that turns over the last tile is the write that finishes the
    // game (TR-34) and it fires that tile's challenges (TR-38). Painted in the
    // same frame as the record, the last thing the table is asked for all night
    // is read by nobody.
    await openOn(gameState({
      status: "running",
      currentSeat: 2,
      seats: SEATS,
      pool: pool(49, PLAYED, TAKERS),
    }));

    const finished = gameState({
      status: "finished",
      joinCode: null,
      currentSeat: null,
      version: 60,
      seats: SEATS,
      pool: pool(49, PLAYED, TAKERS),
      lastDraw: { position: 11, tile: "62", seat: 2 },
      effects: [ { kind: "challenge", seat: 2, config_key: "some.setting" } ],
    });

    mocks.get.mockResolvedValue(finished);
    vi.useFakeTimers();

    act(() => receive(finished));

    expect(document.querySelector("[data-final-beat]")).not.toBeNull();
    expect(document.querySelector("[data-tile-grid]")).toBeNull();
    expect(document.querySelector("[data-last-play-name]")?.textContent).toBe("Bruno");
    expect(document.querySelector("[data-challenge-card]")).not.toBeNull();

    // Comfortably past the beat and short of the reconcile poll, so what lands
    // here is the beat ending and never a refetch.
    act(() => void vi.advanceTimersByTime(20_000));

    expect(document.querySelector("[data-final-beat]")).toBeNull();
    expect(document.querySelector("[data-tile-grid]")).not.toBeNull();
  });

  it("keeps the last cards beside the record, so a challenge in progress stays on screen", async () => {
    await openOn(gameState({
      status: "finished",
      joinCode: null,
      currentSeat: null,
      version: 60,
      seats: SEATS,
      pool: pool(49, PLAYED, TAKERS),
      lastDraw: { position: 11, tile: "62", seat: 2 },
      effects: [ { kind: "challenge", seat: 2, config_key: "some.setting" } ],
    }));

    // Opened on a game that was already over: there is no last turn this screen
    // watched happen, so it lands on the record with no beat at all.
    expect(document.querySelector("[data-final-beat]")).toBeNull();
    expect(document.querySelector("[data-tile-grid]")).not.toBeNull();
    expect(document.querySelector("[data-challenge-card]")).not.toBeNull();
    expect(document.querySelector("[data-last-play-name]")?.textContent).toBe("Bruno");
  });
});
