import { NextResponse } from "next/server";
import { currentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Who it is that is opening this tab.
 *
 * It is also what fixes the old system's "one refresh loses the game forever":
 * the cookie survives the reload and the phone locking.
 */
export async function GET (): Promise<NextResponse> {
  const session = await currentSession();

  return NextResponse.json({
    status: 200,
    message: "OK",
    error: null,
    data: session === null ? null : { game_id: session.gameId, role: session.role },
  });
}
