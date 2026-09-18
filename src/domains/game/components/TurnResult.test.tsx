import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TurnResult } from "./TurnResult";
import type { Effect } from "@/domains/game/types";
import { seat } from "@/domains/game/testing/snapshot";

afterEach(cleanup);

const SEATS = [ seat(1, "Ana"), seat(2, "Bruno") ];

const CONFIG = { "some.setting": "Do the thing.", "other.setting": "Do the other thing." };

/** Two cards, as a tile that fired two of them arrives. */
const EFFECTS: Effect[] = [
  { kind: "challenge", seat: 1, config_key: "some.setting" },
  { kind: "challenge", seat: 2, config_key: "other.setting" },
];

function result (overrides: Partial<Parameters<typeof TurnResult>[0]> = {}) {
  return render(
    <TurnResult
      tile="21"
      position={7}
      holderSeat={1}
      holderName="Ana"
      effects={EFFECTS}
      version={12}
      roomConfig={CONFIG}
      seats={SEATS}
      onContinue={vi.fn()}
      {...overrides}
    />,
  );
}

describe("what a draw produced", () => {
  it("shows the face the pool now carries, at the position that was tapped", () => {
    const { container } = result();

    expect(container.querySelector("[data-drawn-tile='7']")).not.toBeNull();
    expect(screen.getByLabelText("Tile 2 1")).toBeInTheDocument();
  });

  it("turns the tile over as an animation and not as a layout change", () => {
    // The face and the back share a view box, so the flip moves no neighbour.
    const { container } = result();

    expect(container.querySelector("[data-drawn-tile]")?.className).toContain("flip-in");
  });

  it("shows no tile at all when the pool published no face for that position", () => {
    const { container } = result({ tile: null });

    expect(container.querySelector("[data-drawn-tile]")).toBeNull();
    expect(container.querySelectorAll("[data-challenge-card]")).toHaveLength(2);
  });

  it("names the seat holding the phone and not the server's cursor", () => {
    const { container } = result();

    expect(screen.getByText("Holding the phone")).toBeInTheDocument();
    expect(container.querySelector("[data-current-player-name]")).toHaveTextContent("Ana");
  });

  it("paints the cards in the order the ruleset emitted them", () => {
    const { container } = result();
    const cards = Array.from(container.querySelectorAll("[data-challenge-card]"));

    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent("Do the thing.");
    expect(cards[1]).toHaveTextContent("Do the other thing.");
  });

  it("marks the card addressed to somebody who is not holding the phone", () => {
    const { container } = result();
    const cards = Array.from(container.querySelectorAll("[data-challenge-card]"));

    expect(cards[0]).not.toHaveAttribute("data-elsewhere");
    expect(cards[1]).toHaveAttribute("data-elsewhere");
  });

  it("stages the cards after the tile", () => {
    const { container } = result();
    const cards = Array.from(container.querySelectorAll<HTMLElement>("[data-challenge-card]"));

    expect(cards.map((card) => card.style.getPropertyValue("--stage-index"))).toEqual([ "1", "2" ]);
  });

  it("moves on when a person taps and never on its own", async () => {
    const onContinue = vi.fn();
    const { container } = result({ onContinue });

    expect(container.querySelector("progress, [role='timer']")).toBeNull();

    await userEvent.click(screen.getByText("Done reading"));

    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("does not mount the board", () => {
    // Between turns the board is absent, not disabled.
    const { container } = result();

    expect(container.querySelector("[data-tile-grid], [data-board-scroller]")).toBeNull();
  });
});
