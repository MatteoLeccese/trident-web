import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChallengeCard } from "./ChallengeCard";
import type { ChallengeEffect } from "@/domains/game/types";
import { seat } from "@/domains/game/testing/snapshot";

/**
 * Opaque settings keys throughout, and seats with no roles on them. The card
 * resolves a key against a flat map and reads the recipient the ruleset put in
 * the effect: if it branched on either, these tests would have to name a real
 * one.
 */

afterEach(cleanup);

const SEATS = [ seat(1, "Ana"), seat(2, "Bruno"), seat(3, "Carla") ];

const CONFIG = { "some.setting": "Do the thing.", "other.setting": "Do the other thing." };

function challenge (to: number | null, key = "some.setting"): ChallengeEffect {
  return { kind: "challenge", seat: to, config_key: key };
}

describe("a challenge card", () => {
  it("paints the text the key resolves to and never the key", () => {
    render(<ChallengeCard effect={challenge(1)} roomConfig={CONFIG} seats={SEATS} />);

    expect(screen.getByText("Do the thing.")).toBeInTheDocument();
    expect(screen.queryByText(/some\.setting/)).not.toBeInTheDocument();
  });

  it("names the recipient the effect carries, not whoever is holding the screen", () => {
    // This is the whole reason the effect has a recipient: the one card in the
    // game addressed elsewhere needs no special case here.
    render(<ChallengeCard effect={challenge(3)} roomConfig={CONFIG} seats={SEATS} viewerSeat={1} />);

    expect(screen.getByText("Carla")).toBeInTheDocument();
    expect(screen.queryByText("Ana")).not.toBeInTheDocument();
  });

  it("marks a card that names somebody other than the seat holding the screen", () => {
    const { container } = render(
      <ChallengeCard effect={challenge(3)} roomConfig={CONFIG} seats={SEATS} viewerSeat={1} />,
    );

    expect(container.querySelector("[data-challenge-card]")).toHaveAttribute("data-elsewhere");
  });

  it("does not mark a card addressed to the seat holding the screen", () => {
    const { container } = render(
      <ChallengeCard effect={challenge(1)} roomConfig={CONFIG} seats={SEATS} viewerSeat={1} />,
    );

    expect(container.querySelector("[data-challenge-card]")).not.toHaveAttribute("data-elsewhere");
  });

  it("marks nothing when no seat is holding the screen", () => {
    // A television speaks for the room and not for anybody at it, so every card
    // is painted the same way there.
    const { container } = render(
      <ChallengeCard effect={challenge(3)} roomConfig={CONFIG} seats={SEATS} size="tv" />,
    );

    expect(container.querySelector("[data-challenge-card]")).not.toHaveAttribute("data-elsewhere");
    expect(screen.getByText("Carla")).toBeInTheDocument();
  });

  it("addresses the whole table when the effect names no seat", () => {
    render(<ChallengeCard effect={challenge(null)} roomConfig={CONFIG} seats={SEATS} viewerSeat={1} />);

    expect(screen.getByText("Everyone")).toBeInTheDocument();
  });

  it("paints no card for a key the settings do not carry", () => {
    // The client applies no default of its own.
    const { container } = render(
      <ChallengeCard effect={challenge(1, "absent.setting")} roomConfig={CONFIG} seats={SEATS} />,
    );

    expect(container.querySelector("[data-challenge-card]")).toBeNull();
  });

  it("paints no card for a setting the table emptied", () => {
    const { container } = render(
      <ChallengeCard effect={challenge(1)} roomConfig={{ "some.setting": "" }} seats={SEATS} />,
    );

    expect(container.querySelector("[data-challenge-card]")).toBeNull();
  });

  it("paints the recipient's seat number when that seat has no name", () => {
    render(
      <ChallengeCard effect={challenge(9)} roomConfig={CONFIG} seats={[ ...SEATS, seat(9, "") ]} viewerSeat={1} />,
    );

    expect(screen.getByText("Seat 9")).toBeInTheDocument();
  });

  it("renders the table's text as text and never as markup", () => {
    // It is untrusted content painted across a television. Nothing in this
    // repository sets inner HTML, and this is the assertion that says so.
    const injected = "<img src=x onerror=alert(1)>";
    const { container } = render(
      <ChallengeCard effect={challenge(1)} roomConfig={{ "some.setting": injected }} seats={SEATS} />,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText(injected)).toBeInTheDocument();
  });

  it("wraps a long phrase instead of truncating it", () => {
    // Cutting a challenge short hides exactly what the application exists to
    // announce, so the text wraps anywhere and is never clipped.
    const long = "a".repeat(80);
    render(<ChallengeCard effect={challenge(1)} roomConfig={{ "some.setting": long }} seats={SEATS} size="tv" />);

    const text = screen.getByText(long);

    expect(text.className).toContain("salon-prose");
    expect(text.className).not.toContain("truncate");
    expect(text.className).not.toContain("line-clamp");
  });

  it("stages by its place in the version's cards", () => {
    const { container } = render(
      <ChallengeCard effect={challenge(1)} roomConfig={CONFIG} seats={SEATS} index={2} />,
    );

    const card = container.querySelector<HTMLElement>("[data-challenge-card]");

    expect(card?.className).toContain("stage-in");
    expect(card?.style.getPropertyValue("--stage-index")).toBe("2");
  });
});
