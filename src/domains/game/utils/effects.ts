import type {
  AnnounceEffect,
  AssignRoleEffect,
  ChallengeEffect,
  ConfigValue,
  Effect,
} from "@/domains/game/types";

/**
 * The runtime side of the `Effect` union.
 *
 * A screen narrows an effect through these and never through
 * `switch (effect.kind)`: the union's neutral member accepts any `kind`, so a
 * bare comparison would not exclude it and the narrowing would be a lie.
 *
 * Each guard checks the **whole shape** and not only the discriminator, so an
 * effect of a known kind that arrives malformed falls through to the same
 * neutral path as one of a kind this build has never heard of. A ruleset may
 * declare a kind this bundle does not know, and the television must keep
 * painting either way.
 */

function isRecord (value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isConfigValue (value: unknown): value is ConfigValue {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function isSeatNumber (value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

/**
 * An announcement's parameters, or null when the value is not a parameter map.
 *
 * An announcement with no parameters arrives as `[]`: that is how PHP encodes an
 * empty map, and the backend's `Effect` says so. Read as an object it is the
 * commonest announcement there is — one with nothing to interpolate — so a guard
 * that insisted on an object would classify it as unknown and both screens would
 * drop it with nothing logged.
 */
function announceParams (value: unknown): Record<string, ConfigValue> | null {
  if (Array.isArray(value)) {
    return value.length === 0 ? {} : null;
  }

  if (!isRecord(value)) {
    return null;
  }

  return Object.values(value).every(isConfigValue) ? value as Record<string, ConfigValue> : null;
}

export function isAnnounceEffect (effect: Effect): effect is AnnounceEffect {
  return effect.kind === "announce"
    && typeof (effect as AnnounceEffect).message_key === "string"
    && announceParams((effect as AnnounceEffect).params) !== null;
}

/**
 * The parameters to interpolate, as a map whatever the wire carried. Empty for an
 * announcement that has none.
 */
export function paramsOf (effect: AnnounceEffect): Record<string, ConfigValue> {
  return announceParams(effect.params) ?? {};
}

export function isAssignRoleEffect (effect: Effect): effect is AssignRoleEffect {
  return effect.kind === "assign_role"
    && isSeatNumber((effect as AssignRoleEffect).seat)
    && typeof (effect as AssignRoleEffect).role === "string";
}

export function isChallengeEffect (effect: Effect): effect is ChallengeEffect {
  const seat: unknown = (effect as ChallengeEffect).seat;

  return effect.kind === "challenge"
    && (seat === null || isSeatNumber(seat))
    && typeof (effect as ChallengeEffect).config_key === "string";
}

/**
 * Whether this build can paint the effect at all. Everything else is carried,
 * skipped and never thrown away in a way that blanks the screen.
 */
export function isKnownEffect (effect: Effect): boolean {
  return isAnnounceEffect(effect) || isAssignRoleEffect(effect) || isChallengeEffect(effect);
}

/**
 * The effects of one version that this build can paint, in the order the ruleset
 * emitted them.
 */
export function paintableEffects (effects: Effect[]): Effect[] {
  return effects.filter(isKnownEffect);
}

/** Whether a raw value from the wire has the minimum shape of an effect. */
export function isEffect (value: unknown): value is Effect {
  return isRecord(value) && typeof value.kind === "string" && value.kind !== "";
}
