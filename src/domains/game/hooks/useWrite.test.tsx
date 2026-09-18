import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/domains/core/types/api-error";
import { useWrite } from "./useWrite";
import { gameState } from "@/domains/game/testing/snapshot";

describe("one write from a control", () => {
  it("applies the snapshot the write produced and reports that it landed", async () => {
    const receive = vi.fn();
    const state = gameState({ version: 5 });
    const { result } = renderHook(() => useWrite(receive));

    let landed: boolean | null = null;

    await act(async () => {
      landed = await result.current.run(async () => ({ state, conflicted: false }));
    });

    expect(landed).toBe(true);
    expect(receive).toHaveBeenCalledWith(state);
    expect(result.current.error).toBeNull();
  });

  it("applies the snapshot a refusal carries and reports that it did not", async () => {
    // The refusal carries the current projection precisely so the phone heals
    // from it instead of asking a person to refresh.
    const receive = vi.fn();
    const current = gameState({ version: 9 });
    const { result } = renderHook(() => useWrite(receive));

    let landed: boolean | null = null;

    await act(async () => {
      landed = await result.current.run(async () => ({ state: current, conflicted: true }));
    });

    expect(landed).toBe(false);
    expect(receive).toHaveBeenCalledWith(current);
    expect(result.current.error).toBe("The game had already moved on. Try that again.");
  });

  it("turns a machine code into words for a person", async () => {
    const { result } = renderHook(() => useWrite(vi.fn()));

    await act(async () => {
      await result.current.run(() => Promise.reject(new ApiError(422, "game_not_in_lobby", "Nope.")));
    });

    expect(result.current.error).toBe("The game has already started.");
  });

  it("says something plain for a failure that is not the API's", async () => {
    const { result } = renderHook(() => useWrite(vi.fn()));

    await act(async () => {
      await result.current.run(() => Promise.reject(new TypeError("boom")));
    });

    expect(result.current.error).toBe("We could not save that.");
  });

  it("is in flight for the whole call, retries included", async () => {
    let release: (() => void) | null = null;
    const { result } = renderHook(() => useWrite(vi.fn()));

    act(() => {
      void result.current.run(() => new Promise((resolve) => {
        release = () => resolve({ state: gameState({ version: 2 }), conflicted: false });
      }));
    });

    await waitFor(() => expect(result.current.pending).toBe(true));

    await act(async () => {
      release?.();
    });

    expect(result.current.pending).toBe(false);
  });

  it("clears a refusal when asked, so a control can reopen without one on it", async () => {
    const { result } = renderHook(() => useWrite(vi.fn()));

    await act(async () => {
      await result.current.run(() => Promise.reject(new ApiError(422, "game_not_in_lobby", "Nope.")));
    });

    act(() => result.current.clear());

    expect(result.current.error).toBeNull();
  });

  it("says nothing after the screen is gone", async () => {
    // A write in flight when a phone navigates must not set state on a screen
    // that no longer exists.
    let release: ((value: { state: ReturnType<typeof gameState>; conflicted: boolean; }) => void) | null = null;
    const { result, unmount } = renderHook(() => useWrite(vi.fn()));

    let settled: Promise<boolean> | null = null;

    act(() => {
      settled = result.current.run(() => new Promise((resolve) => {
        release = resolve;
      }));
    });

    unmount();

    await act(async () => {
      release?.({ state: gameState({ version: 2 }), conflicted: true });
      await settled;
    });

    expect(await settled).toBe(false);
  });
});
