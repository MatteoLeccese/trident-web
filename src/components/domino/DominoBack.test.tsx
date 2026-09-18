import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TILE_VIEWBOX } from "./dominoPips";
import { DominoBack, MAX_TILT_DEGREES, backTiltDegrees } from "./DominoBack";

/**
 * Renders are torn down by hand: this suite does not run with Vitest's globals,
 * so Testing Library's own cleanup hook never registers itself.
 */

afterEach(cleanup);

/** The pool a stage materialises (TR-01). */
const POOL = Array.from({ length: 49 }, (_unused, index) => index + 1);

describe("the tilt of a tile face down", () => {
  it("is a function of the position and of nothing else", () => {
    // The same position tilts the same way on the phone, on the television and
    // after a reload: a random tilt would shuffle the board on every frame.
    expect(backTiltDegrees(17)).toBe(backTiltDegrees(17));
    expect(backTiltDegrees(17)).not.toBe(backTiltDegrees(18));
  });

  it("stays within a couple of degrees", () => {
    for (const position of POOL) {
      expect(Math.abs(backTiltDegrees(position))).toBeLessThanOrEqual(MAX_TILT_DEGREES);
    }
  });

  it("gives every position of the pool its own angle", () => {
    expect(new Set(POOL.map(backTiltDegrees)).size).toBe(POOL.length);
  });

  it("scatters neighbours instead of walking them", () => {
    // Consecutive positions sit next to each other on the board, so a tilt that
    // grew with the position would read as a fan and not as a scatter.
    for (const position of POOL.slice(0, -1)) {
      expect(Math.abs(backTiltDegrees(position) - backTiltDegrees(position + 1))).toBeGreaterThan(0.5);
    }
  });

  it("tilts both ways", () => {
    const angles = POOL.map(backTiltDegrees);

    expect(angles.some((angle) => angle > 0)).toBe(true);
    expect(angles.some((angle) => angle < 0)).toBe(true);
  });

  it("answers a position outside the pool without throwing", () => {
    expect(Number.isFinite(backTiltDegrees(0))).toBe(true);
    expect(Number.isFinite(backTiltDegrees(-3))).toBe(true);
    expect(Number.isFinite(backTiltDegrees(1_000_000))).toBe(true);
  });
});

describe("a tile face down", () => {
  it("occupies the same box as a tile face up", () => {
    const { container } = render(<DominoBack position={5} />);

    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe(TILE_VIEWBOX);
  });

  it("carries its tilt as a transform, which moves no neighbour", () => {
    const { container } = render(<DominoBack position={5} />);
    const svg = container.querySelector("svg");

    expect(svg?.getAttribute("style")).toContain(`rotate(${backTiltDegrees(5)}deg)`);
  });

  it("shows the brass emblem", () => {
    const { container } = render(<DominoBack position={5} />);
    const emblem = container.querySelector("[data-emblem]");

    expect(emblem).not.toBeNull();
    expect(emblem?.getAttribute("stroke")).toBe("var(--accent)");
    expect(emblem?.querySelectorAll("path").length).toBeGreaterThan(0);
  });

  it("shows no face at all", () => {
    // A position nobody has taken carries no face, for everybody at once (TR-07).
    const { container } = render(<DominoBack position={5} />);

    expect(container.querySelector("[data-pips]")).toBeNull();
  });

  it("names itself for a screen reader by its position, without naming a tile", () => {
    // Every back on the board draws the same picture, so the number is the only
    // thing that tells one cell from another out loud — and it is the number the
    // person holding the phone says when they ask about one.
    render(<DominoBack position={5} />);

    expect(screen.getByRole("img", { name: "Position 5, face down" })).toBeInTheDocument();
  });
});
