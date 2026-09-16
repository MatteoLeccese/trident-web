import { describe, expect, it } from "vitest";
import type { GameState } from "@/domains/game/types";
import { applyGameState } from "./applyGameState";

function state (version: number, nickname = "Ana"): GameState {
  return {
    game_id: "0f8fad5b-d9cb-469f-a165-70867728950e",
    version,
    status: "lobby",
    join_code: "K7QP3M",
    seats: [
      { seat: 1, nickname, roles: [] },
      { seat: 2, nickname: "Bea", roles: [] },
      { seat: 3, nickname: "Caro", roles: [] },
    ],
    last_activity_at: "2026-09-16T20:00:00+00:00",
  };
}

describe("applyGameState", () => {
  it("accepts the first state it ever sees", () => {
    const result = applyGameState(null, state(47));

    expect(result.state.version).toBe(47);
    expect(result.needsResync).toBe(false);
  });

  it("applies the very next version", () => {
    const result = applyGameState(state(47), state(48, "Anita"));

    expect(result.state.version).toBe(48);
    expect(result.state.seats[0].nickname).toBe("Anita");
    expect(result.needsResync).toBe(false);
  });

  it("drops a payload that arrives out of order", () => {
    // An old frame arrives after a new one: if it were applied, the television
    // would go backwards and show a game that no longer exists.
    const result = applyGameState(state(48, "Anita"), state(47, "Ana"));

    expect(result.state.version).toBe(48);
    expect(result.state.seats[0].nickname).toBe("Anita");
    expect(result.needsResync).toBe(false);
  });

  it("drops a duplicate of the state it already has", () => {
    const result = applyGameState(state(47), state(47));

    expect(result.state.version).toBe(47);
    expect(result.needsResync).toBe(false);
  });

  it("applies a gap but asks for a resync", () => {
    // At least one frame was lost. It is applied — it is a full snapshot, so that
    // is correct — but a resync is requested in case something else is missing.
    const result = applyGameState(state(47), state(52, "Anita"));

    expect(result.state.version).toBe(52);
    expect(result.needsResync).toBe(true);
  });

  it("never returns a null state once it has one", () => {
    const current = state(48);

    expect(applyGameState(current, state(10)).state).toEqual(current);
  });

  it("treats a payload from another game as a gap, not as truth", () => {
    // A wrongly subscribed channel cannot replace the game being watched.
    const other = { ...state(99), game_id: "11111111-2222-3333-4444-555555555555" };

    const result = applyGameState(state(47), other);

    expect(result.state.game_id).toBe("0f8fad5b-d9cb-469f-a165-70867728950e");
    expect(result.needsResync).toBe(true);
  });
});
