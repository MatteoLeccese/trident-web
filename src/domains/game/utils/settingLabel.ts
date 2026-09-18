import type { RoomConfigSpec } from "@/domains/game/types";

/**
 * The name the ruleset declares for a settings key, or null when there is none
 * to paint.
 *
 * A screen may not work the name out of the key itself. The flat dotted key
 * space belongs to the ruleset, and taking the noun out of one of its keys would
 * be a client reading a rule off a setting — the exact thing the declaration
 * exists to make unnecessary. The label travels with the declaration, and a
 * screen that wants one asks for it.
 *
 * Null covers not having the declaration at all, which is an ordinary state and
 * never an error: the spec is a request of its own, so a screen still waiting
 * for it, or whose request failed, paints the card untitled rather than
 * inventing a title.
 */
export function settingLabel (spec: RoomConfigSpec | null, key: string): string | null {
  if (spec === null) {
    return null;
  }

  const label = spec.fields.find((field) => field.key === key)?.label;

  return label === undefined || label.trim() === "" ? null : label.trim();
}
