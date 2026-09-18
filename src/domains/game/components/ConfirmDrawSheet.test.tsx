import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDrawSheet } from "./ConfirmDrawSheet";

afterEach(cleanup);

describe("the question between a tap and a write", () => {
  it("carries the name inside the question", () => {
    // A bare "Confirm?" is answered by whoever is holding the phone, which
    // around a table is regularly the wrong person.
    render(<ConfirmDrawSheet name="Ana" position={7} pending={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText("Does Ana take this one?")).toBeInTheDocument();
  });

  it("says which position it is about", () => {
    render(<ConfirmDrawSheet name="Ana" position={7} pending={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText("Position 7")).toBeInTheDocument();
  });

  it("asks without a name only when there is none to use", () => {
    render(<ConfirmDrawSheet name={null} position={7} pending={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText("Take this one?")).toBeInTheDocument();
  });

  it("puts the question in the dialog's own label, so it is announced", () => {
    const { container } = render(
      <ConfirmDrawSheet name="Ana" position={7} pending={false} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(container.querySelector("[data-confirm-sheet]"))
      .toHaveAttribute("aria-label", "Does Ana take this one?");
  });

  it("confirms and cancels on a tap", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(<ConfirmDrawSheet name="Ana" position={7} pending={false} onConfirm={onConfirm} onCancel={onCancel} />);

    await userEvent.click(screen.getByText("Turn it over"));
    await userEvent.click(screen.getByText("Not yet"));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("holds both controls while the write is in flight", async () => {
    // Retries happen inside the one call, so the control stays held for all of
    // them: the person is never the retry mechanism.
    const onConfirm = vi.fn();

    render(<ConfirmDrawSheet name="Ana" position={7} pending onConfirm={onConfirm} onCancel={vi.fn()} />);

    const confirm = screen.getByText("Turning it over…");

    expect(confirm).toBeDisabled();
    expect(screen.getByText("Not yet")).toBeDisabled();

    await userEvent.click(confirm);

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("takes the focus when it opens", async () => {

    /*
     * `aria-modal` hides the board behind the sheet from a screen reader only
     * once the focus is inside it. Opening one and leaving the focus where it
     * was is a modal nothing announced, with two buttons nobody can reach
     * without tabbing from the top of the document.
     */
    const { findByText } = render(
      <ConfirmDrawSheet name="Ana" position={7} pending={false} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(document.activeElement).toBe(await findByText("Turn it over"));
  });

  it("closes on Escape, which is the way out of a modal", async () => {
    const onCancel = vi.fn();

    render(<ConfirmDrawSheet name="Ana" position={7} pending={false} onConfirm={vi.fn()} onCancel={onCancel} />);

    await userEvent.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("refuses Escape while the write is in flight, like both of its buttons", async () => {
    const onCancel = vi.fn();

    render(<ConfirmDrawSheet name="Ana" position={7} pending onConfirm={vi.fn()} onCancel={onCancel} />);

    await userEvent.keyboard("{Escape}");

    expect(onCancel).not.toHaveBeenCalled();
  });

  it("keeps the focus inside itself, forwards and backwards", async () => {
    render(<ConfirmDrawSheet name="Ana" position={7} pending={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    const cancel = screen.getByText("Not yet");
    const confirm = screen.getByText("Turn it over");

    await userEvent.tab();

    expect(document.activeElement).toBe(cancel);

    await userEvent.tab({ shift: true });

    expect(document.activeElement).toBe(confirm);
  });

  it("keeps the focus on itself while both of its buttons are held", async () => {
    // Disabling the focused button would drop the focus to the document and out
    // of the dialog, in the one moment there is nothing else to look at.
    const { findByLabelText } = render(
      <ConfirmDrawSheet name="Ana" position={7} pending onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(document.activeElement).toBe(await findByLabelText("Does Ana take this one?"));
  });

  it("hands the focus back to where it came from when it closes", async () => {
    const outside = document.createElement("button");

    outside.textContent = "The tile";
    document.body.append(outside);
    outside.focus();

    const { unmount } = render(
      <ConfirmDrawSheet name="Ana" position={7} pending={false} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(document.activeElement).not.toBe(outside);

    unmount();

    expect(document.activeElement).toBe(outside);

    outside.remove();
  });

  it("carries no countdown of any kind", () => {
    const { container } = render(
      <ConfirmDrawSheet name="Ana" position={7} pending={false} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(container.querySelector("progress, [role='timer']")).toBeNull();
  });
});
