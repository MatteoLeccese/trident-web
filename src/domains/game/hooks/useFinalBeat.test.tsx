import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type EndPhase, useFinalBeat } from "./useFinalBeat";

const HOLD_MS = 15_000;

beforeEach(() => vi.useFakeTimers());

afterEach(() => vi.useRealTimers());

describe("the beat between the last turn and the record", () => {
  it("holds when the game ends while the screen is watching", () => {
    const { result, rerender } = renderHook(({ phase }) => useFinalBeat(phase, HOLD_MS), {
      initialProps: { phase: "live" as EndPhase },
    });

    expect(result.current).toBe(false);

    rerender({ phase: "over" });

    expect(result.current).toBe(true);
  });

  it("lets go once the beat has passed", () => {
    const { result, rerender } = renderHook(({ phase }) => useFinalBeat(phase, HOLD_MS), {
      initialProps: { phase: "live" as EndPhase },
    });

    rerender({ phase: "over" });

    act(() => void vi.advanceTimersByTime(HOLD_MS - 1));

    expect(result.current).toBe(true);

    act(() => void vi.advanceTimersByTime(1));

    expect(result.current).toBe(false);
  });

  it("holds nothing for a screen that arrives after the game is already over", () => {
    // There is no last turn to show somebody who did not see it happen, and an
    // animation of one would be the television inventing a moment.
    const { result } = renderHook(() => useFinalBeat("over", HOLD_MS));

    expect(result.current).toBe(false);

    act(() => void vi.advanceTimersByTime(HOLD_MS));

    expect(result.current).toBe(false);
  });

  it("holds nothing for a screen whose own loading frame preceded a finished game", () => {
    // The frame before the first snapshot is not a live game. Counted as one,
    // every television opened on a game that ended an hour ago would stage an
    // ending nobody in the room watched happen.
    const { result, rerender } = renderHook(({ phase }) => useFinalBeat(phase, HOLD_MS), {
      initialProps: { phase: "unknown" as EndPhase },
    });

    rerender({ phase: "over" });

    expect(result.current).toBe(false);

    act(() => void vi.advanceTimersByTime(HOLD_MS));

    expect(result.current).toBe(false);
  });

  it("arms again for the game after a rematch", () => {
    const { result, rerender } = renderHook(({ phase }) => useFinalBeat(phase, HOLD_MS), {
      initialProps: { phase: "live" as EndPhase },
    });

    rerender({ phase: "over" });

    act(() => void vi.advanceTimersByTime(HOLD_MS));

    expect(result.current).toBe(false);

    // Play again: a new game on the same screen, which ends like the last one.
    rerender({ phase: "live" });

    expect(result.current).toBe(false);

    rerender({ phase: "over" });

    expect(result.current).toBe(true);
  });

  it("drops the hold the moment a new game starts under it", () => {
    const { result, rerender } = renderHook(({ phase }) => useFinalBeat(phase, HOLD_MS), {
      initialProps: { phase: "live" as EndPhase },
    });

    rerender({ phase: "over" });

    expect(result.current).toBe(true);

    rerender({ phase: "live" });

    expect(result.current).toBe(false);
  });
});
