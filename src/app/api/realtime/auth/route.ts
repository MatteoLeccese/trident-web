import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";
import { controllerToken } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Channel authorization, with the token injected on the server.
 *
 * pusher-js **never** sets `withCredentials` on this request, so the cookie only
 * travels if the endpoint is same-origin. That is why Echo points here and not to
 * Laravel: it is what keeps the credential out of the browser's JavaScript.
 *
 * The body arrives as `application/x-www-form-urlencoded`, never JSON, and we
 * must answer 200 with valid JSON or pusher-js treats it as an auth failure.
 */
export async function POST (request: Request): Promise<Response> {
  const form = await request.formData();
  const socketId = String(form.get("socket_id") ?? "");
  const channelName = String(form.get("channel_name") ?? "");

  try {
    const response = await backendFetch({
      segments: [ "broadcasting", "auth" ],
      search: "",
      method: "POST",
      headers: new Headers({ "content-type": "application/json", accept: "application/json" }),
      body: JSON.stringify({ socket_id: socketId, channel_name: channelName }),
      controllerToken: await controllerToken(),
    });

    return new NextResponse(response.body, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "auth_unavailable" }, { status: 502 });
  }
}
