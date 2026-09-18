import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pollIntervalMs, useReconcile } from "./useReconcile";

beforeEach(() => vi.useFakeTimers());

afterEach(() => vi.useRealTimers());

function becomesVisible (state: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

describe("asking the server again", () => {
  it("polls on the interval it was given", () => {
    // Everything a client cannot know it missed — a dead socket, a NAT rebind,
    // a socket that swallows frames while reporting itself connected — degrades
    // to one interval of delay instead of to a frozen screen.
    const resync = vi.fn();

    renderHook(() => useReconcile({ resync, everyMs: 1000 }));

    act(() => vi.advanceTimersByTime(3500));

    expect(resync).toHaveBeenCalledTimes(3);
  });

  it("does not poll at all when it is told not to", () => {
    // The phone's battery is the constraint, and every write it makes already
    // answers with a fresh snapshot.
    const resync = vi.fn();

    renderHook(() => useReconcile({ resync, everyMs: null }));

    act(() => vi.advanceTimersByTime(60_000));

    expect(resync).not.toHaveBeenCalled();
  });

  it("stops polling when the screen goes away", () => {
    const resync = vi.fn();
    const { unmount } = renderHook(() => useReconcile({ resync, everyMs: 1000 }));

    unmount();

    act(() => vi.advanceTimersByTime(10_000));

    expect(resync).not.toHaveBeenCalled();
  });

  it("asks again when the page comes back into view", () => {
    // The phone was locked and has been handed to somebody else; the television
    // woke up.
    const resync = vi.fn();

    renderHook(() => useReconcile({ resync, everyMs: null }));

    becomesVisible("visible");

    expect(resync).toHaveBeenCalledTimes(1);
  });

  it("does not ask when the page is only going away", () => {
    const resync = vi.fn();

    renderHook(() => useReconcile({ resync, everyMs: null }));

    becomesVisible("hidden");

    expect(resync).not.toHaveBeenCalled();
  });

  it("uses the newest resync without restarting the interval", () => {
    // A new callback on every frame would otherwise reset the clock and the
    // unconditional poll would never fire on a busy game.
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ resync }: { resync: () => void; }) => useReconcile({ resync, everyMs: 1000 }),
      { initialProps: { resync: first } },
    );

    act(() => vi.advanceTimersByTime(900));

    rerender({ resync: second });

    act(() => vi.advanceTimersByTime(200));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe("how often to poll", () => {
  it("takes a positive number as it is given", () => {
    expect(pollIntervalMs("5000", 30_000)).toBe(5_000);
  });

  it("falls back when the value was never set", () => {
    expect(pollIntervalMs(undefined, 30_000)).toBe(30_000);
  });

  it("falls back when the value is defined but empty", () => {
    // `NEXT_PUBLIC_…=` in an env file, or a build arg that was not passed.
    // `Number("")` is 0, which would install no interval at all and leave the
    // television with nothing but its socket.
    expect(pollIntervalMs("", 30_000)).toBe(30_000);
    expect(pollIntervalMs("   ", 30_000)).toBe(30_000);
  });

  it("falls back when the value is not a number", () => {
    // NaN passes a `> 0` test and reaches `setInterval` as no delay, which is a
    // resync every few milliseconds against an API that throttles.
    expect(pollIntervalMs("30s", 30_000)).toBe(30_000);
    expect(pollIntervalMs("NaN", 30_000)).toBe(30_000);
  });

  it("falls back on zero and on a negative interval", () => {
    expect(pollIntervalMs("0", 30_000)).toBe(30_000);
    expect(pollIntervalMs("-1000", 30_000)).toBe(30_000);
  });
});
