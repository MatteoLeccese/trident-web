import { describe, expect, it } from "vitest";
import type { GameState } from "@/domains/game/types";
import { isGameState } from "./isGameState";

function snapshot (overrides: Partial<GameState> = {}): GameState {
  return {
    game_id: "0f8fad5b-d9cb-469f-a165-70867728950e",
    version: 12,
    status: "running",
    join_code: "K7QP3M",
    stage: "stage-one",
    current_seat: 2,
    seats: [ { seat: 1, nickname: "Ana", roles: [] }, { seat: 2, nickname: "Bea", roles: [ "some_role" ] } ],
    pool: [
      { position: 1, tile: "21", taken: true, seat: 3, on_board: true },
      { position: 2, tile: null, taken: false, seat: null, on_board: true },
    ],
    last_draw: { position: 1, tile: "21", seat: 1 },
    effects: [ { kind: "challenge", seat: 2, config_key: "some.setting" } ],
    room_config: { "setting.one": "Say something", "setting.two": "keep" },
    tv_idle_notice_minutes: 10,
    last_activity_at: "2026-09-16T20:00:00+00:00",
    ...overrides,
  };
}

describe("isGameState", () => {
  it("accepts the payload the backend projects", () => {
    expect(isGameState(snapshot())).toBe(true);
  });

  it("accepts the nulls the projection promises are explicit", () => {
    // Null and never an absent key: a key that is sometimes there is a contract
    // nobody can type.
    expect(isGameState(snapshot({ join_code: null, stage: null, current_seat: null }))).toBe(true);
    expect(isGameState(snapshot({ pool: [], effects: [], room_config: {} }))).toBe(true);
    expect(isGameState(snapshot({ last_draw: null }))).toBe(true);
  });

  it("refuses a last draw that does not name a face", () => {
    // It is the only record of the tile just turned over once a stage has ended,
    // so a malformed one must not be applied as though it were one.
    for (const broken of [
      { position: 1, seat: 1 },
      { position: 1, tile: "", seat: 1 },
      { position: 0, tile: "21", seat: 1 },
      { position: 1, tile: "21", seat: 0 },
      { position: 1, tile: 21, seat: 1 },
      [],
    ]) {
      expect(isGameState({ ...snapshot(), last_draw: broken })).toBe(false);
    }
  });

  it("refuses a payload with no last draw key at all", () => {
    // Null explicit, never an absent key: a key that is sometimes there is a
    // contract nobody can type.
    const withoutIt: Record<string, unknown> = { ...snapshot() };

    delete withoutIt.last_draw;

    expect(isGameState(withoutIt)).toBe(false);
  });

  it("accepts every status the framework can be in", () => {
    for (const status of [ "lobby", "running", "awaiting_choice", "finished", "abandoned" ] as const) {
      expect(isGameState(snapshot({ status }))).toBe(true);
    }
  });

  it("refuses a status the framework does not have", () => {
    // Unlike an effect's kind, a status is framework state and no ruleset can
    // add one, so an unknown value here is a broken payload and not a newer one.
    expect(isGameState({ ...snapshot(), status: "paused" })).toBe(false);
  });

  it("carries an effect of a kind this build does not know", () => {
    // The neutral fallback reaches all the way out here: one unknown effect must
    // not make a whole snapshot unusable.
    expect(isGameState(snapshot({ effects: [ { kind: "some_future_kind", extra: 1 } ] }))).toBe(true);
  });

  it("ignores fields it does not read, so a newer backend does not blank a screen", () => {
    expect(isGameState({ ...snapshot(), something_new: [ 1, 2, 3 ] })).toBe(true);
  });

  it("refuses anything that is not a snapshot", () => {
    for (const rubbish of [ null, undefined, 0, "", "ok", [], {}, [ snapshot() ] ]) {
      expect(isGameState(rubbish)).toBe(false);
    }
  });

  it("refuses a payload whose identity or version is missing or wrong", () => {
    // These two are what the version guard runs on. Nothing else is worth
    // checking if they are not there.
    expect(isGameState({ ...snapshot(), game_id: "" })).toBe(false);
    expect(isGameState({ ...snapshot(), game_id: 7 })).toBe(false);
    expect(isGameState({ ...snapshot(), version: 0 })).toBe(false);
    expect(isGameState({ ...snapshot(), version: 1.5 })).toBe(false);
    expect(isGameState({ ...snapshot(), version: "12" })).toBe(false);
  });

  it("refuses a malformed board, a malformed roster and a nested settings map", () => {
    expect(isGameState({ ...snapshot(), seats: [ { seat: 1, nickname: "Ana" } ] })).toBe(false);
    expect(isGameState({ ...snapshot(), pool: [ { position: 1, tile: "21" } ] })).toBe(false);
    expect(isGameState({ ...snapshot(), pool: [ { position: 0, tile: null, taken: false, seat: null, on_board: true } ] })).toBe(false);
    // The settings space is flat: never nested objects.
    expect(isGameState({ ...snapshot(), room_config: { group: { key: "value" } } })).toBe(false);
    expect(isGameState({ ...snapshot(), effects: [ "challenge" ] })).toBe(false);
  });

  it("accepts a board with a tile taken off it, face, taker and all", () => {
    // Taking a tile off the board changes what a screen draws and nothing the
    // snapshot knows: the entry still carries its face and its taker.
    expect(isGameState({
      ...snapshot(),
      pool: [ { position: 1, tile: "21", taken: true, seat: 3, on_board: false } ],
    })).toBe(true);
  });

  it("refuses a board position that does not say who took it or whether it is there", () => {
    // Both are fields the board reads, and neither is defaulted on this side: a
    // client inventing one is a phone and a television inventing separately.
    for (const broken of [
      { position: 1, tile: "21", taken: true, on_board: true },
      { position: 1, tile: "21", taken: true, seat: 3 },
      { position: 1, tile: "21", taken: true, seat: 0, on_board: true },
      { position: 1, tile: "21", taken: true, seat: "3", on_board: true },
      { position: 1, tile: "21", taken: true, seat: 3, on_board: "yes" },
    ]) {
      expect(isGameState({ ...snapshot(), pool: [ broken ] })).toBe(false);
    }
  });

  it("refuses an empty settings map delivered as an array", () => {
    // PHP encodes an empty map as `[]` unless it is cast, and the backend casts
    // it. If that ever regressed, the client would type a map and get a list.
    expect(isGameState({ ...snapshot(), room_config: [] })).toBe(false);
  });
});
