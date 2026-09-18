import { api } from "@/domains/core/services/api";
import { ApiError } from "@/domains/core/types/api-error";
import type { ApiResponse } from "@/domains/core/types";
import type { ConfigValue, CreatedGame, GameState, RoomConfigSpec } from "@/domains/game/types";
import { mutate, type MutationResult } from "@/domains/game/services/writeProtocol";

/**
 * Three paths, on purpose:
 *
 * - **Reads** go through the generic proxy (`/api/proxy/...`) with the single
 *   axios instance.
 * - **Writes** go through the same proxy, but via `mutate`, which is what
 *   carries the two guards of the write protocol: one `X-Request-Id` per
 *   intention, and the `expected_version` the client read.
 * - **Create** goes to `/api/games`, which is a route of the BFF's own, because
 *   it has a job the generic proxy cannot do: keep the `controller_token` and
 *   strip it from the response.
 */
async function postToBff<T> (path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      typeof payload?.error === "string" ? payload.error : "internal_error",
      typeof payload?.message === "string" ? payload.message : "",
      payload?.data ?? null,
    );
  }

  return payload.data as T;
}

export const gameApi = {
  create: (nicknames: string[]): Promise<CreatedGame> =>
    postToBff<CreatedGame>("/api/games", { nicknames }),

  /**
   * The next game with the same table.
   *
   * Like `create`, it goes to a route of the BFF's own and never through the
   * generic proxy: it is the second and last route that emits the write
   * credential, and the proxy returns the backend's body verbatim. The BFF
   * rotates the cookie and strips the token before this ever resolves.
   *
   * It carries neither a request id nor an expected version, and it is not a
   * `mutate`: it writes nothing to the game it is asked from, so there is no
   * version to guard and no snapshot a repeat could be answered with.
   */
  playAgain: (gameId: string): Promise<CreatedGame> =>
    postToBff<CreatedGame>(`/api/games/${gameId}/play-again`, {}),

  get: async (gameId: string): Promise<GameState> =>
    (await api.get<ApiResponse<GameState>>(`/games/${gameId}`)).data.data,

  byCode: async (code: string): Promise<GameState> =>
    (await api.get<ApiResponse<GameState>>(`/games/by-code/${code}`)).data.data,

  /**
   * The declaration the lobby form is generated from. It is read once per game:
   * it belongs to the ruleset, carries no version and no write changes it, which
   * is why it is not a field of the snapshot.
   */
  roomConfigSpec: async (gameId: string): Promise<RoomConfigSpec> =>
    (await api.get<ApiResponse<RoomConfigSpec>>(`/games/${gameId}/room-config-spec`)).data.data,

  renameSeat: (gameId: string, seat: number, nickname: string, expectedVersion: number): Promise<MutationResult> =>
    mutate({ method: "patch", path: `/games/${gameId}/seats/${seat}`, body: { nickname }, expectedVersion }),

  /** An absolute permutation of the ring, which is what makes a repeat harmless. */
  reorderSeats: (gameId: string, order: number[], expectedVersion: number): Promise<MutationResult> =>
    mutate({ method: "put", path: `/games/${gameId}/seats/order`, body: { order }, expectedVersion }),

  /**
   * The whole settings map, flat and dotted, exactly as the spec declares its
   * keys. What is submitted is what is stored; an absent key takes the spec's
   * default when play begins.
   */
  configureRoom: (
    gameId: string,
    roomConfig: Record<string, ConfigValue>,
    expectedVersion: number,
  ): Promise<MutationResult> =>
    mutate({ method: "post", path: `/games/${gameId}/room-config`, body: { room_config: roomConfig }, expectedVersion }),

  start: (gameId: string, expectedVersion: number): Promise<MutationResult> =>
    mutate({ method: "post", path: `/games/${gameId}/start`, expectedVersion }),

  /**
   * A draw names a position and nothing else: no seat, because the server
   * attributes it to the seat it already holds, and no face, because the client
   * cannot name one it has not seen.
   */
  draw: (gameId: string, position: number, expectedVersion: number): Promise<MutationResult> =>
    mutate({ method: "post", path: `/games/${gameId}/pool/${position}/draw`, expectedVersion }),
};
