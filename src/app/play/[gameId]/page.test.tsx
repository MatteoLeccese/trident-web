import { Suspense } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameState } from "@/domains/game/types";
import { gameState, pool, seat } from "@/domains/game/testing/snapshot";

/**
 * The phone screen: the only client in the system that writes.
 *
 * What is asserted here is not what the screen looks like but **when a control
 * exists at all**. The page states its own invariant in prose — between turns
 * the board is not disabled, it is not mounted — and states it a second time in
 * `boardIsMounted`; nothing checked that the page applied either, so the board
 * could be left live over the end screen, or live under the confirm sheet, with
 * the suite fully green. A control that invites a tap and then refuses it is the
 * failure this page exists to prevent.
 *
 * The board measures itself with a ResizeObserver, which jsdom does not have,
 * and the tiles it paints have to be big enough for the solver to keep any
 * columns at all.
 */

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  draw: vi.fn(),
  start: vi.fn(),
  playAgain: vi.fn(),
  roomConfigSpec: vi.fn(),
  push: vi.fn(),
  channel: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));

vi.mock("@/domains/game/services/gameApi", () => ({
  gameApi: {
    get: mocks.get,
    draw: mocks.draw,
    start: mocks.start,
    playAgain: mocks.playAgain,
    roomConfigSpec: mocks.roomConfigSpec,
  },
}));

vi.mock("@/domains/game/hooks/useGameChannel", () => ({
  useGameChannel: (options: { onState: (state: unknown) => void; }) => {
    mocks.channel(options);

    return "connected";
  },
}));

const { default: PlayPage } = await import("./page");

const GAME_ID = "00000000-0000-4000-8000-000000000001";

const SEATS = [ seat(1, "Ana"), seat(2, "Bruno"), seat(3, "Carla") ];

class StubResizeObserver {
  constructor (private readonly callback: ResizeObserverCallback) {}

  observe (): void {
    this.callback(
      [ { contentRect: { width: 390, height: 720 } } as unknown as ResizeObserverEntry ],
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

/** Every control the board has mounted, refused or not. */
function boardControls (): HTMLButtonElement[] {
  return screen.queryAllByRole("button", { name: /^Position \d+, / }) as HTMLButtonElement[];
}

/** The tappable board: the positions a thumb can actually reach. */
function tappablePositions (): HTMLButtonElement[] {
  return boardControls().filter((control) => !control.disabled);
}

/** Mounts the page. The params are a promise, so the first render suspends. */
async function open (): Promise<void> {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <PlayPage
          params={Promise.resolve({ gameId: GAME_ID })}
          searchParams={Promise.resolve({})}
        />
      </Suspense>,
    );
  });
}

