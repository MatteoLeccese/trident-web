import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/domains/core/types/api-error";
import type { GameState } from "@/domains/game/types";
import { mutate, VERSION_CONFLICT, type Mutation, type WriteTransport } from "./writeProtocol";

function snapshot (version: number): GameState {
  return {
    game_id: "0f8fad5b-d9cb-469f-a165-70867728950e",
    version,
    status: "running",
    join_code: "K7QP3M",
    stage: "stage-one",
    current_seat: 1,
    seats: [ { seat: 1, nickname: "Ana", roles: [] } ],
    pool: [ { position: 1, tile: null, taken: false, seat: null, on_board: true } ],
    last_draw: null,
    effects: [],
    room_config: {},
    tv_idle_notice_minutes: 10,
    last_activity_at: "2026-09-16T20:00:00+00:00",
  };
}

const DRAW: Mutation = {
  method: "post",
  path: "/games/0f8fad5b-d9cb-469f-a165-70867728950e/pool/7/draw",
  expectedVersion: 12,
};

interface Attempt {
  mutation: Mutation;
  requestId: string;
}

/**
 * A transport that answers a scripted sequence and records what it was asked.
 * The protocol is testable without a network, a timer or a random source.
 */
function transportOf (answers: Array<GameState | ApiError | Error>): {
  transport: WriteTransport;
  attempts: Attempt[];
  slept: number[];
} {
  const attempts: Attempt[] = [];
  const slept: number[] = [];
  let index = 0;
  let minted = 0;

  return {
    attempts,
    slept,
    transport: {
      send: (mutation, requestId) => {
        attempts.push({ mutation, requestId });

        const answer = answers[index++];

        return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
      },
      sleep: (ms) => {
        slept.push(ms);

        return Promise.resolve();
      },
      newRequestId: () => `intention-${++minted}`,
    },
  };
}

describe("the write protocol", () => {
  it("carries one intention and the version the client read", () => {
    const { transport } = transportOf([ snapshot(13) ]);
    const send = vi.spyOn(transport, "send");

    return mutate(DRAW, transport).then((result) => {
      expect(result).toEqual({ state: snapshot(13), conflicted: false });
      expect(send).toHaveBeenCalledWith(DRAW, "intention-1");
      expect(send.mock.calls[0][0].expectedVersion).toBe(12);
    });
  });

  it("mints the intention once and re-sends it on every retry", async () => {
    // This is the whole of idempotency on the client: the server's unique index
    // answers a repeat with the first attempt's bytes only if the id is the
    // same one. Minting it per attempt would make the ledger useless.
    const { transport, attempts } = transportOf([
      new ApiError(0, "network_error", "We could not connect."),
      new ApiError(503, "service_unavailable", "Not available."),
      snapshot(13),
    ]);

    const result = await mutate(DRAW, transport);

    expect(result.state.version).toBe(13);
    expect(attempts).toHaveLength(3);
    expect(new Set(attempts.map((attempt) => attempt.requestId)).size).toBe(1);
  });

  it("mints a new intention for a new call, because the id names an intention", async () => {
    // A second tap is a second intention and must advance the game a second
    // time. An id kept in a module or a ref would collide the two.
    const { transport, attempts } = transportOf([ snapshot(13), snapshot(14) ]);

    await mutate(DRAW, transport);
    await mutate(DRAW, transport);

    expect(attempts.map((attempt) => attempt.requestId)).toEqual([ "intention-1", "intention-2" ]);
  });

  it("gives up after two retries and lets the failure out", async () => {
    const failure = new ApiError(0, "network_error", "We could not connect.");
    const { transport, attempts, slept } = transportOf([ failure, failure, failure, snapshot(13) ]);

    await expect(mutate(DRAW, transport)).rejects.toBe(failure);
    expect(attempts).toHaveLength(3);
    expect(slept).toEqual([ 200, 600 ]);
  });

  it("does not retry a refusal, because repeating it asks the same question", async () => {
    const refusal = new ApiError(422, "pool_position_already_taken", "Already taken.");
    const { transport, attempts, slept } = transportOf([ refusal, snapshot(13) ]);

    await expect(mutate(DRAW, transport)).rejects.toBe(refusal);
    expect(attempts).toHaveLength(1);
    expect(slept).toEqual([]);
  });

  it("returns the current state a stale write is refused with, to be applied and not discarded", async () => {
    // `422 game_version_conflict` carries the projection in `data`. Applying it
    // is how a phone heals from the refusal itself, rather than asking a person
    // to refresh.
    const current = snapshot(19);
    const conflict = new ApiError(422, VERSION_CONFLICT, "The game has moved on.", current);
    const { transport, attempts } = transportOf([ conflict ]);

    const result = await mutate(DRAW, transport);

    expect(result).toEqual({ state: current, conflicted: true });
    expect(attempts).toHaveLength(1);
  });

  it("does not retry a conflict either: the answer is already the newest state", async () => {
    const conflict = new ApiError(422, VERSION_CONFLICT, "The game has moved on.", snapshot(19));
    const { transport, slept } = transportOf([ conflict, snapshot(20) ]);

    await mutate(DRAW, transport);

    expect(slept).toEqual([]);
  });

  it("refuses to heal from a conflict that carries no snapshot", async () => {
    // Inventing a state here would be worse than surfacing the failure: the
    // client would converge on something the server never said.
    const conflict = new ApiError(422, VERSION_CONFLICT, "The game has moved on.", { version: 19 });
    const { transport } = transportOf([ conflict ]);

    await expect(mutate(DRAW, transport)).rejects.toBe(conflict);
  });

  it("lets a failure that is not an ApiError straight out", async () => {
    const thrown = new Error("boom");
    const { transport, attempts } = transportOf([ thrown ]);

    await expect(mutate(DRAW, transport)).rejects.toBe(thrown);
    expect(attempts).toHaveLength(1);
  });

  it("retries a 500, because a server error says nothing about whether the write landed", async () => {
    // And that is exactly why the id must not change: if it did land, the
    // retry is answered from the ledger instead of turning a second tile over.
    const { transport, attempts } = transportOf([
      new ApiError(500, "internal_error", "Something went wrong."),
      snapshot(13),
    ]);

    const result = await mutate(DRAW, transport);

    expect(result.state.version).toBe(13);
    expect(attempts[0].requestId).toBe(attempts[1].requestId);
  });
});
