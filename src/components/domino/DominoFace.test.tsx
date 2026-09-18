import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TILE_HALF_HEIGHT, TILE_VIEWBOX } from "./dominoPips";
import { DominoBack } from "./DominoBack";
import { DominoFace } from "./DominoFace";

/**
 * The face is asserted through its geometry and never through a pixel size: it
 * carries no width, so the same element is a tile on a phone and a tile on a
 * television.
 *
 * Renders are torn down by hand: this suite does not run with Vitest's globals,
 * so Testing Library's own cleanup hook never registers itself.
 */

afterEach(cleanup);

function pips (container: HTMLElement): SVGCircleElement[] {
  return Array.from(container.querySelectorAll<SVGCircleElement>("[data-pips] circle"));
}

function pipsIn (container: HTMLElement, half: "top" | "bottom"): SVGCircleElement[] {
  return pips(container).filter((pip) => {
    const y = Number(pip.getAttribute("cy"));

    return half === "top" ? y < TILE_HALF_HEIGHT : y >= TILE_HALF_HEIGHT;
  });
}

describe("a tile face up", () => {
  it("draws one pip per dot of each face, in the order the string gives them", () => {
    // TR-02: `21` and `12` are different tiles, and the face reads them apart.
    const { container } = render(<DominoFace tile="21" />);

    expect(pipsIn(container, "top")).toHaveLength(2);
    expect(pipsIn(container, "bottom")).toHaveLength(1);
  });

  it("draws the same two faces the other way round for the mirrored tile", () => {
    const { container } = render(<DominoFace tile="12" />);

    expect(pipsIn(container, "top")).toHaveLength(1);
    expect(pipsIn(container, "bottom")).toHaveLength(2);
  });

  it("draws the emptiest and the fullest tile of the deck", () => {
    const { container: blank } = render(<DominoFace tile="00" />);
    const { container: full } = render(<DominoFace tile="66" />);

    expect(pips(blank)).toHaveLength(0);
    expect(pips(full)).toHaveLength(12);
  });

  it("keeps every pip inside its own half", () => {
    const { container } = render(<DominoFace tile="66" />);

    for (const pip of pips(container)) {
      const y = Number(pip.getAttribute("cy"));
      const radius = Number(pip.getAttribute("r"));

      expect(y - radius).toBeGreaterThan(0);
      expect(y + radius).toBeLessThan(TILE_HALF_HEIGHT * 2);
    }
  });

  it("scales by its box and carries no pixel size of its own", () => {
    const { container } = render(<DominoFace tile="34" />);
    const svg = container.querySelector("svg");

    expect(svg?.getAttribute("viewBox")).toBe(TILE_VIEWBOX);
    expect(svg?.getAttribute("width")).toBeNull();
    expect(svg?.getAttribute("height")).toBeNull();
  });

  it("shares its box with the back, so turning a tile over reflows nothing", () => {
    const { container: face } = render(<DominoFace tile="34" />);
    const { container: back } = render(<DominoBack position={7} />);

    expect(face.querySelector("svg")?.getAttribute("viewBox"))
      .toBe(back.querySelector("svg")?.getAttribute("viewBox"));
  });

  it("comes out blank rather than missing for a tile it cannot draw", () => {
    // A ruleset declares its own deck, so a face this build cannot draw is
    // possible on the wire. The board stays complete.
    const { container } = render(<DominoFace tile="99" />);

    expect(container.querySelector("svg")).not.toBeNull();
    expect(pips(container)).toHaveLength(0);
  });

  it("names itself for a screen reader by the faces it shows", () => {
    render(<DominoFace tile="21" />);

    expect(screen.getByRole("img", { name: "Tile 2 1" })).toBeInTheDocument();
  });

  it("names its position when it is given one, because on a board it is in a row of them", () => {
    // Two positions of the same pool can hold the same face taken by the same
    // seat, and then the number is all that tells the two cells apart.
    render(<DominoFace tile="21" position={12} seat={4} />);

    expect(screen.getByRole("img", { name: "Position 12, tile 2 1, seat 4" })).toBeInTheDocument();
  });
});

describe("a tile already taken", () => {
  it("keeps its pips and gives up their contrast", () => {
    // What gives way is the legibility of the pips and nothing else: the tile is
    // still there, still readable up close, and still exactly where it was (TR-08).
    const { container } = render(<DominoFace tile="53" muted />);
    const group = container.querySelector("[data-pips]");

    expect(pips(container)).toHaveLength(8);
    expect(Number(group?.getAttribute("opacity"))).toBeLessThan(1);
    expect(Number(group?.getAttribute("opacity"))).toBeGreaterThan(0);
  });

  it("carries the seat it is attributed to, in brass and over the tile", () => {
    const { container } = render(<DominoFace tile="53" muted seat={12} />);
    const badge = container.querySelector("[data-seat]");

    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe("12");
    expect(badge?.querySelector("circle")?.getAttribute("fill")).toBe("var(--accent)");
  });

  it("reads its seat out loud, so the board says who filled it", () => {
    render(<DominoFace tile="53" muted seat={12} />);

    expect(screen.getByRole("img", { name: "Tile 5 3, seat 12" })).toBeInTheDocument();
  });

  it("paints no badge when nothing attributes the position to a seat", () => {
    const { container } = render(<DominoFace tile="53" muted />);

    expect(container.querySelector("[data-seat]")).toBeNull();
  });

  it("keeps the seat in its name for a tile it cannot draw", () => {

    /*
     * A ruleset declares its own deck, so a face this build's pip map cannot
     * draw is possible on the wire. The badge over it is still painted, and the
     * name still carries it: the seat is what the board is for, and it is the
     * one clause that must not go down with the faces.
     */
    const { container } = render(<DominoFace tile="97" position={3} seat={5} />);

    expect(container.querySelector("[data-seat]")?.textContent).toBe("5");
    expect(screen.getByRole("img", { name: "Position 3, tile, seat 5" })).toBeInTheDocument();

    cleanup();

    render(<DominoFace tile="97" seat={5} />);

    expect(screen.getByRole("img", { name: "Tile, seat 5" })).toBeInTheDocument();
  });

  it("paints the seat badge at full contrast while the pips recede", () => {
    const { container } = render(<DominoFace tile="53" muted seat={3} />);
    const badge = container.querySelector("[data-seat]");
    const group = container.querySelector("[data-pips]");

    expect(badge?.getAttribute("opacity")).toBeNull();
    expect(Number(group?.getAttribute("opacity"))).toBeLessThan(1);
  });
});
