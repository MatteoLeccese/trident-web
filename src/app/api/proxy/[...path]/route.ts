import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

export const dynamic = "force-dynamic";

const CONTROLLER_COOKIE = "trident_controller";

interface RouteContext {
  params: Promise<{ path: string[]; }>;
}

/**
 * Catch-all proxy: the browser only talks to this origin.
 *
 * It reads the `controller_token` from the httpOnly cookie and injects it on the
 * server, so that the write credential never exists in client-side JavaScript.
 */
async function proxy (request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  const jar = await cookies();
  const search = new URL(request.url).search;
  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  try {
    const response = await backendFetch({
      segments: path,
      search,
      method: request.method,
      headers: request.headers,
      body: hasBody ? await request.text() : null,
      controllerToken: jar.get(CONTROLLER_COOKIE)?.value ?? null,
    });

    // The body is returned as is: the envelope is produced by the backend and the
    // frontend types it as ApiResponse<T>. The BFF does not reinterpret it.
    return new NextResponse(response.body, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    // An invalid route or an unreachable backend must not leak their cause to the
    // browser, but they do have to arrive in the shape of the envelope.
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
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
