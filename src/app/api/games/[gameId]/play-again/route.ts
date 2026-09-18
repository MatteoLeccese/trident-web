import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";
import { issuedGame } from "@/lib/game-issue";
import { controllerToken, rememberController } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * The next game with the same table.
 *
 * It is the second and last route that emits a `controller_token` in the clear,
 * so like the route that creates a game it has a path of its own and never goes
 * through the generic proxy, which would return the backend's body verbatim and
 * hand the credential to the browser.
 *
 * It **rotates** the cookie: the moment the next game exists, the token of the
 * previous one stops being able to write anything. The backend closes that game
 * in the same unit of work, so its token exists nowhere but as a hash and no
 * route will ever emit it again.
 *
 * It demands the current game's token, which the proxy's own cookie supplies, so
 * it is not an exception to the rule that every mutating game route is
 * authenticated.
 */
export async function POST (request: Request, context: { params: Promise<{ gameId: string; }>; }): Promise<Response> {
  const { gameId } = await context.params;
  let response: Response;

  try {
    response = await backendFetch({
      segments: [ "games", gameId, "play-again" ],
      search: "",
      method: "POST",
      headers: request.headers,
      body: await request.text(),
      controllerToken: await controllerToken(),
    });
  } catch {
    return NextResponse.json(
      {
        status: 502,
        message: "We could not reach the game server.",
        error: "backend_unreachable",
        data: null,
      },
      { status: 502 },
    );
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok || body === null) {
    return NextResponse.json(body ?? {
      status: response.status,
      message: "We could not start another game.",
      error: "backend_unreachable",
      data: null,
    }, { status: response.status });
  }

  const issued = issuedGame(body);

  if (issued.token !== null && issued.gameId !== null) {
    await rememberController(issued.gameId, issued.token);
  }

  return NextResponse.json(issued.sanitised, { status: response.status });
}
