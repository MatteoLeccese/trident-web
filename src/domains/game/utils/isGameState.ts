import type { ConfigValue, GameState, GameStatus, LastDraw, PoolPosition, Seat } from "@/domains/game/types";
import { isEffect } from "@/domains/game/utils/effects";

/**
 * Is this raw value a snapshot?
 *
 * Two payloads arrive typed by assertion and not by the compiler: a frame off
 * the socket, and the current state a refused write carries in `data`. The
 * second is the one that matters — a stale phone heals by **applying** that
 * body, so handing an unchecked object to the version guard would let one
 * malformed response replace the state of a table mid-game.
 *
 * It checks the fields the client reads and ignores anything else the payload
 * carries, so a backend that adds a field does not blank a screen.
 *
 * `status` is the one closed vocabulary it insists on. A status is framework
 * state and no ruleset can add one, unlike an effect's `kind`, which is exactly
 * why `Effect` has a neutral member and this does not.
 */

const STATUSES: readonly GameStatus[] = [
  "lobby",
  "running",
  "awaiting_choice",
  "finished",
  "abandoned",
];

function isRecord (value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount (value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function isNullableString (value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isConfigValue (value: unknown): value is ConfigValue {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function isSeat (value: unknown): value is Seat {
  return isRecord(value)
    && isCount(value.seat)
    && typeof value.nickname === "string"
    && Array.isArray(value.roles)
    && value.roles.every((role) => typeof role === "string");
}

function isLastDraw (value: unknown): value is LastDraw {
  return isRecord(value)
    && isCount(value.position)
    && typeof value.tile === "string"
    && value.tile !== ""
    && isCount(value.seat);
}

/*
 * The board reads all five keys of a pool entry, so all five are checked. `seat`
 * and `on_board` are not optional and are not defaulted here: a payload missing
 * one would leave the board inventing who filled it, or inventing whether the
 * table clears the tiles it draws, and a phone and a television inventing
 * separately is the disagreement the single projection exists to prevent.
 */
function isPoolPosition (value: unknown): value is PoolPosition {
  return isRecord(value)
    && isCount(value.position)
    && isNullableString(value.tile)
    && typeof value.taken === "boolean"
    && (value.seat === null || isCount(value.seat))
    && typeof value.on_board === "boolean";
}

export function isGameState (value: unknown): value is GameState {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.game_id === "string"
    && value.game_id !== ""
    && isCount(value.version)
    && typeof value.status === "string"
    && (STATUSES as readonly string[]).includes(value.status)
    && isNullableString(value.join_code)
    && isNullableString(value.stage)
    && (value.current_seat === null || isCount(value.current_seat))
    && Array.isArray(value.seats)
    && value.seats.every(isSeat)
    && Array.isArray(value.pool)
    && value.pool.every(isPoolPosition)
    && (value.last_draw === null || isLastDraw(value.last_draw))
    && Array.isArray(value.effects)
    && value.effects.every(isEffect)
    && isRecord(value.room_config)
    && Object.values(value.room_config).every(isConfigValue)
    && typeof value.tv_idle_notice_minutes === "number"
    && typeof value.last_activity_at === "string";
}
