import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LastPlay } from "./LastPlay";
import { seat } from "@/domains/game/testing/snapshot";

afterEach(cleanup);

const SEATS = [ seat(1, "Ana"), seat(2, "Bruno"), seat(3, "Carla") ];

const DRAW = { position: 7, tile: "43", seat: 2 };

describe("the last play", () => {
  it("names the seat the draw is attributed to, and says that is what it is", () => {
    // The whole point: the cursor above this names the next seat, and without
    // the label the room reads the cards under it as that seat's.
    render(<LastPlay draw={DRAW} seats={SEATS} />);

    expect(screen.getByText("Last play by")).toBeInTheDocument();
    expect(screen.getByText("Bruno")).toBeInTheDocument();
  });

  it("paints the face the draw carries, at the position it came from", () => {
    render(<LastPlay draw={DRAW} seats={SEATS} />);

    expect(screen.getByLabelText("Position 7, tile 4 3, seat 2")).toBeInTheDocument();
  });

  it("carries the position for the screen around it", () => {
    const { container } = render(<LastPlay draw={DRAW} seats={SEATS} />);

    expect(container.querySelector("[data-last-play]")).toHaveAttribute("data-last-play", "7");
  });

  it("says only that there was a last play when the seat has no name to give", () => {
    // A seat that is not in the roster names nobody, and inventing a name here
    // would attribute a draw to somebody who did not make it.
    render(<LastPlay draw={{ ...DRAW, seat: 9 }} seats={SEATS} />);

    expect(screen.getByText("Last play")).toBeInTheDocument();
    expect(screen.queryByText("Last play by")).not.toBeInTheDocument();
    expect(screen.queryByText("Bruno")).not.toBeInTheDocument();
  });

  it("paints the seat's number when that seat has no nickname", () => {
    render(<LastPlay draw={{ ...DRAW, seat: 9 }} seats={[ ...SEATS, seat(9, "") ]} />);

    expect(screen.getByText("Seat 9")).toBeInTheDocument();
  });

  it("is read from three metres on a television and from thirty centimetres on a phone", () => {
    const { container: tv } = render(<LastPlay draw={DRAW} seats={SEATS} size="tv" />);

    expect(tv.querySelector("[data-last-play-name]")?.className).toContain("salon-lead");

    cleanup();

    const { container: phone } = render(<LastPlay draw={DRAW} seats={SEATS} size="phone" />);

    expect(phone.querySelector("[data-last-play-name]")?.className).toContain("text-2xl");
  });
});
