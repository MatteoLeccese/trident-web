import { type AxiosAdapter, AxiosError, AxiosHeaders } from "axios";
import { afterEach, describe, expect, it } from "vitest";
import { ApiError, isApiError } from "@/domains/core/types/api-error";
import { api } from "./api";

const originalAdapter = api.defaults.adapter;

afterEach(() => {
  api.defaults.adapter = originalAdapter;
});

/** Replaces the real transport with a fixed response, leaving the interceptors alive. */
function respondWith (status: number, body: unknown): void {
  api.defaults.adapter = (async (config) => {
    const response = {
      data: body,
      status,
      statusText: "",
      headers: new AxiosHeaders(),
      config,
    };

    if (status >= 400) {
      throw new AxiosError("Request failed", String(status), config, {}, response);
    }

    return response;
  }) as AxiosAdapter;
}

function failWith (code: string): void {
  api.defaults.adapter = (async (config) => {
    throw new AxiosError("boom", code, config, {});
  }) as AxiosAdapter;
}

describe("the api client", () => {
  it("talks to the BFF, never to the backend directly", () => {
    // The browser never calls Laravel: the token lives in an httpOnly cookie
    // that only the Next server can read.
    expect(api.defaults.baseURL).toBe("/api/proxy");
  });

  it("returns the envelope untouched on success", async () => {
    respondWith(200, { status: 200, message: "OK", error: null, data: { seat: 3 } });

    const response = await api.get("/games/abc");

    expect(response.data.data).toEqual({ seat: 3 });
  });

  it("turns an enveloped error into an ApiError", async () => {
    respondWith(422, {
      status: 422,
      message: "No es tu turno.",
      error: "not_your_turn",
      data: null,
    });

    await expect(api.get("/games/abc")).rejects.toSatisfy((error: unknown) => {
      expect(isApiError(error)).toBe(true);
      const apiError = error as ApiError;
      expect(apiError.status).toBe(422);
      expect(apiError.errorCode).toBe("not_your_turn");
      expect(apiError.message).toBe("No es tu turno.");

      return true;
    });
  });

  it("keeps the recovery data so a stale client can self-heal", async () => {
    respondWith(422, {
      status: 422,
      message: "Estado obsoleto.",
      error: "game_version_conflict",
      data: { version: 47 },
    });

    await expect(api.get("/games/abc")).rejects.toMatchObject({
      errorCode: "game_version_conflict",
      data: { version: 47 },
    });
  });

  it("normalises a response that is not the envelope at all", async () => {
    // A 502 from a proxy returns HTML. It must not blow up the client.
    respondWith(502, "<html>Bad Gateway</html>");

    await expect(api.get("/games/abc")).rejects.toMatchObject({
      name: "ApiError",
      status: 502,
      errorCode: "internal_error",
    });
  });

  it("normalises a network failure, where there is no response at all", async () => {
    failWith(AxiosError.ERR_NETWORK);

    await expect(api.get("/games/abc")).rejects.toMatchObject({
      name: "ApiError",
      status: 0,
      errorCode: "network_error",
    });
  });

  it("normalises a timeout distinctly from a network failure", async () => {
    failWith(AxiosError.ECONNABORTED);

    await expect(api.get("/games/abc")).rejects.toMatchObject({
      name: "ApiError",
      status: 0,
      errorCode: "timeout",
    });
  });

  it("never rejects with a raw AxiosError", async () => {
    // Everything that comes out of here is an ApiError, so the screens only
    // need to know about one error type.
    const cases = [
      () => respondWith(404, { status: 404, message: "No existe.", error: "not_found", data: null }),
      () => respondWith(500, "boom"),
      () => failWith(AxiosError.ERR_NETWORK),
    ];

    for (const setUp of cases) {
      setUp();
      const error: unknown = await api.get("/x").catch((caught: unknown) => caught);

      expect(isApiError(error)).toBe(true);
      expect(error).not.toBeInstanceOf(AxiosError);
    }
  });
});
