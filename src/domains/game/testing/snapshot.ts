import type { Effect, GameState, LastDraw, PoolPosition, RoomConfig, Seat } from "@/domains/game/types";

/**
 * Snapshots for tests.
 *
 * Every value here is an **opaque placeholder**: no stage, no settings key, no
 * role and no face number that the real ruleset uses appears anywhere. The tests
 * passing with arbitrary strings is the evidence that nothing on the client
 * branches on one — stronger than a grep, because a branch would make them fail.
 */

export function seat (number: number, nickname: string, roles: string[] = []): Seat {
  return { seat: number, nickname, roles };
}

/** How a position that has been taken is projected, beyond its face. */
export interface TakenOptions {

  /**
   * The seat each taken position is attributed to, by position. A taken position
   * with no entry falls back to seat 1, because the projection never sends a
   * taken position without a taker.
   */
  takers?: Record<number, number>;

  /**
   * The positions the board no longer carries, which the projection resolves
   * from the table's setting before it reaches any screen. Every other taken
   * position stays on the board.
   */
  offBoard?: number[];
}

export function pool (size: number, taken: Record<number, string> = {}, options: TakenOptions = {}): PoolPosition[] {
  const cleared = new Set(options.offBoard ?? []);

  return Array.from({ length: size }, (_unused, index) => {
    const position = index + 1;
    const face = taken[position];

    return face === undefined
      ? { position, tile: null, taken: false, seat: null, on_board: true }
      : {
        position,
        tile: face,
        taken: true,
        seat: options.takers?.[position] ?? 1,
        on_board: !cleared.has(position),
      };
  });
}

interface Overrides {
  version?: number;
  status?: GameState["status"];
  currentSeat?: number | null;
  seats?: Seat[];
  pool?: PoolPosition[];
  lastDraw?: LastDraw | null;
  effects?: Effect[];
  roomConfig?: RoomConfig;
  joinCode?: string | null;
  stage?: string | null;
  tvIdleNoticeMinutes?: number;
  lastActivityAt?: string;
}

export function gameState (overrides: Overrides = {}): GameState {
  return {
    game_id: "00000000-0000-4000-8000-000000000001",
    version: overrides.version ?? 1,
    status: overrides.status ?? "running",
    join_code: overrides.joinCode === undefined ? "K7QP3M" : overrides.joinCode,
    stage: overrides.stage === undefined ? "stage-one" : overrides.stage,
    current_seat: overrides.currentSeat === undefined ? 1 : overrides.currentSeat,
    seats: overrides.seats ?? [ seat(1, "Ana"), seat(2, "Bruno"), seat(3, "Carla") ],
    pool: overrides.pool ?? pool(4),
    last_draw: overrides.lastDraw === undefined ? null : overrides.lastDraw,
    effects: overrides.effects ?? [],
    room_config: overrides.roomConfig ?? { "some.setting": "Do the thing." },
    tv_idle_notice_minutes: overrides.tvIdleNoticeMinutes ?? 10,
    last_activity_at: overrides.lastActivityAt ?? "2026-09-17T20:00:00+00:00",
  };
}
