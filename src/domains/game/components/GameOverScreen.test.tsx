import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameOverScreen } from "./GameOverScreen";
import { gameState, pool } from "@/domains/game/testing/snapshot";

/** The board measures itself with a ResizeObserver, which jsdom does not have. */
type Emit = (box: { width: number; height: number; }) => void;

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

function measure (): void {
  act(() => emit?.({ width: 360, height: 640 }));
}

const FINISHED = gameState({
  status: "finished",
  joinCode: null,
  currentSeat: null,
  version: 60,
  pool: pool(6, { 2: "21", 5: "43" }),
});

/**
 * The board a default game actually ends on.
 *
 * The stage that ends the game ends when its pool is exhausted, so every
 * position is taken, and the table's shipped answer takes a taken tile off the
 * board: every entry arrives with `on_board` false. That is the state this
 * screen has to survive, and the fixture above never reaches it.
 */
const ALL_TAKEN_AND_CLEARED = gameState({
  status: "finished",
  joinCode: null,
  currentSeat: null,
  version: 60,
  pool: pool(
    6,
    { 1: "21", 2: "43", 3: "60", 4: "05", 5: "14", 6: "32" },
    { takers: { 1: 1, 2: 2, 3: 3, 4: 1, 5: 2, 6: 3 }, offBoard: [ 1, 2, 3, 4, 5, 6 ] },
  ),
});

describe("the end of a game", () => {
  it("says the game is over on either screen", () => {
    render(<GameOverScreen state={FINISHED} />);

    expect(screen.getByText("The game is over")).toBeInTheDocument();

    cleanup();

    render(<GameOverScreen state={FINISHED} size="tv" />);

    expect(screen.getByText("The game is over")).toBeInTheDocument();
  });

  it("shows the board as it ended, every position in the order it was dealt", () => {
    const { container } = render(<GameOverScreen state={FINISHED} />);

    measure();

    const positions = Array.from(container.querySelectorAll("[data-position]"))
      .map((cell) => cell.getAttribute("data-position"));

    expect(positions).toEqual([ "1", "2", "3", "4", "5", "6" ]);
    // Every position here is taken, so every face announces the seat that turned
    // it over as well as its own pips. That is what the board is for on this
    // screen: the record of who drew what, with nothing counted (TR-54).
    expect(screen.getByLabelText("Position 2, tile 2 1, seat 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Position 5, tile 4 3, seat 1")).toBeInTheDocument();
  });

  it.each([ "phone", "tv" ] as const)(
    "still paints the record on %s when every tile was taken off the board as it went",
    (size) => {

      /*
       * The state a default game ends in: every position taken and every one of
       * them cleared. Honouring that here would answer the screen whose whole
       * purpose is the record with a grid of empty places, so it is not
       * honoured, and this is what says so.
       */
      const { container } = render(<GameOverScreen state={ALL_TAKEN_AND_CLEARED} size={size} />);

      measure();

      expect(container.querySelectorAll("[data-gap]")).toHaveLength(0);
      expect(container.querySelectorAll("[data-off-board]")).toHaveLength(0);
      expect(container.querySelectorAll("[data-pips]")).toHaveLength(6);
      expect(container.querySelectorAll("[data-seat]")).toHaveLength(6);
      expect(screen.getByLabelText("Position 1, tile 2 1, seat 1")).toBeInTheDocument();
      expect(screen.getByLabelText("Position 6, tile 3 2, seat 3")).toBeInTheDocument();
    },
  );

  it("counts nothing at all", () => {
    // No score, no total, no ranking: the record of the board is a record and
    // never a result, and a number here would invent a game nobody played.
    const { container } = render(<GameOverScreen state={FINISHED} />);

    measure();

    const text = container.textContent ?? "";

    expect(text).not.toMatch(/score|points?|winner|total|drinks?/i);
  });

  it("names the table without putting anybody above anybody", () => {
    render(<GameOverScreen state={FINISHED} />);

    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Bruno")).toBeInTheDocument();
    expect(screen.getByText("Carla")).toBeInTheDocument();
  });

  it("leaves the board read-only, with nothing to tap", () => {
    const { container } = render(<GameOverScreen state={FINISHED} />);

    measure();

    expect(container.querySelectorAll("[data-position] button")).toHaveLength(0);
  });

  it("offers a rematch only where one can be started", () => {
    // Play again issues the next write credential, and a television has no path
    // to one.
    const { container: tv } = render(<GameOverScreen state={FINISHED} size="tv" />);

    expect(tv.querySelector("[data-play-again]")).toBeNull();

    cleanup();

    const { container: phone } = render(<GameOverScreen state={FINISHED} onPlayAgain={vi.fn()} />);

    expect(phone.querySelector("[data-play-again]")).not.toBeNull();
  });

  it("starts the rematch on a tap", async () => {
    const onPlayAgain = vi.fn();

    render(<GameOverScreen state={FINISHED} onPlayAgain={onPlayAgain} />);

    await userEvent.click(screen.getByText("Play again"));

    expect(onPlayAgain).toHaveBeenCalledOnce();
  });

  it("holds the rematch while it is in flight and says what came back", () => {
    render(<GameOverScreen state={FINISHED} onPlayAgain={vi.fn()} pending error="This phone is no longer running it." />);

    expect(screen.getByText("Dealing a new game…")).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("This phone is no longer running it.");
  });

  it("builds no congratulation of any kind", () => {
    // Deliberately not built: there is nothing to congratulate anybody for.
    const { container } = render(<GameOverScreen state={FINISHED} />);

    expect(container.querySelector("[data-confetti], .animate-bounce, .animate-ping")).toBeNull();
  });
});
