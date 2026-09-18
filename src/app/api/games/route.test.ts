import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The route that opens a game is one of the two in the system that receive the
 * write credential in the clear, and the convention is that such a route ships
 * with the test that the body reaching the browser does not contain it.
 *
 * The backend and the cookie jar are both replaced: what is under test is this
 * route's own job — take the token out, keep it on the server, hand on an
 * envelope without it — and neither a real Laravel nor a real request scope says
 * anything about whether it did that.
 */

const mocks = vi.hoisted(() => ({
  backendFetch: vi.fn(),
  rememberController: vi.fn(),
}));

vi.mock("@/lib/backend", () => ({ backendFetch: mocks.backendFetch }));
vi.mock("@/lib/session", () => ({ rememberController: mocks.rememberController }));

const { POST } = await import("./route");

const TOKEN = "f3".repeat(32);
const GAME = { game_id: "00000000-0000-4000-8000-000000000001", version: 1, status: "lobby" };

function backendAnswers (body: unknown, status = 201): void {
  mocks.backendFetch.mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
  );
}

function creationRequest (): Request {
  return new Request("http://phone.local/api/games", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nicknames: [ "Ana", "Bruno", "Carla" ] }),
  });
}

beforeEach(() => {
  mocks.backendFetch.mockReset();
  mocks.rememberController.mockReset();
  mocks.rememberController.mockResolvedValue(undefined);
});

describe("POST /api/games", () => {
  it("never lets the write credential reach the browser", async () => {
    backendAnswers({
      status: 201,
      message: "Game created.",
      error: null,
      data: { game: GAME, controller_token: TOKEN },
    });

    const response = await POST(creationRequest());
    const text = await response.text();

    expect(text).not.toContain(TOKEN);
    expect(text.toLowerCase()).not.toContain("controller_token");
    expect(JSON.parse(text)).toEqual({
      status: 201,
      message: "Game created.",
      error: null,
      data: { game: GAME },
    });
  });

  it("writes the credential into the cookie instead, against the game it belongs to", async () => {
    backendAnswers({ status: 201, message: "OK", error: null, data: { game: GAME, controller_token: TOKEN } });

    await POST(creationRequest());

    expect(mocks.rememberController).toHaveBeenCalledWith(GAME.game_id, TOKEN);
  });

  it("keeps the backend's status", async () => {
    backendAnswers({ status: 201, message: "OK", error: null, data: { game: GAME, controller_token: TOKEN } });

    expect((await POST(creationRequest())).status).toBe(201);
  });

  it("passes a refusal on as it arrived and remembers nothing", async () => {
    backendAnswers({ status: 422, message: "Bad roster.", error: "roster_size_invalid", data: null }, 422);

    const response = await POST(creationRequest());

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      status: 422,
      message: "Bad roster.",
      error: "roster_size_invalid",
      data: null,
    });
    expect(mocks.rememberController).not.toHaveBeenCalled();
  });

  it("answers an unreachable backend in the shape of the envelope", async () => {
    // A 502 from a proxy is HTML, and the browser types every body as the
    // envelope. It must not have to parse a failure differently.
    mocks.backendFetch.mockRejectedValue(new Error("connect ECONNREFUSED"));

    const response = await POST(creationRequest());

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: "backend_unreachable", data: null });
  });
});
