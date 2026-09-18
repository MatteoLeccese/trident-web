import { describe, expect, it } from "vitest";
import type { GameState } from "@/domains/game/types";
import { applyGameState } from "./applyGameState";

/**
 * The whole payload and not a corner of it: the guard swaps snapshots, so a test
 * built on a narrow fixture would pass while a field silently survived a swap.
 */
function state (version: number, nickname = "Ana", overrides: Partial<GameState> = {}): GameState {
  return {
    game_id: "0f8fad5b-d9cb-469f-a165-70867728950e",
    version,
    status: "lobby",
    join_code: "K7QP3M",
    stage: null,
    current_seat: null,
    seats: [
      { seat: 1, nickname, roles: [] },
      { seat: 2, nickname: "Bea", roles: [] },
      { seat: 3, nickname: "Caro", roles: [] },
    ],
    pool: [],
    last_draw: null,
    effects: [],
    // Opaque on purpose: nothing in the client reads a settings key.
    room_config: { "setting.one": "Say something" },
    tv_idle_notice_minutes: 10,
    last_activity_at: "2026-09-16T20:00:00+00:00",
    ...overrides,
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

    /*
     * The two fixtures have to differ in something other than the version, or
     * the assertion holds whichever of them comes back and the "or equal" half
     * of the rule is pinned by nothing. The nickname is what tells them apart,
     * and the identity check says which object survived.
     */
    const current = state(47, "Anita");
    const result = applyGameState(current, state(47, "Ana"));

    expect(result.state.version).toBe(47);
    expect(result.state.seats[0].nickname).toBe("Anita");
    expect(result.state).toBe(current);
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
  it("replaces the effects of a version instead of accumulating them", () => {
    // `effects` belongs to the version it arrived with, exactly like the board.
    // A client that appended them would grow a log of everything it ever saw and
    // paint a challenge twice after any resync.
    const current = state(47, "Ana", {
      effects: [ { kind: "challenge", seat: 1, config_key: "setting.one" } ],
    });
    const incoming = state(48, "Ana", {
      effects: [ { kind: "challenge", seat: 2, config_key: "setting.two" } ],
    });

    const result = applyGameState(current, incoming);

    expect(result.state.effects).toEqual(incoming.effects);
  });

  it("carries the whole board across, and merges nothing from the state it replaced", () => {
    const current = state(47, "Ana", {
      status: "running",
      stage: "stage-one",
      current_seat: 1,
      pool: [
        { position: 1, tile: "33", taken: true, seat: 1, on_board: true },
        { position: 2, tile: null, taken: false, seat: null, on_board: true },
      ],
      room_config: { "setting.one": "Old" },
    });
    const incoming = state(48, "Ana", {
      status: "running",
      stage: "stage-two",
      current_seat: 2,
      pool: [ { position: 1, tile: null, taken: false, seat: null, on_board: true } ],
      room_config: { "setting.two": "New" },
    });

    const result = applyGameState(current, incoming);

    expect(result.state.stage).toBe("stage-two");
    expect(result.state.current_seat).toBe(2);
    expect(result.state.pool).toEqual(incoming.pool);
    expect(result.state.room_config).toEqual({ "setting.two": "New" });
  });

  it("drops the effects of a frame it discards, and keeps converging on state", () => {
    // A frame that arrives late loses its effects, like the tile that was face
    // up on the table while nobody was looking. The state is what has to
    // converge, and it does.
    const current = state(48, "Anita", { effects: [] });
    const late = state(47, "Ana", {
      effects: [ { kind: "assign_role", seat: 1, role: "some_role" } ],
    });

    const result = applyGameState(current, late);

    expect(result.state.effects).toEqual([]);
    expect(result.state.version).toBe(48);
  });

  it("applies a refusal's snapshot, which is how a stale phone heals", () => {
    // `422 game_version_conflict` answers with the current state. It is newer
    // than what the phone holds, so the same guard that accepts a socket frame
    // accepts it: there is no second code path for recovery.
    const stale = state(47);
    const refusalPayload = state(49, "Anita");

    const result = applyGameState(stale, refusalPayload);

    expect(result.state.version).toBe(49);
    expect(result.needsResync).toBe(true);
  });

  it("is unchanged by the size of the payload: the gap rule is the version and nothing else", () => {
    const current = state(47);
    const incoming = state(48, "Ana", {
      pool: Array.from({ length: 49 }, (_unused, index) => ({
        position: index + 1,
        tile: null,
        taken: false,
        seat: null,
        on_board: true,
      })),
    });

    const result = applyGameState(current, incoming);

    expect(result.state.pool).toHaveLength(49);
    expect(result.needsResync).toBe(false);
  });
});
