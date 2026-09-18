import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RoomSettingsForm } from "./RoomSettingsForm";
import type { RoomConfigSpec } from "@/domains/game/types";

/**
 * The spec below is invented, and that is the assertion: the form is generated,
 * so it renders a declaration it has never seen before. Nothing in the component
 * names a key, a kind of content or a number of boxes.
 */

afterEach(cleanup);

const SPEC: RoomConfigSpec = {
  rule_set_id: "some.ruleset",
  fields: [
    { key: "some.text", kind: "text", label: "Some text", default: "A default.", max_length: 12, options: [] },
    { key: "some.toggle", kind: "toggle", label: "Some toggle", default: true, max_length: null, options: [] },
    {
      key: "some.choice",
      kind: "choice",
      label: "Some choice",
      default: "one",
      max_length: null,
      options: [ "one", "two" ],
    },
  ],
};

describe("the generated settings form", () => {
  it("renders one box per declared field, with the label the spec declared", () => {
    const { container } = render(<RoomSettingsForm spec={SPEC} roomConfig={{}} onSave={vi.fn()} />);

    expect(container.querySelectorAll("[data-setting]")).toHaveLength(3);
    expect(screen.getByLabelText("Some text")).toBeInTheDocument();
    expect(screen.getByLabelText("Some toggle")).toBeInTheDocument();
    expect(screen.getByLabelText("Some choice")).toBeInTheDocument();
  });

  it("renders a field this build has never seen as text it cannot edit", () => {
    // Guessing at a control would submit a value of the wrong type, which comes
    // back refused by name.
    const future: RoomConfigSpec = {
      rule_set_id: "some.ruleset",
      fields: [
        {
          key: "some.slider",
          kind: "slider",
          label: "Some slider",
          default: "3",
          max_length: null,
          options: [],
        } as unknown as RoomConfigSpec["fields"][number],
      ],
    };

    const { container } = render(<RoomSettingsForm spec={future} roomConfig={{}} onSave={vi.fn()} />);

    expect(container.querySelectorAll("input, textarea, select")).toHaveLength(0);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("opens with what the table saved and falls back to the declared default", () => {
    render(<RoomSettingsForm spec={SPEC} roomConfig={{ "some.text": "saved" }} onSave={vi.fn()} />);

    expect(screen.getByLabelText("Some text")).toHaveValue("saved");
    expect(screen.getByLabelText("Some choice")).toHaveValue("one");
    expect(screen.getByLabelText("Some toggle")).toBeChecked();
  });

  it("offers only the options the declaration lists", () => {
    render(<RoomSettingsForm spec={SPEC} roomConfig={{}} onSave={vi.fn()} />);

    const options = Array.from(screen.getByLabelText("Some choice").querySelectorAll("option"));

    expect(options.map((option) => option.getAttribute("value"))).toEqual([ "one", "two" ]);
  });

  it("caps the text at the length the declaration carries", () => {
    // The cap travels in the spec so that the box and the validator apply the
    // same number from the same source.
    render(<RoomSettingsForm spec={SPEC} roomConfig={{}} onSave={vi.fn()} />);

    expect(screen.getByLabelText("Some text")).toHaveAttribute("maxlength", "12");
    expect(screen.getByText("10/12")).toBeInTheDocument();
  });

  it("submits every declared key, flat and dotted, exactly as declared", async () => {
    const onSave = vi.fn();

    render(<RoomSettingsForm spec={SPEC} roomConfig={{}} onSave={onSave} />);

    await userEvent.clear(screen.getByLabelText("Some text"));
    await userEvent.type(screen.getByLabelText("Some text"), "new words");
    await userEvent.click(screen.getByLabelText("Some toggle"));
    await userEvent.selectOptions(screen.getByLabelText("Some choice"), "two");
    await userEvent.click(screen.getByText("Save the settings"));

    expect(onSave).toHaveBeenCalledWith({
      "some.text": "new words",
      "some.toggle": false,
      "some.choice": "two",
    });
  });

  it("accepts an empty text, which is the table saying this one does nothing", async () => {
    const onSave = vi.fn();

    render(<RoomSettingsForm spec={SPEC} roomConfig={{ "some.text": "something" }} onSave={onSave} />);

    await userEvent.clear(screen.getByLabelText("Some text"));
    await userEvent.click(screen.getByText("Save the settings"));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ "some.text": "" }));
  });

  it("opens with the declared default rather than a saved value it would refuse", () => {
    // The writer is conservative and the stored row is history, so a value the
    // declaration no longer takes is not shown as if it were editable.
    render(<RoomSettingsForm spec={SPEC} roomConfig={{ "some.text": "far too long for this one" }} onSave={vi.fn()} />);

    expect(screen.getByLabelText("Some text")).toHaveValue("A default.");
  });

  it("refuses to save a value the declaration would not take, and says why", async () => {
    const onSave = vi.fn();

    render(<RoomSettingsForm spec={SPEC} roomConfig={{}} onSave={onSave} />);

    const box = screen.getByLabelText("Some text");

    await userEvent.clear(box);

    // A line break inside a phrase painted across a television breaks the
    // layout, and it is the same refusal the server would answer with.
    await userEvent.type(box, "one{enter}two");

    expect(screen.getByRole("alert")).toHaveTextContent("Keep it to one line, with no invisible characters.");

    await userEvent.click(screen.getByText("Save the settings"));

    expect(onSave).not.toHaveBeenCalled();
  });

  it("closes every box and the button once the settings are frozen", () => {
    render(<RoomSettingsForm spec={SPEC} roomConfig={{}} onSave={vi.fn()} disabled />);

    expect(screen.getByLabelText("Some text")).toBeDisabled();
    expect(screen.getByLabelText("Some toggle")).toBeDisabled();
    expect(screen.getByLabelText("Some choice")).toBeDisabled();
    expect(screen.getByText("Save the settings")).toBeDisabled();
  });

  it("holds the button while a save is in flight and shows what came back", () => {
    render(<RoomSettingsForm spec={SPEC} roomConfig={{}} onSave={vi.fn()} saving error="It moved on." />);

    expect(screen.getByText("Saving…")).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("It moved on.");
  });

  it("renders what somebody typed as text and never as markup", () => {
    const injected = "<b>x</b>";
    const { container } = render(
      <RoomSettingsForm spec={SPEC} roomConfig={{ "some.text": injected }} onSave={vi.fn()} />,
    );

    expect(container.querySelector("b")).toBeNull();
    expect(screen.getByLabelText("Some text")).toHaveValue(injected);
  });
});
