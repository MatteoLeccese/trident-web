import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";
import { issuedGame } from "@/lib/game-issue";
import { rememberController } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Create a game.
 *
 * It is the only route that does not go through the generic proxy, because it
 * has a job of its own: the backend returns the `controller_token` in the clear
 * **exactly once**, and here it is stored in an httpOnly cookie and **removed
 * from the response** before it reaches the browser.
 */
export async function POST (request: Request): Promise<Response> {
  let response: Response;

  try {
    response = await backendFetch({
      segments: [ "games" ],
      search: "",
      method: "POST",
      headers: request.headers,
      body: await request.text(),
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
      message: "We could not create the game.",
      error: "backend_unreachable",
      data: null,
    }, { status: response.status });
  }

  const issued = issuedGame(body);

  if (issued.token !== null && issued.gameId !== null) {
    await rememberController(issued.gameId, issued.token);
  }

  // The token stays here. It does not cross over to the browser even once.
  return NextResponse.json(issued.sanitised, { status: response.status });
}
