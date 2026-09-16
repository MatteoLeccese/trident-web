export { ApiError, isApiError } from "./api-error";

/**
 * The single envelope the API returns. `data` is always the payload; pagination,
 * when there is any, travels in `meta`.
 */
export interface ApiResponse<T> {
  status: number;
  message: string;
  error: string | null;
  data: T;
  meta?: Record<string, unknown>;
}

/** Who is watching: the phone that acts, or a screen that only watches. */
export type ViewerRole = "controller" | "spectator";

export interface Session {
  gameId: string;
  role: ViewerRole;
}
