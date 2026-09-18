import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/domains/core/types/api-error";
import type { GameState } from "@/domains/game/types";
import { gameState, pool } from "@/domains/game/testing/snapshot";

const mocks = vi.hoisted(() => ({ draw: vi.fn() }));

vi.mock("@/domains/game/services/gameApi", () => ({ gameApi: { draw: mocks.draw } }));

const { useTurnSequence } = await import("./useTurnSequence");

const GAME_ID = "00000000-0000-4000-8000-000000000001";

function harness (state: GameState | null) {
  const receive = vi.fn();
  const view = renderHook(
    ({ current }: { current: GameState | null; }) => useTurnSequence({ gameId: GAME_ID, state: current, receive }),
    { initialProps: { current: state } },
  );

  return { ...view, receive };
}

beforeEach(() => {
  mocks.draw.mockReset();
});

describe("the phone's turn, wired to its one write", () => {
  it("runs a turn: tap, question, one write, the result, the hand-off", async () => {
    const before = gameState({ version: 4, currentSeat: 1, pool: pool(6) });
    const after = gameState({ version: 5, currentSeat: 2, pool: pool(6, { 3: "21" }) });

    mocks.draw.mockResolvedValue({ state: after, conflicted: false });

    const { result, receive } = harness(before);

    act(() => result.current.tap(3));

    expect(result.current.sequence).toMatchObject({ phase: "confirming", position: 3, holder: 1 });

    act(() => result.current.confirm());

    await waitFor(() => expect(result.current.sequence.phase).toBe("result"));

    expect(mocks.draw).toHaveBeenCalledWith(GAME_ID, 3, 4);
    expect(receive).toHaveBeenCalledWith(after);
    expect(result.current.sequence.version).toBe(5);

    act(() => result.current.advance());

    expect(result.current.sequence.phase).toBe("handoff");

    act(() => result.current.advance());

    expect(result.current.sequence.phase).toBe("board");
  });

  it("holds the seat that was playing when the tap happened", async () => {
    // The server's cursor has already moved to the next seat by the time the
    // result is on screen. The phone is still in the same hand.
    const before = gameState({ version: 4, currentSeat: 1 });
    const after = gameState({ version: 5, currentSeat: 2 });

    mocks.draw.mockResolvedValue({ state: after, conflicted: false });

    const { result } = harness(before);

    act(() => result.current.tap(3));
    act(() => result.current.confirm());

    await waitFor(() => expect(result.current.sequence.phase).toBe("result"));

    expect(result.current.sequence.holder).toBe(1);
  });

  it("names the version it read and never a newer one", async () => {
    const before = gameState({ version: 4 });
    const newer = gameState({ version: 9 });

    mocks.draw.mockResolvedValue({ state: gameState({ version: 10 }), conflicted: false });

    const { result, rerender } = harness(before);

    act(() => result.current.tap(3));

    // A frame arrives while the question is on screen. The write still guards
    // the version the person is looking at, which is what makes the refusal
    // meaningful.
    rerender({ current: newer });

    act(() => result.current.confirm());

    await waitFor(() => expect(mocks.draw).toHaveBeenCalledWith(GAME_ID, 3, 9));
  });

  it("applies the state a refused write carries and comes back to the board", async () => {
    // The phone heals from the refusal itself rather than asking a person to
    // refresh, and it does not stage a result for a draw that did not happen.
    const current = gameState({ version: 9, currentSeat: 3 });

    mocks.draw.mockResolvedValue({ state: current, conflicted: true });

    const { result, receive } = harness(gameState({ version: 4 }));

    act(() => result.current.tap(3));
    act(() => result.current.confirm());

    await waitFor(() => expect(result.current.sequence.phase).toBe("board"));

    expect(receive).toHaveBeenCalledWith(current);
    expect(result.current.sequence.notice).toBe("The game had already moved on. Here is the board again.");
    expect(result.current.sequence.position).toBeNull();
  });

  it("puts a failed write's message on the board in words for a person", async () => {
    mocks.draw.mockRejectedValue(new ApiError(422, "pool_position_already_taken", "Taken."));

    const { result } = harness(gameState({ version: 4 }));

    act(() => result.current.tap(3));
    act(() => result.current.confirm());

    await waitFor(() => expect(result.current.sequence.phase).toBe("board"));

    expect(result.current.sequence.notice).toBe("That one is already turned over.");
  });

  it("falls back to plain words for a failure that is not the API's", async () => {
    mocks.draw.mockRejectedValue(new TypeError("boom"));

    const { result } = harness(gameState({ version: 4 }));

    act(() => result.current.tap(3));
    act(() => result.current.confirm());

    await waitFor(() => expect(result.current.sequence.notice).toBe("We could not turn that one over."));
  });

  it("writes once for one tap on the question", async () => {
    mocks.draw.mockResolvedValue({ state: gameState({ version: 5 }), conflicted: false });

    const { result } = harness(gameState({ version: 4 }));

    act(() => result.current.tap(3));
    act(() => {
      result.current.confirm();
      result.current.confirm();
    });

    await waitFor(() => expect(result.current.sequence.phase).toBe("result"));

    expect(mocks.draw).toHaveBeenCalledTimes(1);
  });

  it("writes nothing for a confirm that no question preceded", () => {
    const { result } = harness(gameState({ version: 4 }));

    act(() => result.current.confirm());

    expect(mocks.draw).not.toHaveBeenCalled();
    expect(result.current.sequence.phase).toBe("board");
  });

  it("keeps the result of the draw that finished the game", async () => {

    /*
     * The write that turns over the last tile of the pool is the write that
     * finishes the game (TR-34), and that tile fires its two challenges like
     * every other one (TR-38). `effects` belongs to that version and no later
     * frame carries it, so clearing the phase here would take the last two
     * things the table is asked for off the screen in the frame they arrived in.
     * The board is not mounted in `result`, so nothing is held hostage.
     */
    const finishing = gameState({ version: 5, status: "finished", currentSeat: 1 });

    mocks.draw.mockResolvedValue({ state: finishing, conflicted: false });

    const { result, rerender } = harness(gameState({ version: 4 }));

    act(() => result.current.tap(3));
    act(() => result.current.confirm());

    await waitFor(() => expect(result.current.sequence.phase).toBe("result"));

    rerender({ current: finishing });

    expect(result.current.sequence.phase).toBe("result");
    expect(result.current.sequence.version).toBe(5);
  });

  it("clears the result once the person has read it", async () => {
    // There is no next turn to hand the phone on to, so the tap closes the
    // sequence instead of opening a hand-off to nobody.
    const finishing = gameState({ version: 5, status: "finished", currentSeat: 1 });

    mocks.draw.mockResolvedValue({ state: finishing, conflicted: false });

    const { result, rerender } = harness(gameState({ version: 4 }));

    act(() => result.current.tap(3));
    act(() => result.current.confirm());

    await waitFor(() => expect(result.current.sequence.phase).toBe("result"));

    rerender({ current: finishing });

    act(() => result.current.dismiss());

    expect(result.current.sequence.phase).toBe("board");
    expect(result.current.sequence.position).toBeNull();
  });

  it("clears a turn that was mid-question when the game stopped being in play", async () => {
    // Somebody else ended the game while this phone was holding the sheet up.
    // There is nothing to read here, so the screen must not keep asking.
    const { result, rerender } = harness(gameState({ version: 4 }));

    act(() => result.current.tap(3));

    expect(result.current.sequence.phase).toBe("confirming");

    rerender({ current: gameState({ version: 6, status: "abandoned", currentSeat: null }) });

    expect(result.current.sequence.phase).toBe("board");
    expect(result.current.sequence.position).toBeNull();
  });

  it("hands the phone over before the first tile of the game", async () => {

    /*
     * Whoever typed the names and tapped start is holding the phone, and at a
     * table of five that is the first seat one time in five. Every other turn of
     * the evening is gated by a screen with a name on it; this is the one where
     * the phone is demonstrably in the wrong hand.
     */
    const { result, rerender } = harness(gameState({ version: 3, status: "lobby", currentSeat: null }));

    expect(result.current.sequence.phase).toBe("board");

    rerender({ current: gameState({ version: 4, status: "running", currentSeat: 1 }) });

    expect(result.current.sequence.phase).toBe("handoff");

    act(() => result.current.advance());

    expect(result.current.sequence.phase).toBe("board");
  });

  it("does not gate a phone that arrived at a game already in play", () => {
    // A reload mid-game has not just been handed to anybody: the cursor names
    // whose turn it is and the board is where the person left it.
    const { result, rerender } = harness(null);

    rerender({ current: gameState({ version: 9, status: "running", currentSeat: 2 }) });

    expect(result.current.sequence.phase).toBe("board");
  });
});
