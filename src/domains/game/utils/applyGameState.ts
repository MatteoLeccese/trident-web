import type { GameState } from "@/domains/game/types";

export interface ApplyResult {
  state: GameState;
  needsResync: boolean;
}

/**
 * The client's rule for accepting state, as a pure function.
 *
 * Every payload is a **full snapshot**, not an increment, so applying a newer
 * one is always correct and a lost frame self-heals. That makes joining late,
 * reconnecting and the television waking up all the same case, exercised on
 * every page open and not in some rare branch.
 *
 * - older or equal → discarded (a frame that arrives late cannot make the
 *   television go backwards);
 * - exactly the next one → applied;
 * - a gap → applied **and** a resync is requested, in case something else is
 *   missing.
 */
export function applyGameState (current: GameState | null, incoming: GameState): ApplyResult {
  if (current === null) {
    return { state: incoming, needsResync: false };
  }

  // A wrongly subscribed channel cannot replace the game being watched.
  if (incoming.game_id !== current.game_id) {
    return { state: current, needsResync: true };
  }

  if (incoming.version <= current.version) {
    return { state: current, needsResync: false };
  }

  return {
    state: incoming,
    needsResync: incoming.version > current.version + 1,
  };
}
