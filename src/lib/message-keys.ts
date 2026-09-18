import type { ConfigValue } from "@/domains/game/types";

/**
 * Copy the application ships, addressed by key.
 *
 * An `announce` effect carries a key and its parameters, never a sentence, for
 * the same reason a challenge does: the words belong to whoever paints them. The
 * difference is whose words they are — an announcement is the application's, so
 * it is translatable and lives here, while a challenge is the table's and lives
 * in the room settings.
 *
 * **The catalogue is deliberately empty.** The shipped ruleset emits no
 * announcements at all (TR-50): every moment worth painting is already an effect
 * the screens resolve. Writing entries for keys nothing emits would be inventing
 * content and guessing at parameters nobody sends. A ruleset that starts
 * emitting them adds its keys here, and until then an announcement resolves to
 * null and paints nothing, which is the neutral path every unknown effect takes.
 */
const MESSAGES: Record<string, string> = {};

const PLACEHOLDER = /\{([a-z0-9_.]+)\}/gi;

/**
 * The sentence for a key with its parameters substituted, or null when this
 * build has no copy for it.
 *
 * A parameter the template names but the effect did not send is left as it was
 * written, so a half-filled sentence is visible as a defect instead of reading
 * as a finished phrase with a hole in it.
 */
export function formatMessage (key: string, params: Record<string, ConfigValue>): string | null {
  // `hasOwn` and not a truthiness check: a bare lookup answers `toString` with a
  // function off the prototype, and a key arrives from the wire.
  if (!Object.hasOwn(MESSAGES, key)) {
    return null;
  }

  const template = MESSAGES[key];

  return template.replace(PLACEHOLDER, (whole, name: string) => {
    const value = params[name];

    return value === undefined ? whole : String(value);
  });
}
