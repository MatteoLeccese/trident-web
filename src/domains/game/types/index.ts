/**
 * The contract between the two apps, typed from what
 * `Src\Game\Domain\Model\GameSnapshot::toArray()` emits.
 *
 * Nothing here names a challenge, a role, a stage or a face: a `stage` is an
 * opaque string the RuleSet owns, a role is an opaque machine token, and a
 * settings key addresses a flat dotted space the backend declares. The screens
 * paint what the snapshot carries; they never work out who an effect is
 * addressed to.
 */

/**
 * Statuses the game framework knows about. The RuleSet's `stage` is separate and
 * is never one of these.
 *
 * `awaiting_choice` is live and not terminal: the game is parked on a question a
 * named seat has to answer, the channel is still open and the code still works.
 */
export type GameStatus = "lobby" | "running" | "awaiting_choice" | "finished" | "abandoned";

export interface Seat {
  seat: number;

  nickname: string;

  /** Opaque machine tokens the framework does not interpret. */
  roles: string[];
}

/**
 * One position of the pool, 1-based and never renumbered: a taken position is
 * marked and never removed, so a stale phone that taps position 7 cannot end up
 * drawing a different tile.
 *
 * Five keys, all of them always present: the projection promises an explicit
 * null and never an absent key.
 */
export interface PoolPosition {
  position: number;

  /**
   * The two-character face string of the tile, or null while the stage keeps
   * this position's face unpublished. Null explicit, never an absent key.
   */
  tile: string | null;

  taken: boolean;

  /**
   * The seat the position is attributed to, and null while nobody has taken it.
   *
   * It is non-null exactly when `taken` is true. A position carrying a face that
   * nobody has taken — a board the stage publishes open — carries a null seat,
   * so the badge is a record of a draw and never of a face.
   */
  seat: number | null;

  /**
   * Whether the position is still laid out on the board.
   *
   * A framework flag the projection resolves per position, and the whole of this
   * client's contract with the setting behind it: the table's choice is read,
   * named and turned into this boolean on the server, so no screen composes a
   * settings key or knows that the answer depends on the stage.
   *
   * False only on a position already taken, and the entry then still carries its
   * face and its seat: what changes is what the board draws and never what the
   * snapshot knows.
   */
  on_board: boolean;
}

/**
 * The draw that was last made, or null before any tile has been turned over.
 *
 * It exists because the pool stops being a record of it: a draw that ends a
 * stage arrives with the next stage's fresh pool in the same snapshot, so the
 * position that was just turned over comes back untaken and face down. This is
 * the field a screen reads the face of the tile just drawn from.
 */
export interface LastDraw {
  position: number;

  /** The two-character face string. A drawn tile always has one. */
  tile: string;

  /** The seat the draw is attributed to. */
  seat: number;
}

/** The scalars a settings value or an announcement parameter can be. */
export type ConfigValue = string | number | boolean;

/**
 * Copy the application ships: trusted, translatable, parameterised.
 *
 * An announcement with no parameters arrives with `params` as `[]`, which is how
 * PHP encodes an empty map. It is read through `paramsOf` in
 * `@/domains/game/utils/effects`, which answers an empty map either way, and
 * never off this field directly.
 */
export interface AnnounceEffect {
  kind: "announce";
  message_key: string;
  params: Record<string, ConfigValue>;
}

/** Gives a seat an opaque role string. The seat is always present here. */
export interface AssignRoleEffect {
  kind: "assign_role";
  seat: number;
  role: string;
}

/**
 * Copy the table wrote, addressed by a settings key and never carried as text.
 *
 * `seat` is the **recipient** and never the author: who drew the tile is the
 * move's actor, and a null seat addresses the whole table. That field is why no
 * screen has to know which seat a given face belongs to.
 */
export interface ChallengeEffect {
  kind: "challenge";
  seat: number | null;
  config_key: string;
}

/**
 * An effect of a kind this build does not know.
 *
 * A ruleset may declare one, and a screen that met it must stay on the air: the
 * union carries this member so an unknown kind is a value the code can hold and
 * skip, not a crash or a blank television.
 */
export interface UnknownEffect {
  kind: string;
  [field: string]: unknown;
}

/**
 * The seam's whole output for the write this version came from.
 *
 * It narrows through the guards in `@/domains/game/utils/effects`, not through
 * `switch (effect.kind)`: the neutral member accepts any `kind`, so a bare
 * comparison would not exclude it.
 */
export type Effect = AnnounceEffect | AssignRoleEffect | ChallengeEffect | UnknownEffect;

/**
 * The frozen settings of the table, flat and already resolved with the ruleset's
 * defaults. Every declared key is present, so the client applies no defaults of
 * its own: a phone and a television on different bundles could otherwise
 * disagree about what the table wrote.
 */
export type RoomConfig = Record<string, ConfigValue>;

/**
 * The system's single state shape: exactly what `GET /games/{id}` returns and
 * what arrives over the socket. If the two differ, there is a test in the
 * backend that fails.
 *
 * It is a **full snapshot and never a delta**, which is what makes a lost frame
 * heal itself.
 */
export interface GameState {
  game_id: string;

  version: number;

  status: GameStatus;

  /** Null once the game is over: a finished game releases its code. */
  join_code: string | null;

  /**
   * An opaque string the RuleSet owns, or null before the game starts. No screen
   * branches on its value; it paints its label.
   */
  stage: string | null;

  /** The one seat that acts, or null before play begins. */
  current_seat: number | null;

  seats: Seat[];

  /** Empty until the game starts, and then one entry per position of the stage's pool. */
  pool: PoolPosition[];

  /**
   * The draw this version or an earlier one made, and the only place the face of
   * the tile just drawn can be read: `pool` is replaced wholesale when a stage
   * ends, in the same snapshot as the draw that ended it.
   */
  last_draw: LastDraw | null;

  /**
   * What the rules asked the table to do on **this** version, in the order the
   * ruleset emitted them. It is not a delta to accumulate: a version that
   * consulted no rule — a rename — carries an empty list, and a frame that is
   * lost takes its effects with it while the state still converges.
   */
  effects: Effect[];

  room_config: RoomConfig;

  /**
   * A deployment value and not the table's choice, which is why it sits outside
   * `room_config`: minutes of silence after which the watch screen says the game
   * looks abandoned.
   */
  tv_idle_notice_minutes: number;

  last_activity_at: string;
}

/** One declared setting, as the lobby form is generated from it. */
export interface RoomConfigField {

  /** The flat dotted key: the same string in the spec, the saved blob, `room_config` and an effect. */
  key: string;

  kind: "text" | "toggle" | "choice";

  label: string;

  default: ConfigValue;

  /** The cap the form applies and the backend enforces, or null where length does not apply. */
  max_length: number | null;

  /** The closed list a `choice` accepts, and empty for every other kind. */
  options: string[];
}

/**
 * What `GET /games/{id}/room-config-spec` returns.
 *
 * The lobby form is **generated** from `fields` and never hand-wired: a screen
 * that listed the settings keys would be a client naming a rule.
 */
export interface RoomConfigSpec {
  rule_set_id: string;
  fields: RoomConfigField[];
}

/** What the BFF returns on create: the token never reaches this far. */
export interface CreatedGame {
  game: GameState;
}

export type ViewerRole = "controller" | "spectator";
