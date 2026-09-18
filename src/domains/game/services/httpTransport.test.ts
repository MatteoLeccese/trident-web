import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameState } from "@/domains/game/types";
import type { Mutation } from "./writeProtocol";

/**
 * The request the phone actually puts on the wire.
 *
 * Every other test of the write protocol injects its own transport and asserts
 * against the `Mutation` object, which says nothing about what was serialised.
 * That leaves the protocol's two reasons to exist unobserved, and the backend
 * treats both as optional — `expected_version` is `nullable` and the replay
 * lookup is skipped when there is no request id — so losing either is silent:
 *
 * - without `expected_version`, a stale phone's tap is applied unconditionally
 *   instead of coming back 422 with the current board, and it turns over a tile
 *   the table did not choose;
 * - without `X-Request-Id`, a retry of a write that already landed turns over a
 *   second tile.
 */

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("@/domains/core/services/api", () => ({ api: { request: mocks.request } }));

const { httpTransport } = await import("./writeProtocol");

const GAME_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

const DRAW: Mutation = {
  method: "post",
  path: `/games/${GAME_ID}/pool/7/draw`,
  expectedVersion: 12,
};

function snapshot (version: number): GameState {
  return {
    game_id: GAME_ID,
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

/** @returns the axios config the transport built. */
async function requestFor (mutation: Mutation, requestId: string): Promise<Record<string, never>> {
  mocks.request.mockResolvedValue({ data: { data: snapshot(13) } });

  await httpTransport.send(mutation, requestId);

  return mocks.request.mock.calls[0][0] as Record<string, never>;
}

beforeEach(() => {
  mocks.request.mockReset();
});

describe("the request a write is sent as", () => {
  it("names the version the client read", async () => {
    const config = await requestFor(DRAW, "1cb1a0fd-0a3e-4b18-8a2f-2cf2de9a3d49");

    expect(config).toMatchObject({ data: { expected_version: 12 } });
  });

  it("carries the request id as the header the BFF forwards", async () => {
    const config = await requestFor(DRAW, "1cb1a0fd-0a3e-4b18-8a2f-2cf2de9a3d49");

    expect(config).toMatchObject({
      headers: { "X-Request-Id": "1cb1a0fd-0a3e-4b18-8a2f-2cf2de9a3d49" },
    });
  });

  it("puts the mutation's own body beside the version, without losing either", async () => {
    const rename: Mutation = {
      method: "patch",
      path: `/games/${GAME_ID}/seats/2`,
      body: { nickname: "Anita" },
      expectedVersion: 4,
    };

    const config = await requestFor(rename, "9c4e7b02-9d4e-4f5b-8a19-6c4b0d2e7f10");

    expect(config).toMatchObject({
      method: "patch",
      url: `/games/${GAME_ID}/seats/2`,
      data: { nickname: "Anita", expected_version: 4 },
    });
  });

  it("never lets a body field shadow the version the client read", async () => {
    // The version is the protocol's and not a caller's to set.
    const config = await requestFor(
      { ...DRAW, body: { expected_version: 1 } },
      "0b1d2c3e-4f50-4617-8829-9a0b1c2d3e4f",
    );

    expect(config).toMatchObject({ data: { expected_version: 12 } });
  });

  it("returns the snapshot out of the envelope and nothing around it", async () => {
    mocks.request.mockResolvedValue({ data: { data: snapshot(13) } });

    const state = await httpTransport.send(DRAW, "0b1d2c3e-4f50-4617-8829-9a0b1c2d3e4f");

    expect(state.version).toBe(13);
  });

  it("mints a fresh request id per intention", () => {
    // One tap is one intention: two ids that collided would let the ledger
    // answer the second tap with the first tap's tile.
    expect(httpTransport.newRequestId()).not.toBe(httpTransport.newRequestId());
  });
});
