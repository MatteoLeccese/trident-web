import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ConnectionBadge, badgeHealth } from "./ConnectionBadge";

afterEach(cleanup);

describe("what the badge says", () => {
  it("is live when the socket is up and the writes are landing", () => {
    expect(badgeHealth("connected", "healthy")).toBe("live");
    expect(badgeHealth("connected", "idle")).toBe("live");
  });

  it("says a phone is not saving when its socket is fine and its writes are not", () => {

    /*
     * The case this exists for, and the worst one at a table: the board is on
     * screen, the name is on screen, the dot is green, and the game has stopped.
     * The socket is how a screen hears and the phone is the one device that
     * speaks, so a healthy read path says nothing about the write path.
     */
    expect(badgeHealth("connected", "failing")).toBe("not-saving");
    expect(badgeHealth("connecting", "failing")).toBe("not-saving");
  });

  it("lets a dead socket win", () => {
    // A screen that cannot hear has nothing to say about whether it can speak,
    // and two complaints at once are no complaint at all.
    expect(badgeHealth("offline", "failing")).toBe("offline");
    expect(badgeHealth("offline", "healthy")).toBe("offline");
  });

  it("says nothing about writes a phone has not made", () => {
    // A lobby nobody has typed a name into yet is not a broken one, and painting
    // it red would send the organiser to restart the application.
    render(<ConnectionBadge status="connected" writes="idle" />);

    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("carries its verdict for the screen around it", () => {
    const { container } = render(<ConnectionBadge status="connected" writes="failing" />);

    expect(container.querySelector("[data-connection]")).toHaveAttribute("data-connection", "not-saving");
    expect(screen.getByText("Not saving")).toBeInTheDocument();
  });

  it("is a television's badge when it is given no writes to report", () => {
    // A television never writes, so it has nothing to say about writing.
    render(<ConnectionBadge status="connected" size="tv" />);

    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("reads from three metres on a television and from thirty centimetres on a phone", () => {
    const { container: tv } = render(<ConnectionBadge status="connected" size="tv" />);

    expect(tv.querySelector("[data-connection]")?.className).toContain("text-[0.9em]");

    cleanup();

    const { container: phone } = render(<ConnectionBadge status="connected" />);

    expect(phone.querySelector("[data-connection]")?.className).toContain("text-xs");
  });
});