async function openOn (state: GameState): Promise<void> {
  mocks.get.mockResolvedValue(state);

  await open();

  // Whose turn it is, which every screen but the two failure ones carries.
  await waitFor(() => expect(document.querySelector("[data-current-player]")).not.toBeNull());
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", StubResizeObserver);
  mocks.roomConfigSpec.mockResolvedValue({ rule_set_id: "some-rules", fields: [] });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the phone screen", () => {
  it("shows the table before it starts, and no board", async () => {
    await openOn(gameState({ status: "lobby", currentSeat: null, pool: [] }));

    expect(document.querySelector("[data-lobby]")).not.toBeNull();
    expect(tappablePositions()).toHaveLength(0);
  });

  it("mounts a live board once the phone has been handed over", async () => {
    await openOn(gameState({ status: "running", currentSeat: 1, seats: SEATS, pool: pool(6) }));

    expect(document.querySelector("[data-tile-grid]")).not.toBeNull();
    expect(tappablePositions()).toHaveLength(6);
  });

  it("refuses the board while the question is on screen, without taking it apart", async () => {

    /*
     * Nothing behind the sheet can be tapped, and every control is still the
     * element it was: the one that was just activated is where the focus goes
     * back to when the question is answered with no.
     */
    await openOn(gameState({ status: "running", currentSeat: 1, seats: SEATS, pool: pool(6) }));

    await userEvent.click(tappablePositions()[2]);

    expect(document.querySelector("[data-confirm-sheet]")).not.toBeNull();
    expect(tappablePositions()).toHaveLength(0);
    expect(boardControls()).toHaveLength(6);
  });

  it("puts the focus in the question and hands it back to the tile on no", async () => {

    /*
     * The sheet declares `aria-modal`, which hides the board behind it from a
     * screen reader only once the focus is inside. Opening one and leaving the
     * focus on the document is a modal nothing has announced and neither button
     * can be reached from.
     */
    await openOn(gameState({ status: "running", currentSeat: 1, seats: SEATS, pool: pool(6) }));

    const tapped = tappablePositions()[2];

    await userEvent.click(tapped);

    expect(document.activeElement).toBe(screen.getByRole("button", { name: /turn it over/i }));

    await userEvent.keyboard("{Escape}");

    expect(document.querySelector("[data-confirm-sheet]")).toBeNull();
    expect(document.activeElement).toBe(tapped);
  });

  it("gives the board back when the question is answered with no", async () => {
    await openOn(gameState({ status: "running", currentSeat: 1, seats: SEATS, pool: pool(6) }));

    await userEvent.click(tappablePositions()[2]);
    await userEvent.click(screen.getByRole("button", { name: /not yet/i }));

    expect(document.querySelector("[data-confirm-sheet]")).toBeNull();
    expect(tappablePositions()).toHaveLength(6);
  });

  it("paints the drawn face and that version's cards, and no board, after a draw", async () => {
    const after = gameState({
      version: 5,
      status: "running",
      currentSeat: 2,
      seats: SEATS,
      pool: pool(6, { 3: "21" }),
      lastDraw: { position: 3, tile: "21", seat: 1 },
      effects: [ { kind: "challenge", seat: 1, config_key: "some.setting" } ],
    });

    mocks.draw.mockResolvedValue({ state: after, conflicted: false });

    await openOn(gameState({ version: 4, status: "running", currentSeat: 1, seats: SEATS, pool: pool(6) }));

    await userEvent.click(tappablePositions()[2]);
    await userEvent.click(screen.getByRole("button", { name: /turn it over/i }));

    await waitFor(() => expect(document.querySelector("[data-turn-result]")).not.toBeNull());

    expect(document.querySelector("[data-drawn-tile='3']")).not.toBeNull();
    expect(document.querySelectorAll("[data-challenge-card]")).toHaveLength(1);
    expect(tappablePositions()).toHaveLength(0);
  });

  it("still shows the drawn face when the same write replaced the pool", async () => {

    /*
     * The draw that ends a stage carries the next stage's fresh pool in the same
     * snapshot (TR-04, TR-25), so the position just turned over comes back
     * untaken and face down. Read off the pool, the one draw the game is named
     * after is the one draw with no tile on the screen.
     */
    const boundary = gameState({
      version: 5,
      status: "running",
      currentSeat: 1,
      seats: SEATS,
      pool: pool(6),
      lastDraw: { position: 3, tile: "33", seat: 1 },
      effects: [ { kind: "assign_role", seat: 1, role: "some_role" } ],
    });

    mocks.draw.mockResolvedValue({ state: boundary, conflicted: false });

    await openOn(gameState({ version: 4, status: "running", currentSeat: 1, seats: SEATS, pool: pool(6) }));

    await userEvent.click(tappablePositions()[2]);
    await userEvent.click(screen.getByRole("button", { name: /turn it over/i }));

    await waitFor(() => expect(document.querySelector("[data-turn-result]")).not.toBeNull());

    expect(document.querySelector("[data-drawn-tile='3']")).not.toBeNull();
    expect(document.querySelector("[data-role-banner]")).not.toBeNull();
  });

  it("reads out the last tile's cards before the game is declared over", async () => {
    // The write that turns over the last tile of the pool is the write that
    // finishes the game (TR-34), and that tile fires two challenges like every
    // other (TR-38). No later frame carries them.
    const finishing = gameState({
      version: 5,
      status: "finished",
      currentSeat: 1,
      seats: SEATS,
      joinCode: null,
      pool: pool(6, { 3: "21" }),
      lastDraw: { position: 3, tile: "21", seat: 1 },
      effects: [
        { kind: "challenge", seat: 1, config_key: "some.setting" },
        { kind: "challenge", seat: 2, config_key: "some.setting" },
      ],
    });

    mocks.draw.mockResolvedValue({ state: finishing, conflicted: false });

    await openOn(gameState({ version: 4, status: "running", currentSeat: 1, seats: SEATS, pool: pool(6) }));

    await userEvent.click(tappablePositions()[2]);
    await userEvent.click(screen.getByRole("button", { name: /turn it over/i }));

    await waitFor(() => expect(document.querySelector("[data-turn-result]")).not.toBeNull());

    expect(document.querySelectorAll("[data-challenge-card]")).toHaveLength(2);
    expect(document.querySelector("[data-game-over]")).toBeNull();

    // And only then the record of the board, with the cards still readable.
    await userEvent.click(screen.getByRole("button", { name: /done reading/i }));

    expect(document.querySelector("[data-game-over]")).not.toBeNull();
    expect(document.querySelectorAll("[data-challenge-card]")).toHaveLength(2);
  });

  it("offers no tap on the board of a game that is over", async () => {
    // The end screen paints the board as a record. A live cell on it would run
    // tap → question → write and come back refused.
    await openOn(gameState({
      status: "finished",
      currentSeat: 1,
      seats: SEATS,
      joinCode: null,
      pool: pool(6, { 1: "21", 2: "30" }),
    }));

    expect(document.querySelector("[data-game-over]")).not.toBeNull();
    expect(tappablePositions()).toHaveLength(0);
  });

  it("offers no tap on the board of a game that was abandoned", async () => {
    await openOn(gameState({
      status: "abandoned",
      currentSeat: 1,
      seats: SEATS,
      joinCode: null,
      pool: pool(6, { 1: "21" }),
    }));

    expect(tappablePositions()).toHaveLength(0);
  });

  it("offers no tap while the game is parked on a question", async () => {
    await openOn(gameState({
      status: "awaiting_choice",
      currentSeat: 2,
      seats: SEATS,
      pool: pool(6),
      effects: [ { kind: "challenge", seat: 2, config_key: "some.setting" } ],
    }));

    expect(tappablePositions()).toHaveLength(0);
    expect(document.querySelector("[data-effect-list]")).not.toBeNull();
  });

  it("hands the phone over before the first tile, rather than opening a live board", async () => {

    /*
     * Whoever typed the names and tapped start is holding the phone, and at a
     * table of three that is the first seat one time in three. Every other turn
     * of the evening is gated by a screen with a name on it.
     */
    const running = gameState({ version: 5, status: "running", currentSeat: 1, seats: SEATS, pool: pool(6) });

    mocks.start.mockResolvedValue({ state: running, conflicted: false });

    await openOn(gameState({ version: 4, status: "lobby", currentSeat: null, seats: SEATS, pool: [] }));

    await userEvent.click(screen.getByRole("button", { name: /start the game/i }));

    await waitFor(() => expect(document.querySelector("[data-handoff]")).not.toBeNull());

    expect(tappablePositions()).toHaveLength(0);
    expect(document.querySelector("[data-handoff-name]")?.textContent).toBe("Ana");

    await userEvent.click(screen.getByRole("button", { name: /i am ana/i }));

    expect(document.querySelector("[data-handoff]")).toBeNull();
    expect(tappablePositions()).toHaveLength(6);
  });

  it("names the seat holding the phone, not the cursor, from the tap onwards", async () => {
    const after = gameState({
      version: 5,
      status: "running",
      currentSeat: 2,
      seats: SEATS,
      pool: pool(6, { 3: "21" }),
      lastDraw: { position: 3, tile: "21", seat: 1 },
    });

    mocks.draw.mockResolvedValue({ state: after, conflicted: false });

    await openOn(gameState({ version: 4, status: "running", currentSeat: 1, seats: SEATS, pool: pool(6) }));

    await userEvent.click(tappablePositions()[2]);
    await userEvent.click(screen.getByRole("button", { name: /turn it over/i }));

    await waitFor(() => expect(document.querySelector("[data-turn-result]")).not.toBeNull());

    // The server's cursor already names Bruno; this screen is Ana's until she
    // has read what she turned over and passed the phone on.
    expect(document.querySelector("[data-current-player-name]")?.textContent).toBe("Ana");

    await userEvent.click(screen.getByRole("button", { name: /done reading/i }));

    expect(document.querySelector("[data-handoff-name]")?.textContent).toBe("Bruno");
  });

  it("comes back to the board with something to read when a write is refused", async () => {
    const current = gameState({ version: 9, status: "running", currentSeat: 1, seats: SEATS, pool: pool(6) });

    mocks.draw.mockResolvedValue({ state: current, conflicted: true });

    await openOn(gameState({ version: 4, status: "running", currentSeat: 1, seats: SEATS, pool: pool(6) }));

    await userEvent.click(tappablePositions()[2]);
    await userEvent.click(screen.getByRole("button", { name: /turn it over/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    expect(document.querySelector("[data-turn-result]")).toBeNull();
    expect(tappablePositions()).toHaveLength(6);
  });

  it("says so rather than painting a board it could not load", async () => {
    mocks.get.mockResolvedValue(null);

    await open();

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    expect(tappablePositions()).toHaveLength(0);
  });

  it("sends the socket's frames through the same guard the load used", async () => {
    // One state projection, one guard, both delivery paths.
    await openOn(gameState({ version: 4, status: "running", currentSeat: 1, seats: SEATS, pool: pool(6) }));

    const options = mocks.channel.mock.calls.at(-1)?.[0] as { onState: (state: unknown) => void; };

    act(() => options.onState(gameState({
      version: 5,
      status: "running",
      currentSeat: 2,
      seats: SEATS,
      pool: pool(6, { 1: "21" }),
    })));

    expect(document.querySelector("[data-current-player-name]")?.textContent).toBe("Bruno");

    // An older frame cannot make the screen go backwards.
    act(() => options.onState(gameState({
      version: 3,
      status: "running",
      currentSeat: 1,
      seats: SEATS,
      pool: pool(6),
    })));

    expect(document.querySelector("[data-current-player-name]")?.textContent).toBe("Bruno");
  });
});
