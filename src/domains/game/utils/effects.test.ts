import { describe, expect, it } from "vitest";
import type { Effect } from "@/domains/game/types";
import {
  isAnnounceEffect,
  isAssignRoleEffect,
  isChallengeEffect,
  isEffect,
  isKnownEffect,
  paintableEffects,
  paramsOf,
} from "./effects";

/**
 * Every value below is an opaque string on purpose. The guards read `kind` and
 * the shape around it and nothing else: if one of them ever branched on a
 * settings key, a role or a stage, these tests would have to name a real one.
 */

describe("the effect guards", () => {
  it("recognises the three kinds the seam declares", () => {
    const announce: Effect = { kind: "announce", message_key: "some.message", params: { who: "Ana" } };
    const assignRole: Effect = { kind: "assign_role", seat: 2, role: "some_role" };
    const challenge: Effect = { kind: "challenge", seat: 3, config_key: "some.setting" };

    expect(isAnnounceEffect(announce)).toBe(true);
    expect(isAssignRoleEffect(assignRole)).toBe(true);
    expect(isChallengeEffect(challenge)).toBe(true);
  });

  it("does not confuse one kind for another", () => {
    const challenge: Effect = { kind: "challenge", seat: 3, config_key: "some.setting" };

    expect(isAnnounceEffect(challenge)).toBe(false);
    expect(isAssignRoleEffect(challenge)).toBe(false);
  });

  it("accepts a challenge addressed to the whole table", () => {
    // A null recipient is a nullable field instead of fifteen repeated effects.
    expect(isChallengeEffect({ kind: "challenge", seat: null, config_key: "some.setting" })).toBe(true);
  });

  it("accepts a challenge addressed to a seat that is not the one that acted", () => {
    // The recipient travels in the effect, which is what spares the client from
    // working out who a given face belongs to.
    const effect: Effect = { kind: "challenge", seat: 4, config_key: "some.setting" };

    expect(isChallengeEffect(effect)).toBe(true);
    expect(isChallengeEffect(effect) && effect.seat).toBe(4);
  });

  it("accepts an announcement with no parameters", () => {
    expect(isAnnounceEffect({ kind: "announce", message_key: "some.message", params: {} })).toBe(true);
  });

  it("accepts the empty parameter map as the backend actually encodes it", () => {
    // PHP serialises an empty map as `[]`, which the backend's own `Effect`
    // documents. Read as an object it is the commonest announcement of all — one
    // with nothing to interpolate — and a guard that refused it would drop that
    // announcement from both screens with nothing logged.
    const announce: Effect = { kind: "announce", message_key: "some.message", params: [] };

    expect(isAnnounceEffect(announce)).toBe(true);
    expect(isKnownEffect(announce)).toBe(true);
    expect(paintableEffects([ announce ])).toEqual([ announce ]);
    expect(isAnnounceEffect(announce) && paramsOf(announce)).toEqual({});
  });

  it("refuses a parameter list that is not empty, which is not a map at all", () => {
    expect(isAnnounceEffect({ kind: "announce", message_key: "some.message", params: [ "Ana" ] })).toBe(false);
  });

  it("reads the parameters of an announcement that has them", () => {
    const announce: Effect = { kind: "announce", message_key: "some.message", params: { who: "Ana" } };

    expect(isAnnounceEffect(announce) && paramsOf(announce)).toEqual({ who: "Ana" });
  });

  it("treats a kind this build does not know as neutral rather than as a failure", () => {
    // A ruleset may declare one. Nothing throws, nothing narrows, and the screen
    // has a value it can skip.
    const unknown: Effect = { kind: "some_future_kind", whatever: 7 };

    expect(isKnownEffect(unknown)).toBe(false);
    expect(isAnnounceEffect(unknown)).toBe(false);
    expect(isAssignRoleEffect(unknown)).toBe(false);
    expect(isChallengeEffect(unknown)).toBe(false);
  });

  it("treats a known kind that arrives malformed as neutral too", () => {
    // Checking only the discriminator would narrow to a type the value does not
    // have, and the screen would read `config_key` off nothing.
    const broken: Effect[] = [
      { kind: "challenge", seat: 1 },
      { kind: "challenge", seat: "1", config_key: "some.setting" },
      { kind: "challenge", seat: 0, config_key: "some.setting" },
      { kind: "assign_role", seat: 1 },
      { kind: "assign_role", role: "some_role" },
      { kind: "announce", message_key: "some.message" },
      { kind: "announce", message_key: "some.message", params: { nested: { no: true } } },
    ];

    for (const effect of broken) {
      expect(isKnownEffect(effect)).toBe(false);
    }
  });

  it("keeps the known effects in the order the ruleset emitted them", () => {
    const effects: Effect[] = [
      { kind: "assign_role", seat: 1, role: "some_role" },
      { kind: "some_future_kind" },
      { kind: "challenge", seat: 1, config_key: "some.setting" },
      { kind: "challenge", seat: 1, config_key: "some.setting" },
    ];

    expect(paintableEffects(effects)).toEqual([ effects[0], effects[2], effects[3] ]);
  });

  it("recognises the minimum shape of an effect off the wire", () => {
    expect(isEffect({ kind: "challenge", seat: null, config_key: "some.setting" })).toBe(true);
    expect(isEffect({ kind: "anything_at_all" })).toBe(true);

    for (const rubbish of [ null, undefined, 7, "challenge", [], {}, { kind: "" }, { kind: 3 } ]) {
      expect(isEffect(rubbish)).toBe(false);
    }
  });
});
