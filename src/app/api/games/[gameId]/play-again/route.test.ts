import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The second and last route that receives the write credential in the clear, so
 * it is born with the same test as the first: the body that reaches the browser
 * does not contain it.
 *
 * It also has one job the creation route does not — it **rotates** the cookie,
 * so the previous game's token stops being able to write the moment the next
 * game exists — and it must demand the current game's token, which is what keeps
 * it from being an exception to the rule that every mutating game route is
 * authenticated.
 */

const mocks = vi.hoisted(() => ({
  backendFetch: vi.fn(),
  rememberController: vi.fn(),
  controllerToken: vi.fn(),
}));

vi.mock("@/lib/backend", () => ({ backendFetch: mocks.backendFetch }));
vi.mock("@/lib/session", () => ({
  rememberController: mocks.rememberController,
  controllerToken: mocks.controllerToken,
}));

const { POST } = await import("./route");

const OLD_TOKEN = "11".repeat(32);
const NEW_TOKEN = "22".repeat(32);
const OLD_GAME = "00000000-0000-4000-8000-000000000001";
const NEW_GAME = { game_id: "00000000-0000-4000-8000-000000000002", version: 1, status: "lobby" };

function backendAnswers (body: unknown, status = 201): void {
  mocks.backendFetch.mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
  );
}

function rematchRequest (): Request {
  return new Request(`http://phone.local/api/games/${OLD_GAME}/play-again`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
}

function context (): { params: Promise<{ gameId: string; }>; } {
  return { params: Promise.resolve({ gameId: OLD_GAME }) };
}

beforeEach(() => {
  mocks.backendFetch.mockReset();
  mocks.rememberController.mockReset();
  mocks.controllerToken.mockReset();
  mocks.rememberController.mockResolvedValue(undefined);
  mocks.controllerToken.mockResolvedValue(OLD_TOKEN);
});

describe("POST /api/games/[gameId]/play-again", () => {
  it("never lets the new write credential reach the browser", async () => {
    backendAnswers({
      status: 201,
      message: "Game created.",
      error: null,
      data: { game: NEW_GAME, controller_token: NEW_TOKEN },
    });

    const response = await POST(rematchRequest(), context());
    const text = await response.text();

    expect(text).not.toContain(NEW_TOKEN);
    expect(text).not.toContain(OLD_TOKEN);
    expect(text.toLowerCase()).not.toContain("controller_token");
    expect(JSON.parse(text)).toEqual({
      status: 201,
      message: "Game created.",
      error: null,
      data: { game: NEW_GAME },
    });
  });

  it("rotates the cookie onto the new game", async () => {
    backendAnswers({ status: 201, message: "OK", error: null, data: { game: NEW_GAME, controller_token: NEW_TOKEN } });

    await POST(rematchRequest(), context());

    expect(mocks.rememberController).toHaveBeenCalledWith(NEW_GAME.game_id, NEW_TOKEN);
  });

  it("asks the backend with the current game's token, on the game's own path", async () => {
    backendAnswers({ status: 201, message: "OK", error: null, data: { game: NEW_GAME, controller_token: NEW_TOKEN } });

    await POST(rematchRequest(), context());

    expect(mocks.backendFetch).toHaveBeenCalledWith(expect.objectContaining({
      segments: [ "games", OLD_GAME, "play-again" ],
      method: "POST",
      controllerToken: OLD_TOKEN,
    }));
  });

  it("passes a refusal on and leaves the cookie where it was", async () => {
    // A game that cannot be replayed must not take the phone's write credential
    // with it.
    backendAnswers({ status: 403, message: "Wrong phone.", error: "controller_token_invalid", data: null }, 403);

    const response = await POST(rematchRequest(), context());

    expect(response.status).toBe(403);
    expect(mocks.rememberController).not.toHaveBeenCalled();
  });

  it("answers an unreachable backend in the shape of the envelope", async () => {
    mocks.backendFetch.mockRejectedValue(new Error("connect ECONNREFUSED"));

    const response = await POST(rematchRequest(), context());

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: "backend_unreachable", data: null });
  });
});
