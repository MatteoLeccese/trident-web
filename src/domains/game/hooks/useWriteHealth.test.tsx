import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useWriteHealth } from "./useWriteHealth";
import { resetWriteHealth, writeFailed, writeLanded } from "@/domains/game/services/writeHealth";

const GAME = "00000000-0000-4000-8000-000000000001";

const OTHER_GAME = "00000000-0000-4000-8000-000000000002";

beforeEach(() => resetWriteHealth());

describe("whether the server is still answering this phone", () => {
  it("says nothing about a phone that has not written", () => {
    const { result } = renderHook(() => useWriteHealth(GAME));

    expect(result.current).toBe("idle");
  });

  it("follows the write path as it happens", () => {
    const { result } = renderHook(() => useWriteHealth(GAME));

    act(() => writeLanded());

    expect(result.current).toBe("healthy");

    act(() => writeFailed());

    expect(result.current).toBe("failing");

    act(() => writeLanded());

    expect(result.current).toBe("healthy");
  });

  it("forgets the previous game when the phone moves to the next one", () => {
    // A rematch is a new table. Carrying the last game's failure onto it would
    // paint a fresh lobby as broken before anybody had typed a name.
    const { result, rerender } = renderHook(({ gameId }) => useWriteHealth(gameId), {
      initialProps: { gameId: GAME },
    });

    act(() => writeFailed());

    expect(result.current).toBe("failing");

    rerender({ gameId: OTHER_GAME });

    expect(result.current).toBe("idle");
  });

  it("tells every screen reading it, not only the one that asked", () => {
    const first = renderHook(() => useWriteHealth(GAME));
    const second = renderHook(() => useWriteHealth(GAME));

    act(() => writeFailed());

    expect(first.result.current).toBe("failing");
    expect(second.result.current).toBe("failing");
  });

  it("leaves nothing behind when the screen goes away", () => {
    const { unmount } = renderHook(() => useWriteHealth(GAME));

    act(() => writeFailed());

    unmount();

    const { result } = renderHook(() => useWriteHealth(GAME));

    expect(result.current).toBe("idle");
  });
});
