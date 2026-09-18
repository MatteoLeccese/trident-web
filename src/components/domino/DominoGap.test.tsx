import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TILE_VIEWBOX } from "./dominoPips";
import { DominoBack } from "./DominoBack";
import { DominoFace } from "./DominoFace";
import { DominoGap } from "./DominoGap";

/**
 * The empty place is asserted through its geometry, because its geometry is the
 * whole reason it exists: a board that takes its tiles away must not move.
 *
 * Renders are torn down by hand: this suite does not run with Vitest's globals,
 * so Testing Library's own cleanup hook never registers itself.
 */

afterEach(cleanup);

describe("a place on the board with no tile in it", () => {
  it("occupies the same box as a tile, so the grid never reflows around it", () => {
    const { container: gap } = render(<DominoGap />);
    const { container: face } = render(<DominoFace tile="34" />);
    const { container: back } = render(<DominoBack position={7} />);
    const box = gap.querySelector("svg")?.getAttribute("viewBox");

    expect(box).toBe(TILE_VIEWBOX);
    expect(box).toBe(face.querySelector("svg")?.getAttribute("viewBox"));
    expect(box).toBe(back.querySelector("svg")?.getAttribute("viewBox"));
  });

  it("scales by its box and carries no pixel size of its own", () => {
    const { container } = render(<DominoGap />);
    const svg = container.querySelector("svg");

    expect(svg?.getAttribute("width")).toBeNull();
    expect(svg?.getAttribute("height")).toBeNull();
  });

  it("draws no face, no pip and no seat", () => {
    // It is inert: what was drawn is gone from the board, and the record of who
    // drew it lives on the screen that exists for the record.
    const { container } = render(<DominoGap />);

    expect(container.querySelector("[data-pips]")).toBeNull();
    expect(container.querySelector("[data-seat]")).toBeNull();
    expect(container.querySelector("[data-emblem]")).toBeNull();
    expect(container.querySelectorAll("circle")).toHaveLength(0);
  });

  it("draws the recess and not a tile, at low contrast", () => {
    // It has to read as a table being cleared and not as a renderer that failed,
    // and it must not compete with the tiles that are still there to be drawn.
    const { container } = render(<DominoGap />);
    const recess = container.querySelector("[data-gap]");

    expect(recess).not.toBeNull();
    expect(recess?.getAttribute("stroke-dasharray")).not.toBeNull();
    expect(Number(recess?.getAttribute("opacity"))).toBeLessThan(1);
    expect(Number(recess?.getAttribute("opacity"))).toBeGreaterThan(0);
  });

  it("names itself for a screen reader without naming why it is empty", () => {
    // Why the place is empty is the table's setting, and no screen spells it.
    render(<DominoGap />);

    expect(screen.getByRole("img", { name: "Empty place" })).toBeInTheDocument();
  });

  it("names its position when it is given one, because on a board it is in a row of them", () => {
    render(<DominoGap position={12} />);

    expect(screen.getByRole("img", { name: "Position 12, empty place" })).toBeInTheDocument();
  });

  it("uses only the palette's tokens, so both themes come for nothing", () => {
    const { container } = render(<DominoGap />);
    const recess = container.querySelector("[data-gap]");

    expect(recess?.getAttribute("fill")).toMatch(/^var\(--/u);
    expect(recess?.getAttribute("stroke")).toMatch(/^var\(--/u);
  });
});
