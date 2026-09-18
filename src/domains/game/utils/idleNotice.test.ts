import { describe, expect, it } from "vitest";
import { isIdle, silenceMs } from "./idleNotice";

const LAST = "2026-09-17T20:00:00+00:00";
const AT = Date.parse(LAST);
const MINUTE = 60_000;

describe("the idle notice", () => {
  it("measures the silence since the server's last write", () => {
    expect(silenceMs(LAST, AT + 5 * MINUTE)).toBe(5 * MINUTE);
  });

  it("never reports a negative silence when the clocks disagree", () => {
    // A television's clock is regularly wrong, and a game that has not happened
    // yet is not a state worth having.
    expect(silenceMs(LAST, AT - 60 * MINUTE)).toBe(0);
  });

  it("says nothing before the threshold and says something from it on", () => {
    expect(isIdle(LAST, 10, AT + 9 * MINUTE)).toBe(false);
    expect(isIdle(LAST, 10, AT + 10 * MINUTE)).toBe(true);
    expect(isIdle(LAST, 10, AT + 45 * MINUTE)).toBe(true);
  });

  it("says nothing at all when the threshold is not a number of minutes", () => {
    // A notice is not an expiry: the server decides when a game is over, so
    // every uncertain case answers "still playing".
    expect(isIdle(LAST, 0, AT + 100 * MINUTE)).toBe(false);
    expect(isIdle(LAST, -5, AT + 100 * MINUTE)).toBe(false);
    expect(isIdle(LAST, Number.NaN, AT + 100 * MINUTE)).toBe(false);
  });

  it("says nothing when the timestamp cannot be read", () => {
    expect(silenceMs("not a date", AT)).toBeNull();
    expect(isIdle("not a date", 1, AT + 100 * MINUTE)).toBe(false);
  });
});
