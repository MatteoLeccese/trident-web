import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCardBeat } from "./useCardBeat";

const HOLD_MS = 9_000;

beforeEach(() => vi.useFakeTimers());

afterEach(() => vi.useRealTimers());

function open (version: number, hasCards: boolean) {
  return renderHook(
    ({ v, cards }) => useCardBeat(v, cards, HOLD_MS),
    { initialProps: { v: version, cards: hasCards } },
  );
}

describe("the cards a draw fires, over the board", () => {
  it("shows nothing for the version a screen opened on", () => {
    // A television opened halfway through an evening would otherwise announce
    // whatever the last table did as though it had just happened.
    const { result } = open(12, true);

    expect(result.current).toBe(false);
  });

  it("shows them when a new version brings them", () => {
    const { result, rerender } = open(12, true);

    rerender({ v: 13, cards: true });

    expect(result.current).toBe(true);
  });

  it("gives the board back after the beat", () => {
    const { result, rerender } = open(12, true);

    rerender({ v: 13, cards: true });

    act(() => void vi.advanceTimersByTime(HOLD_MS - 1));

    expect(result.current).toBe(true);

    act(() => void vi.advanceTimersByTime(1));

    expect(result.current).toBe(false);
  });

  it("stays out of the way for a version that fired nothing", () => {
    // A rename bumps the version and consults no rule, so it carries no effects.
    const { result, rerender } = open(12, true);

    rerender({ v: 13, cards: false });

    expect(result.current).toBe(false);
  });

  it("restages when the next draw fires the same two challenges", () => {
    // Keyed on the version and never on the effects: two draws can fire exactly
    // the same pair, and a beat that compared them would swallow the second.
    const { result, rerender } = open(12, true);

    rerender({ v: 13, cards: true });

    act(() => void vi.advanceTimersByTime(HOLD_MS));

    expect(result.current).toBe(false);

    rerender({ v: 14, cards: true });

    expect(result.current).toBe(true);
  });

  it("drops the previous cards the moment a new version arrives", () => {
    // Whatever the new version is: the room must never be reading a card that
    // belongs to a draw two turns ago.
    const { result, rerender } = open(12, true);

    rerender({ v: 13, cards: true });

    expect(result.current).toBe(true);

    rerender({ v: 14, cards: false });

    expect(result.current).toBe(false);
  });
});
