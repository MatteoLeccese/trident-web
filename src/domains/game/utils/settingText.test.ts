import { describe, expect, it } from "vitest";
import { settingText } from "./settingText";

/** Opaque keys throughout: the lookup is a flat map access and knows nothing else. */
describe("resolving a settings key", () => {
  it("returns the text the table wrote", () => {
    expect(settingText({ "some.setting": "Do the thing." }, "some.setting")).toBe("Do the thing.");
  });

  it("trims what the table typed around it", () => {
    expect(settingText({ "some.setting": "  Do the thing.  " }, "some.setting")).toBe("Do the thing.");
  });

  it("returns nothing for a key that is not there", () => {
    // The client applies no default of its own: a phone and a television on
    // different bundles would otherwise disagree about what the table wrote.
    expect(settingText({}, "some.setting")).toBeNull();
    expect(settingText({ "other.setting": "x" }, "some.setting")).toBeNull();
  });

  it("returns nothing for a setting the table emptied", () => {
    // Empty is legal and means this one does nothing, so it paints no card.
    expect(settingText({ "some.setting": "" }, "some.setting")).toBeNull();
    expect(settingText({ "some.setting": "   " }, "some.setting")).toBeNull();
  });

  it("returns nothing for a value that is not text", () => {
    expect(settingText({ "some.setting": true }, "some.setting")).toBeNull();
    expect(settingText({ "some.setting": 3 }, "some.setting")).toBeNull();
  });
});
