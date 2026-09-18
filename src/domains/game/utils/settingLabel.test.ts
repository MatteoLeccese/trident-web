import { describe, expect, it } from "vitest";
import { settingLabel } from "./settingLabel";
import type { RoomConfigField, RoomConfigSpec } from "@/domains/game/types";

/**
 * Opaque keys and opaque labels: this function looks a string up in a list, and
 * a test that used a real settings key would suggest it knew what one meant.
 */

function field (key: string, label: string): RoomConfigField {
  return { key, kind: "text", label, default: "", max_length: 80, options: [] };
}

function spec (...fields: RoomConfigField[]): RoomConfigSpec {
  return { rule_set_id: "some.ruleset", fields };
}

describe("the label a settings key declares", () => {
  it("is the one the declaration carries", () => {
    expect(settingLabel(spec(field("a.key", "A Thing"), field("b.key", "B Thing")), "b.key")).toBe("B Thing");
  });

  it("is null for a key the declaration does not carry", () => {
    expect(settingLabel(spec(field("a.key", "A Thing")), "other.key")).toBeNull();
  });

  it("is null when the declaration is not in hand", () => {
    // The spec is a request of its own. A screen still waiting for it paints no
    // title rather than working one out of the key.
    expect(settingLabel(null, "a.key")).toBeNull();
  });

  it("is null for a declared label that is blank", () => {
    expect(settingLabel(spec(field("a.key", "   ")), "a.key")).toBeNull();
  });

  it("trims what it answers", () => {
    expect(settingLabel(spec(field("a.key", "  A Thing  ")), "a.key")).toBe("A Thing");
  });

  it("never composes a name out of the key", () => {
    // The key is the ruleset's namespace. A client that split one to find a noun
    // inside it would be naming a rule.
    expect(settingLabel(spec(), "challenge.face.3")).toBeNull();
  });
});
