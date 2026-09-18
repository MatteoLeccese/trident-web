import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HandOff } from "./HandOff";

afterEach(cleanup);

describe("the hand-off", () => {
  it("says who the phone goes to", () => {
    render(<HandOff name="Bruno" onDone={vi.fn()} />);

    expect(screen.getByText("Pass the phone to")).toBeInTheDocument();
    expect(screen.getByText("Bruno")).toBeInTheDocument();
  });

  it("puts the name on the button, so the wrong person feels that it is wrong", () => {
    const { container } = render(<HandOff name="Bruno" onDone={vi.fn()} />);

    expect(container.querySelector("[data-handoff-button]")).toHaveTextContent("I am Bruno");
  });

  it("still offers a way on when there is nobody to name", () => {
    const { container } = render(<HandOff name={null} onDone={vi.fn()} />);

    expect(container.querySelector("[data-handoff-button]")).toHaveTextContent("I have the phone");
  });

  it("advances on a tap and on nothing else", async () => {
    const onDone = vi.fn();
    const { container } = render(<HandOff name="Bruno" onDone={onDone} />);

    expect(container.querySelector("progress, [role='timer']")).toBeNull();

    await userEvent.click(screen.getByText("I am Bruno"));

    expect(onDone).toHaveBeenCalledOnce();
  });

  it("covers the screen, so there is nothing else to touch", () => {
    // Between turns the board is not disabled, it is not there. This is what is
    // there instead.
    const { container } = render(<HandOff name="Bruno" onDone={vi.fn()} />);

    expect(container.querySelector("[data-handoff]")?.className).toContain("fixed inset-0");
  });
});
