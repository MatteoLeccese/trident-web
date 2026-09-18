import { api } from "@/domains/core/services/api";
import { ApiError, isApiError } from "@/domains/core/types/api-error";
import type { ApiResponse } from "@/domains/core/types";
import type { GameState } from "@/domains/game/types";
import { isGameState } from "@/domains/game/utils/isGameState";
import { newRequestId } from "@/domains/game/utils/requestId";

/** The refusal a phone heals from instead of asking a person to refresh. */
export const VERSION_CONFLICT = "game_version_conflict";

/**
 * Two retries after the first attempt, with a backoff. The number is the
 * scenario it was chosen for: a table on bad wifi taps, sees nothing, and taps
 * again — the retry is what stops the person from being the retry mechanism.
 */
const RETRY_DELAYS_MS = [ 200, 600 ];

export interface Mutation {
  method: "post" | "put" | "patch";

  /** Backend path, relative to the BFF proxy: `/games/{id}/pool/{position}/draw`. */
  path: string;

  body?: Record<string, unknown>;

  /** The version the client read and believes it is writing on top of. */
  expectedVersion: number;
}

export interface MutationResult {

  /**
   * The snapshot this write produced, or — when it was refused as stale — the
   * current one the server answered with. Either way it goes through the version
   * guard: that is the healing.
   */
  state: GameState;

  /** True when the server refused the write because this client was behind. */
  conflicted: boolean;
}

/**
 * Everything `mutate` touches that is not pure, so the protocol is testable
 * without a network, a timer or a random source.
 */
export interface WriteTransport {
  send: (mutation: Mutation, requestId: string) => Promise<GameState>;
  sleep: (ms: number) => Promise<void>;
  newRequestId: () => string;
}

async function send (mutation: Mutation, requestId: string): Promise<GameState> {
  const response = await api.request<ApiResponse<GameState>>({
    method: mutation.method,
    url: mutation.path,
    data: { ...mutation.body, expected_version: mutation.expectedVersion },
    // The BFF forwards this header and injects the write credential beside it.
    headers: { "X-Request-Id": requestId },
  });

  return response.data.data;
}

export const httpTransport: WriteTransport = {
  send,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  newRequestId,
};

/**
 * Whether an attempt failed in a way that says nothing about whether the write
 * landed.
 *
 * A transport failure and a 5xx are retried; a 4xx is a decision and repeating
 * it would only ask the same question again. The retry is safe precisely because
 * the id does not change: a write that did land is answered from the ledger with
 * the bytes of the first attempt.
 */
function isWorthRetrying (failure: ApiError): boolean {
  return failure.status === 0 || failure.status >= 500;
}

/**
 * One write intention, carried to the server until it is answered.
 *
 * **Where the request id comes from, and what it survives.** It is minted once
 * here, before the first attempt, and it lives for the length of this call. A
 * retry is this same call going round its loop, so it re-sends the same id and
 * the server's unique index on `game_moves.request_id` answers the repeat with
 * the first attempt's bytes instead of turning a second tile over. A new tap is
 * a new call, which mints a new id — which is the whole point: the id names an
 * intention, not a connection and not a game. Minting it per attempt would make
 * the ledger useless; keeping one in a module or a ref would make two different
 * intentions collide.
 *
 * **A stale write is not an error to show.** `422 game_version_conflict` carries
 * the current state in `data`, and this returns it to be applied rather than
 * discarded: the phone converges from the refusal itself instead of asking a
 * human to refresh.
 */
export async function mutate (
  mutation: Mutation,
  transport: WriteTransport = httpTransport,
): Promise<MutationResult> {
  const requestId = transport.newRequestId();

  for (let attempt = 0; ; attempt++) {
    try {
      return { state: await transport.send(mutation, requestId), conflicted: false };
    } catch (caught: unknown) {
      if (!isApiError(caught)) {
        throw caught;
      }

      if (caught.errorCode === VERSION_CONFLICT) {
        if (!isGameState(caught.data)) {
          // The contract says the refusal carries the projection. Without it
          // there is nothing to heal from, and inventing one would be worse.
          throw caught;
        }

        return { state: caught.data, conflicted: true };
      }

      const delay = RETRY_DELAYS_MS[attempt];

      if (delay === undefined || !isWorthRetrying(caught)) {
        throw caught;
      }

      await transport.sleep(delay);
    }
  }
}
