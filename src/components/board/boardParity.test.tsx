import { Suspense, type ReactElement } from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameState } from "@/domains/game/types";
import { gameState, pool, seat } from "@/domains/game/testing/snapshot";

/**
 * One board, two screens.
 *
 * The phone and the television are different applications with different
 * controls, and they have to agree about the board down to which tile is where,
 * who took it and whether it is still on the table: the two are read at the same
 * moment by the same people, one in a hand and one across the room, and a
 * disagreement between them is a table arguing with its own furniture.
 *
 * Both screens are rendered here from **one** snapshot object and their boards
 * are read back and compared. The two differ in the size of the box and in the
 * space between tiles, which are legibility and not content, so what is compared
 * is what each position paints and never how wide it is.
 *
 * This is also where it is asserted that the setting the table chose is honoured
 * by both, and honoured identically: a phone that kept its tiles while the
 * television cleared them would be the same defect twice over.
 */

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  roomConfigSpec: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));

vi.mock("@/domains/game/services/gameApi", () => ({
  gameApi: {
    get: mocks.get,
    draw: vi.fn(),
    start: vi.fn(),
    playAgain: vi.fn(),
    roomConfigSpec: mocks.roomConfigSpec,
  },
}));

vi.mock("@/domains/game/hooks/useGameChannel", () => ({
  useGameChannel: () => "connected",
}));

const { default: PlayPage } = await import("@/app/play/[gameId]/page");
const { default: TvPage } = await import("@/app/tv/[gameId]/page");

const GAME_ID = "00000000-0000-4000-8000-000000000001";

const SEATS = [ seat(1, "Ana"), seat(2, "Bruno"), seat(3, "Carla") ];

/** A phone's box and a television's: the same board at two sizes. */
const BOXES = { phone: { width: 390, height: 720 }, tv: { width: 1280, height: 900 } };

let box = BOXES.phone;

class StubResizeObserver {
  constructor (private readonly callback: ResizeObserverCallback) {}

  observe (): void {
    this.callback(
      [ { contentRect: box } as unknown as ResizeObserverEntry ],
      this as unknown as ResizeObserver,
    );
  }

  unobserve (): void {

    /* Nothing to do: the box never changes inside one render. */
  }

  disconnect (): void {

    /* Nothing to do: the box never changes inside one render. */
  }
}

/**
 * What one position paints: its name, whether it has pips, whether it is an
 * empty place, and the seat on it. This is the board's content, and all of it.
 */
interface Painted {
  label: string | null;
  pips: boolean;
  emptyPlace: boolean;
  seat: string | null;
}

function readBoard (): Record<number, Painted> {
  const painted: Record<number, Painted> = {};

  for (const element of document.querySelectorAll<HTMLElement>("[data-position]")) {
    painted[Number(element.dataset.position)] = {
      label: element.querySelector("svg")?.getAttribute("aria-label") ?? null,
      pips: element.querySelector("[data-pips]") !== null,
      emptyPlace: element.querySelector("[data-gap]") !== null,
      seat: element.querySelector("[data-seat]")?.textContent ?? null,
    };
  }

  return painted;
}

/** Mounts one screen on one snapshot and reads its board back. */
async function boardOf (screen: "phone" | "tv", state: GameState): Promise<Record<number, Painted>> {
  box = BOXES[screen];
  mocks.get.mockResolvedValue(state);

  const page: ReactElement = screen === "phone"
    ? <PlayPage params={Promise.resolve({ gameId: GAME_ID })} searchParams={Promise.resolve({})} />
    : <TvPage params={Promise.resolve({ gameId: GAME_ID })} searchParams={Promise.resolve({})} />;

  await act(async () => {
    render(<Suspense fallback={null}>{page}</Suspense>);
  });

  await waitFor(() => expect(document.querySelector("[data-tile-grid]")).not.toBeNull());

  const board = readBoard();

  cleanup();

  return board;
}

const PLAYED = { 3: "21", 4: "50", 11: "62" };

const TAKERS = { takers: { 3: 2, 4: 3, 11: 2 } };

function running (state: Partial<Parameters<typeof gameState>[0]> = {}): GameState {
  return gameState({ status: "running", currentSeat: 1, seats: SEATS, ...state });
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", StubResizeObserver);
  mocks.roomConfigSpec.mockResolvedValue({ rule_set_id: "some-rules", fields: [] });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the phone and the television", () => {
  it("paint the same board from the same bytes, with the tiles kept on it", async () => {
    const state = running({ pool: pool(49, PLAYED, TAKERS) });

    expect(await boardOf("phone", state)).toEqual(await boardOf("tv", state));
  });

  it("paint the same board from the same bytes, with the tiles taken off it", async () => {
    const state = running({ pool: pool(49, PLAYED, { ...TAKERS, offBoard: [ 3, 4, 11 ] }) });

    expect(await boardOf("phone", state)).toEqual(await boardOf("tv", state));
  });

  it("both name the seat that turned a position over", async () => {
    const state = running({ pool: pool(49, PLAYED, TAKERS) });

    for (const screen of [ "phone", "tv" ] as const) {
      const board = await boardOf(screen, state);

      expect(board[3]?.seat).toBe("2");
      expect(board[4]?.seat).toBe("3");
      expect(board[3]?.label).toBe("Position 3, tile 2 1, seat 2");
      expect(board[5]?.seat).toBeNull();
    }
  });

  it("both change what they paint when the table's answer changes, and change it the same way", async () => {
    const keeps = running({ pool: pool(49, PLAYED, TAKERS) });
    const clears = running({ pool: pool(49, PLAYED, { ...TAKERS, offBoard: [ 3, 4, 11 ] }) });

    for (const screen of [ "phone", "tv" ] as const) {
      const kept = await boardOf(screen, keeps);
      const cleared = await boardOf(screen, clears);

      expect(cleared).not.toEqual(kept);
      expect(kept[3]).toEqual({ label: "Position 3, tile 2 1, seat 2", pips: true, emptyPlace: false, seat: "2" });
      expect(cleared[3]).toEqual({ label: "Position 3, empty place", pips: false, emptyPlace: true, seat: null });

      // Only the taken positions change, and the untaken ones are untouched.
      expect(cleared[5]).toEqual(kept[5]);
    }
  });

  it("both keep all forty-nine positions, numbered as they were, either way", async () => {
    // Taking a tile off the board is presentation: a position is never removed
    // and never renumbered, so a stale tap cannot land on a different tile
    // (TR-08).
    const clears = running({ pool: pool(49, PLAYED, { ...TAKERS, offBoard: [ 3, 4, 11 ] }) });

    for (const screen of [ "phone", "tv" ] as const) {
      const board = await boardOf(screen, clears);

      expect(Object.keys(board)).toHaveLength(49);
      // Each cell says its own number, so a board with no control on it is still
      // one a person can be told to look at position 12 of.
      expect(board[1]?.label).toBe("Position 1, face down");
      expect(board[49]?.label).toBe("Position 49, face down");
    }
  });
});
