import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CurrentPlayer } from "./CurrentPlayer";

afterEach(cleanup);

describe("the name on screen", () => {
  it("paints the label and the name it was given", () => {
    render(<CurrentPlayer label="Now playing" name="Ana" />);

    expect(screen.getByText("Now playing")).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
  });

  it("says what it was told to say when there is nobody to name", () => {
    // Never an invented name: a table cannot match "Player 3" to anybody.
    render(<CurrentPlayer label="Now playing" name={null} fallback="The game has not started" />);

    expect(screen.getByText("The game has not started")).toBeInTheDocument();
  });

  it("uses the salon scale on a television and a phone scale on a phone", () => {
    const { container: tv } = render(<CurrentPlayer label="Now playing" name="Ana" size="tv" />);

    expect(tv.querySelector("[data-current-player-name]")?.className).toContain("salon-name");

    cleanup();

    const { container: phone } = render(<CurrentPlayer label="Now playing" name="Ana" />);

    expect(phone.querySelector("[data-current-player-name]")?.className).not.toContain("salon-name");
  });
});
