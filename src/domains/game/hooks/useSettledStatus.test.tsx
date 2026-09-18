import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type ChannelStatus, useSettledStatus } from "./useSettledStatus";

const HOLD_MS = 10_000;

beforeEach(() => vi.useFakeTimers());

afterEach(() => vi.useRealTimers());

function open (from: ChannelStatus = "connecting") {
  return renderHook(({ raw }) => useSettledStatus(raw, HOLD_MS), { initialProps: { raw: from } });
}

describe("what a screen is told about its socket", () => {
  it("believes the first handshake at once", () => {
    // The first connect of a page is not a recovery from anything. Held back,
    // every healthy load would spend ten seconds saying it was still connecting.
    const { result, rerender } = open();

    expect(result.current).toBe("connecting");

    rerender({ raw: "connected" });

    expect(result.current).toBe("connected");
  });

  it("reports trouble the instant it is claimed", () => {
    const { result, rerender } = open();

    rerender({ raw: "connected" });
    rerender({ raw: "offline" });

    expect(result.current).toBe("offline");
  });

  it("makes a reconnection earn it", () => {
    const { result, rerender } = open();

    rerender({ raw: "connected" });
    rerender({ raw: "offline" });
    rerender({ raw: "connected" });

    expect(result.current).toBe("offline");

    act(() => void vi.advanceTimersByTime(HOLD_MS - 1));

    expect(result.current).toBe("offline");

    act(() => void vi.advanceTimersByTime(1));

    expect(result.current).toBe("connected");
  });

  it("gives a flapping socket nothing", () => {

    /*
     * The case this exists for. A socket that comes up for a second and drops
     * again would otherwise paint Live, Offline, Live across the room — and,
     * worse, each of those seconds of "connected" switches off the phone's
     * rescue poll, which is its only recovery exactly when the network is at its
     * worst.
     */
    const { result, rerender } = open();

    rerender({ raw: "connected" });
    rerender({ raw: "offline" });

    for (let flap = 0; flap < 5; flap++) {
      rerender({ raw: "connected" });

      act(() => void vi.advanceTimersByTime(1_000));

      rerender({ raw: "offline" });

      act(() => void vi.advanceTimersByTime(1_000));
    }

    expect(result.current).toBe("offline");
  });

  it("drops a claim of health that did not hold", () => {
    const { result, rerender } = open();

    rerender({ raw: "connected" });
    rerender({ raw: "offline" });
    rerender({ raw: "connected" });

    act(() => void vi.advanceTimersByTime(HOLD_MS - 1));

    rerender({ raw: "offline" });

    // The timer that was about to fire must not resurrect the claim behind it.
    act(() => void vi.advanceTimersByTime(HOLD_MS));

    expect(result.current).toBe("offline");
  });

  it("passes connecting through while it settles rather than inventing a state", () => {
    const { result, rerender } = open();

    rerender({ raw: "connected" });
    rerender({ raw: "connecting" });

    expect(result.current).toBe("connecting");

    rerender({ raw: "connected" });

    expect(result.current).toBe("connecting");

    act(() => void vi.advanceTimersByTime(HOLD_MS));

    expect(result.current).toBe("connected");
  });

  it("believes a socket that was already up when the screen opened", () => {
    const { result } = open("connected");

    expect(result.current).toBe("connected");
  });
});
