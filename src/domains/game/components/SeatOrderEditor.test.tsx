import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SeatOrderEditor } from "./SeatOrderEditor";
import { seat } from "@/domains/game/testing/snapshot";

afterEach(cleanup);

const SEATS = [ seat(1, "Ana"), seat(2, "Bruno"), seat(3, "Carla") ];

function names (container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("[data-seat-row]"))
    .map((row) => row.getAttribute("data-seat-row") ?? "");
}

/**
 * The rows have no geometry in jsdom, so a drag is driven by stubbing the boxes
 * the component measures. That is the only fiction here: the pointer events, the
 * handler wiring and the resulting order are the component's own.
 */
function stubRows (container: HTMLElement, height = 40): void {
  Array.from(container.querySelectorAll<HTMLElement>("[data-seat-row]")).forEach((row, index) => {
    row.getBoundingClientRect = () => ({
      top: index * height,
      bottom: (index + 1) * height,
      height,
      left: 0,
      right: 100,
      width: 100,
      x: 0,
      y: index * height,
      toJSON: () => ({}),
    }) as DOMRect;
  });
}

describe("editing the ring's order", () => {
  it("lists the seats in the order the roster arrived", () => {
    const { container } = render(<SeatOrderEditor seats={SEATS} onSave={vi.fn()} />);

    expect(names(container)).toEqual([ "1", "2", "3" ]);
  });

  it("offers up and down on every row, always, and not as a fallback", () => {
    // They are the accessible path, the thumb path and the one-handed path at
    // once, and a table sorting itself out uses them far more than the drag.
    render(<SeatOrderEditor seats={SEATS} onSave={vi.fn()} />);

    expect(screen.getByLabelText("Move Bruno up")).toBeInTheDocument();
    expect(screen.getByLabelText("Move Bruno down")).toBeInTheDocument();
  });

  it("moves a seat with the buttons", async () => {
    const { container } = render(<SeatOrderEditor seats={SEATS} onSave={vi.fn()} />);

    await userEvent.click(screen.getByLabelText("Move Carla up"));

    expect(names(container)).toEqual([ "1", "3", "2" ]);

    await userEvent.click(screen.getByLabelText("Move Ana down"));

    expect(names(container)).toEqual([ "3", "1", "2" ]);
  });

  it("closes the end of the list rather than wrapping around it", () => {
    render(<SeatOrderEditor seats={SEATS} onSave={vi.fn()} />);

    expect(screen.getByLabelText("Move Ana up")).toBeDisabled();
    expect(screen.getByLabelText("Move Carla down")).toBeDisabled();
  });

  it("refuses the browser's gestures on the handle and nowhere else", () => {
    // On the row or on the list this would stop the list scrolling, which with
    // twelve players makes the names at the bottom unreachable.
    const { container } = render(<SeatOrderEditor seats={SEATS} onSave={vi.fn()} />);

    const handle = container.querySelector<HTMLElement>("[data-drag-handle='2']");

    expect(handle?.style.touchAction).toBe("none");

    const row = container.querySelector<HTMLElement>("[data-seat-row='2']");

    expect(row?.style.touchAction).toBe("");
    expect(container.querySelector<HTMLElement>("ol")?.style.touchAction).toBe("");
  });

  it("reorders on a pointer drag, which is the only kind a finger sends", () => {
    // `dragstart` never fires from a touch, and a touch is the whole platform.
    const { container } = render(<SeatOrderEditor seats={SEATS} onSave={vi.fn()} />);

    stubRows(container);

    const handle = container.querySelector<HTMLElement>("[data-drag-handle='1']");

    fireEvent.pointerDown(handle as HTMLElement, { pointerId: 1, clientY: 10 });
    fireEvent.pointerMove(handle as HTMLElement, { pointerId: 1, clientY: 95 });

    expect(names(container)).toEqual([ "2", "3", "1" ]);

    fireEvent.pointerUp(handle as HTMLElement, { pointerId: 1 });

    expect(container.querySelector("[data-dragging]")).toBeNull();
  });

  it("ignores a pointer move that never started on a handle", () => {
    const { container } = render(<SeatOrderEditor seats={SEATS} onSave={vi.fn()} />);

    stubRows(container);

    fireEvent.pointerMove(container.querySelector("[data-drag-handle='1']") as HTMLElement, { clientY: 95 });

    expect(names(container)).toEqual([ "1", "2", "3" ]);
  });

  it("writes an absolute permutation, so sending it twice lands on the same ring", async () => {
    const onSave = vi.fn();
    render(<SeatOrderEditor seats={SEATS} onSave={onSave} />);

    await userEvent.click(screen.getByLabelText("Move Carla up"));
    await userEvent.click(screen.getByText("Save the order"));

    expect(onSave).toHaveBeenCalledWith([ 1, 3, 2 ]);
  });

  it("offers nothing to save until something moved", async () => {
    render(<SeatOrderEditor seats={SEATS} onSave={vi.fn()} />);

    expect(screen.getByText("Save the order")).toBeDisabled();
    expect(screen.getByText("Undo")).toBeDisabled();

    await userEvent.click(screen.getByLabelText("Move Carla up"));

    expect(screen.getByText("Save the order")).toBeEnabled();
  });

  it("puts an edit back where it was on undo", async () => {
    const { container } = render(<SeatOrderEditor seats={SEATS} onSave={vi.fn()} />);

    await userEvent.click(screen.getByLabelText("Move Carla up"));
    await userEvent.click(screen.getByText("Undo"));

    expect(names(container)).toEqual([ "1", "2", "3" ]);
  });

  it("drops an edit that no longer applies when the roster changes underneath", async () => {
    const view = render(<SeatOrderEditor seats={SEATS} onSave={vi.fn()} />);

    await userEvent.click(screen.getByLabelText("Move Carla up"));

    expect(names(view.container)).toEqual([ "1", "3", "2" ]);

    // The order was saved from elsewhere, or a refusal replaced it. The editor
    // shows the table as it is, not an edit against a ring that has gone.
    view.rerender(<SeatOrderEditor seats={[ seat(3, "Carla"), seat(1, "Ana"), seat(2, "Bruno") ]} onSave={vi.fn()} />);

    expect(names(view.container)).toEqual([ "3", "1", "2" ]);
  });

  it("closes every control once the ring is fixed", () => {
    const { container } = render(<SeatOrderEditor seats={SEATS} onSave={vi.fn()} disabled />);

    expect(screen.getByLabelText("Move Bruno up")).toBeDisabled();
    expect(container.querySelector("[data-drag-handle='2']")).toBeDisabled();
  });

  it("holds the controls and says what came back while a save is in flight", async () => {
    const { container } = render(<SeatOrderEditor seats={SEATS} saving error="It moved on." onSave={vi.fn()} />);

    stubRows(container);

    expect(screen.getByText("Saving…")).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("It moved on.");

    const handle = container.querySelector<HTMLElement>("[data-drag-handle='1']");

    fireEvent.pointerDown(handle as HTMLElement, { pointerId: 1, clientY: 10 });
    fireEvent.pointerMove(handle as HTMLElement, { pointerId: 1, clientY: 95 });

    expect(names(container)).toEqual([ "1", "2", "3" ]);
  });

  it("names a seat with no nickname by its number", () => {
    render(<SeatOrderEditor seats={[ seat(1, "Ana"), seat(9, "") ]} onSave={vi.fn()} />);

    expect(screen.getByLabelText("Move seat 9 up")).toBeInTheDocument();
    expect(screen.getByText("Seat 9")).toBeInTheDocument();
  });
});
