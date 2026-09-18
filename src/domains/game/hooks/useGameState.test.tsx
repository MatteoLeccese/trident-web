import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/domains/core/types/api-error";
import { gameState } from "@/domains/game/testing/snapshot";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/domains/game/services/gameApi", () => ({ gameApi: { get: mocks.get } }));

const { useGameState } = await import("./useGameState");

const GAME_ID = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  mocks.get.mockReset();
});

describe("holding the game's state", () => {
  it("loads through the same route the recovery path uses", async () => {
    // The recovery path is exercised on every page open, not in a branch nobody
    // runs.
    mocks.get.mockResolvedValue(gameState({ version: 3 }));

    const { result } = renderHook(() => useGameState(GAME_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mocks.get).toHaveBeenCalledWith(GAME_ID);
    expect(result.current.state?.version).toBe(3);
  });

  it("applies the next version and discards one that arrives late", async () => {
    mocks.get.mockResolvedValue(gameState({ version: 3 }));

    const { result } = renderHook(() => useGameState(GAME_ID));

    await waitFor(() => expect(result.current.state?.version).toBe(3));

    act(() => result.current.receive(gameState({ version: 4 })));

    expect(result.current.state?.version).toBe(4);

    act(() => result.current.receive(gameState({ version: 2 })));

    expect(result.current.state?.version).toBe(4);
  });

  it("applies a gap and asks for the state again", async () => {
    mocks.get.mockResolvedValue(gameState({ version: 3 }));

    const { result } = renderHook(() => useGameState(GAME_ID));

    await waitFor(() => expect(result.current.state?.version).toBe(3));

    mocks.get.mockClear();
    mocks.get.mockResolvedValue(gameState({ version: 9 }));

    act(() => result.current.receive(gameState({ version: 9 })));

    expect(result.current.state?.version).toBe(9);
    await waitFor(() => expect(mocks.get).toHaveBeenCalledOnce());
  });

  it("refuses a frame that is not a snapshot and asks the server instead", async () => {
    // This is the one payload typed by assertion rather than by the compiler, and
    // an unchecked object handed to the version guard is one malformed frame away
    // from replacing the state of a table mid-game.
    mocks.get.mockResolvedValue(gameState({ version: 3 }));

    const { result } = renderHook(() => useGameState(GAME_ID));

    await waitFor(() => expect(result.current.state?.version).toBe(3));

    mocks.get.mockClear();
    mocks.get.mockResolvedValue(gameState({ version: 3 }));

    act(() => result.current.receive({ game_id: GAME_ID, version: 4 }));

    expect(result.current.state?.version).toBe(3);
    await waitFor(() => expect(mocks.get).toHaveBeenCalledOnce());
  });

  it("refuses a frame whose status is not one the framework knows", async () => {
    mocks.get.mockResolvedValue(gameState({ version: 3 }));

    const { result } = renderHook(() => useGameState(GAME_ID));

    await waitFor(() => expect(result.current.state?.version).toBe(3));

    act(() => result.current.receive({ ...gameState({ version: 4 }), status: "in_orbit" }));

    expect(result.current.state?.version).toBe(3);
  });

  it("keeps a frame carrying an effect kind it has never heard of", async () => {
    // The asymmetry is the seam: a ruleset extends the effect vocabulary and
    // nothing else, so one new kind must not blank a screen.
    mocks.get.mockResolvedValue(gameState({ version: 3 }));

    const { result } = renderHook(() => useGameState(GAME_ID));

    await waitFor(() => expect(result.current.state?.version).toBe(3));

    act(() => result.current.receive(
      gameState({ version: 4, effects: [ { kind: "some_future_kind", whatever: 1 } ] }),
    ));

    expect(result.current.state?.version).toBe(4);
  });

  it("keeps the newer of two frames that land inside one commit window", async () => {

    /*
     * The guard's baseline cannot be a value that is only refreshed after a
     * commit. Two deliveries in one window — a socket frame and the answer to a
     * poll that was already in flight — would then both be compared against the
     * version before either, and whichever called `setState` last would win
     * however old it was. This delivers them in one `act`, which is the window.
     */
    mocks.get.mockResolvedValue(gameState({ version: 3 }));

    const { result } = renderHook(() => useGameState(GAME_ID));

    await waitFor(() => expect(result.current.state?.version).toBe(3));

    act(() => {
      result.current.receive(gameState({ version: 5 }));
      result.current.receive(gameState({ version: 4 }));
    });

    expect(result.current.state?.version).toBe(5);
  });

  it("does not let a slow read write an older snapshot over a newer frame", async () => {
    // The television reconnecting: `onReconnect` fires a resync, and a newer
    // frame arrives over the socket while its GET is still in flight.
    mocks.get.mockResolvedValue(gameState({ version: 3 }));

    const { result } = renderHook(() => useGameState(GAME_ID));

    await waitFor(() => expect(result.current.state?.version).toBe(3));

    let answerTheRead: (state: unknown) => void = () => undefined;

    mocks.get.mockReturnValue(new Promise((resolve) => {
      answerTheRead = resolve;
    }));

    const reading = result.current.resync();

    act(() => result.current.receive(gameState({ version: 7 })));

    expect(result.current.state?.version).toBe(7);

    await act(async () => {
      answerTheRead(gameState({ version: 6 }));
      await reading;
    });

    expect(result.current.state?.version).toBe(7);
  });

  it("puts a failed load into words for a person", async () => {
    mocks.get.mockRejectedValue(new ApiError(404, "game_not_found", "Gone."));

    const { result } = renderHook(() => useGameState(GAME_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("That game does not exist, or it is already over.");
    expect(result.current.state).toBeNull();
  });
});
