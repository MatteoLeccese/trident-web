import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Container healthcheck. It deliberately does not touch the backend: it answers on its own. */
export function GET (): NextResponse {
  return NextResponse.json({ status: "ok" });
}
