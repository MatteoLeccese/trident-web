import { api } from "@/domains/core/services/api";
import { ApiError } from "@/domains/core/types/api-error";
import type { ApiResponse } from "@/domains/core/types";
import type { CreatedGame, GameState } from "@/domains/game/types";

/**
 * Two paths, on purpose:
 *
 * - **Reads** go through the generic proxy (`/api/proxy/...`) with the single
 *   axios instance.
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

  get: async (gameId: string): Promise<GameState> =>
    (await api.get<ApiResponse<GameState>>(`/games/${gameId}`)).data.data,

  byCode: async (code: string): Promise<GameState> =>
    (await api.get<ApiResponse<GameState>>(`/games/by-code/${code}`)).data.data,

  renameSeat: async (gameId: string, seat: number, nickname: string): Promise<GameState> =>
    (await api.patch<ApiResponse<GameState>>(`/games/${gameId}/seats/${seat}`, { nickname })).data.data,
};
