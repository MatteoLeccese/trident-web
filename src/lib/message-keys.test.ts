import { describe, expect, it } from "vitest";
import { formatMessage } from "./message-keys";

describe("the announcement catalogue", () => {
  it("has no copy for a key it does not ship, which paints nothing", () => {
    // The shipped ruleset emits no announcements at all, so the catalogue is
    // empty on purpose and every key lands on the neutral path.
    expect(formatMessage("some.message", {})).toBeNull();
    expect(formatMessage("", {})).toBeNull();
  });

  it("does not resolve a key off the prototype chain", () => {
    expect(formatMessage("toString", {})).toBeNull();
    expect(formatMessage("constructor", {})).toBeNull();
  });
});
