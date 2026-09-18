import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EffectBanner } from "./EffectBanner";
import { EffectList } from "./EffectList";
import type { Effect } from "@/domains/game/types";
import { seat } from "@/domains/game/testing/snapshot";

/**
 * Opaque kinds, keys and roles. The banner narrows through the guards and paints
 * what it is handed; a test that named a real role or a real settings key would
 * be asserting knowledge the client is not allowed to have.
 */

afterEach(cleanup);

const SEATS = [ seat(1, "Ana"), seat(2, "Bruno") ];

const CONFIG = { "some.setting": "Do the thing." };

function banner (effect: Effect) {
  return render(<EffectBanner effect={effect} roomConfig={CONFIG} seats={SEATS} viewerSeat={1} />);
}

describe("painting one effect", () => {
  it("paints a challenge as a card", () => {
    const { container } = banner({ kind: "challenge", seat: 2, config_key: "some.setting" });

    expect(container.querySelector("[data-challenge-card]")).not.toBeNull();
    expect(screen.getByText("Do the thing.")).toBeInTheDocument();
  });

  it("paints a role assignment as the seat's name beside the token the ruleset sent", () => {
    const { container } = banner({ kind: "assign_role", seat: 2, role: "some_role" });

    expect(screen.getByText("Bruno")).toBeInTheDocument();
    expect(container.querySelector("[data-role-token='some_role']")).not.toBeNull();
  });

  it("paints nothing for a role assigned to a seat that is not at this table", () => {
    const { container } = banner({ kind: "assign_role", seat: 9, role: "some_role" });

    expect(container.querySelector("[data-role-banner]")).toBeNull();
  });

  it("paints nothing for an announcement this build has no copy for", () => {
    const { container } = banner({ kind: "announce", message_key: "some.message", params: {} });

    expect(container.querySelector("[data-announcement]")).toBeNull();
  });

  it("paints nothing for a kind this build has never heard of", () => {
    // A ruleset may declare one. The fallback is neutral: nothing painted,
    // nothing thrown, and the rest of the version still on screen.
    const { container } = banner({ kind: "some_future_kind", whatever: 7 });

    expect(container.innerHTML).toBe("");
  });

  it("paints nothing for a known kind that arrives malformed", () => {
    // It lands on the same neutral path, which is why the guards check the whole
    // shape and not only the discriminator.
    const { container } = banner({ kind: "challenge", seat: 2 } as unknown as Effect);

    expect(container.innerHTML).toBe("");
  });
});

describe("painting one version's effects", () => {
  const effects: Effect[] = [
    { kind: "assign_role", seat: 1, role: "some_role" },
    { kind: "challenge", seat: 1, config_key: "some.setting" },
    { kind: "challenge", seat: 2, config_key: "some.setting" },
  ];

  it("keeps the order the ruleset emitted them in", () => {
    // Which card comes first and how many there are is the ruleset's answer. A
    // screen that sorted or grouped them would be deciding a rule.
    const { container } = render(
      <EffectList effects={effects} version={1} roomConfig={CONFIG} seats={SEATS} viewerSeat={1} />,
    );

    const cards = Array.from(container.querySelectorAll("[data-role-banner], [data-challenge-card]"));

    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveAttribute("data-role-banner");
    expect(cards[1]).not.toHaveAttribute("data-elsewhere");
    expect(cards[2]).toHaveAttribute("data-elsewhere");
  });

  it("paints the same key twice when the ruleset emitted it twice", () => {
    const twice: Effect[] = [
      { kind: "challenge", seat: 1, config_key: "some.setting" },
      { kind: "challenge", seat: 1, config_key: "some.setting" },
    ];

    const { container } = render(<EffectList effects={twice} version={1} roomConfig={CONFIG} seats={SEATS} />);

    expect(container.querySelectorAll("[data-challenge-card]")).toHaveLength(2);
  });

  it("carries an unknown kind past without dropping the ones around it", () => {
    const mixed: Effect[] = [
      { kind: "some_future_kind", whatever: 1 },
      { kind: "challenge", seat: 1, config_key: "some.setting" },
    ];

    const { container } = render(<EffectList effects={mixed} version={1} roomConfig={CONFIG} seats={SEATS} />);

    expect(container.querySelectorAll("[data-challenge-card]")).toHaveLength(1);
  });

  it("paints nothing at all for a version that consulted no rule", () => {
    // A rename carries an empty list, and an empty list is not an empty box.
    const { container } = render(<EffectList effects={[]} version={1} roomConfig={CONFIG} seats={SEATS} />);

    expect(container.querySelector("[data-effect-list]")).toBeNull();
  });

  it("gives a new version new card nodes, so the reveal runs again", () => {

    /*
     * The stagger is a CSS animation, and a CSS animation runs when its element
     * is inserted and never again. The television keeps this list mounted for
     * the whole game, so cards keyed by position alone would land on the
     * previous version's nodes: from the second tile of the night the text would
     * swap with no beat, which is the one pause the room is given between the
     * tile turning over and what it asks for (TR-48b).
     */
    const { container, rerender } = render(
      <EffectList effects={effects} version={4} roomConfig={CONFIG} seats={SEATS} />,
    );

    const before = Array.from(container.querySelectorAll("[data-role-banner], [data-challenge-card]"));

    rerender(<EffectList effects={effects} version={5} roomConfig={CONFIG} seats={SEATS} />);

    const after = Array.from(container.querySelectorAll("[data-role-banner], [data-challenge-card]"));

    expect(after).toHaveLength(before.length);
    after.forEach((card, index) => expect(card).not.toBe(before[index]));
  });

  it("keeps the same nodes while the version has not moved", () => {
    // A re-render that is not a new version is not a new beat.
    const { container, rerender } = render(
      <EffectList effects={effects} version={4} roomConfig={CONFIG} seats={SEATS} />,
    );

    const before = Array.from(container.querySelectorAll("[data-role-banner], [data-challenge-card]"));

    rerender(<EffectList effects={effects} version={4} roomConfig={CONFIG} seats={SEATS} />);

    Array.from(container.querySelectorAll("[data-role-banner], [data-challenge-card]"))
      .forEach((card, index) => expect(card).toBe(before[index]));
  });

  it("stages the cards in order, from the offset it was given", () => {
    const { container } = render(
      <EffectList effects={effects} version={1} roomConfig={CONFIG} seats={SEATS} offset={1} />,
    );

    const staged = Array.from(container.querySelectorAll<HTMLElement>("[data-role-banner], [data-challenge-card]"));

    expect(staged.map((card) => card.style.getPropertyValue("--stage-index"))).toEqual([ "1", "2", "3" ]);
  });
});
