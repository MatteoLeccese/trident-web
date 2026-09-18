import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import TvLayout from "./layout";

afterEach(cleanup);

describe("the watch route's layout", () => {
  it("forces dark on every screen under it", () => {
    // A television that reports a light preference — and plenty do, out of the
    // box, with nobody having chosen it — would otherwise serve a bone-white
    // rectangle into a room with the lights down.
    const { container } = render(<TvLayout><p>watching</p></TvLayout>);

    const frame = container.querySelector("[data-forced-dark]");

    expect(frame?.className).toContain("dark");
    expect(frame).toHaveTextContent("watching");
  });

  it("paints its own background, because that is where the dark tokens start", () => {
    const { container } = render(<TvLayout><p>watching</p></TvLayout>);

    expect(container.querySelector("[data-forced-dark]")?.className).toContain("bg-background");
  });

  it("forces it with a class and not with a script, so there is no flash of the wrong theme", () => {
    const { container } = render(<TvLayout><p>watching</p></TvLayout>);

    expect(container.querySelector("script")).toBeNull();
  });
});
