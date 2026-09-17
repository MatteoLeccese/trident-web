/** Statuses the game framework knows about. The RuleSet's `stage` is separate. */
export type GameStatus = "lobby" | "running" | "finished" | "abandoned";

export interface Seat {
  seat: number;
  nickname: string;
  roles: string[];
}

/**
 * The system's single state shape: exactly what `GET /games/{id}` returns and
 * what arrives over the socket. If the two differ, there is a test in the
 * backend that fails.
 */
export interface GameState {
  game_id: string;
  version: number;
  status: GameStatus;

  /** Null once the game is over: a finished game releases its code. */
  join_code: string | null;
  seats: Seat[];
  last_activity_at: string;
}

/** What the BFF returns on create: the token never reaches this far. */
export interface CreatedGame {
  game: GameState;
}

export type ViewerRole = "controller" | "spectator";
