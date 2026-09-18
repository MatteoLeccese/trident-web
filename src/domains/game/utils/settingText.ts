import type { RoomConfig } from "@/domains/game/types";

/**
 * The text a settings key resolves to, or null when there is nothing to paint.
 *
 * An effect carries the key and never the text (TR-42), and the flat dotted key
 * space is what makes this one lookup instead of a walk over a tree whose shape
 * the client does not know.
 *
 * Null covers three cases that a screen answers the same way — it paints no card:
 *
 *  - the key is absent, which a client must never fill in with a default of its
 *    own, or a phone and a television on different bundles would disagree about
 *    what the table wrote;
 *  - the value is empty, which the table is allowed to choose and means "this one
 *    does nothing";
 *  - the value is not text at all, which is a settings key of another kind.
 */
export function settingText (config: RoomConfig, key: string): string | null {
  const value = config[key];

  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();

  return text === "" ? null : text;
}
