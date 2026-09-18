import type { ConfigValue, RoomConfig, RoomConfigField, RoomConfigSpec } from "@/domains/game/types";

/**
 * The lobby form, as values and refusals over a declaration the client never
 * wrote.
 *
 * Every box on screen comes from a `RoomConfigField` the ruleset declared, so
 * this file names no settings key, no kind of content and no number of boxes: it
 * reads `kind`, `max_length` and `options` and nothing else. A ruleset that
 * declares an eighth setting tomorrow gets an eighth box for free.
 *
 * The checks below mirror `RoomConfigField::accepts()` exactly, and they mirror
 * it rather than replace it: the backend refuses the same values with a 422
 * naming the key. Checking here is what turns "saving failed" into a box with a
 * message under it while the person is still looking at what they typed.
 */

export type FormValues = Record<string, ConfigValue>;

/**
 * Control characters are refused, combining marks are not.
 *
 * This runs on a home LAN between friends: the guard exists because a line break
 * inside a phrase painted across a television breaks the layout, not because of
 * an adversary. Refusing combining marks would refuse legitimate Hebrew, Arabic
 * and Indic text and buy nothing.
 */
const CONTROL_CHARACTERS = /\p{C}/u;

/** Code points, the unit `mb_strlen` counts, and not UTF-16 units. */
export function textLength (value: string): number {
  return [ ...value ].length;
}

/**
 * What the form opens with: the value the table saved, or the declared default
 * where it saved nothing.
 *
 * The default comes from the spec and never from this bundle. A client that
 * carried its own would let a phone and a television disagree about what the
 * table wrote.
 */
export function initialValues (spec: RoomConfigSpec, saved: RoomConfig): FormValues {
  const values: FormValues = {};

  for (const field of spec.fields) {
    const stored = saved[field.key];

    values[field.key] = accepts(field, stored) ? stored : field.default;
  }

  return values;
}

export function accepts (field: RoomConfigField, value: unknown): value is ConfigValue {
  switch (field.kind) {
    case "text":
      return typeof value === "string"
        && !CONTROL_CHARACTERS.test(value)
        && (field.max_length === null || textLength(value) <= field.max_length);

    case "toggle":
      return typeof value === "boolean";

    case "choice":
      return typeof value === "string" && field.options.includes(value);

    default:

      // A kind this build has never heard of is carried and never submitted as
      // something else. The screen paints it read-only rather than guessing.
      return false;
  }
}

/**
 * Why a value would be refused, in words for the person who typed it, or null
 * when it would not be.
 */
export function fieldError (field: RoomConfigField, value: unknown): string | null {
  if (accepts(field, value)) {
    return null;
  }

  if (field.kind === "text" && typeof value === "string") {
    if (CONTROL_CHARACTERS.test(value)) {
      return "Keep it to one line, with no invisible characters.";
    }

    if (field.max_length !== null) {
      return `Keep it to ${field.max_length} characters.`;
    }
  }

  if (field.kind === "choice") {
    return "Pick one of the options.";
  }

  return "This game does not take that value.";
}

/** Every refusal the form has, keyed the way the backend would key them. */
export function formErrors (spec: RoomConfigSpec, values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of spec.fields) {
    const error = fieldError(field, values[field.key]);

    if (error !== null) {
      errors[field.key] = error;
    }
  }

  return errors;
}

/**
 * What is sent: every declared key, with what the form holds.
 *
 * Only declared keys travel. A key the spec dropped stays in the saved blob
 * untouched — the writer is conservative and a stored row is history — while
 * submitting it again would come back 422 naming a key nobody can see.
 */
export function submittableValues (spec: RoomConfigSpec, values: FormValues): FormValues {
  const submitted: FormValues = {};

  for (const field of spec.fields) {
    const value = values[field.key];

    submitted[field.key] = accepts(field, value) ? value : field.default;
  }

  return submitted;
}
