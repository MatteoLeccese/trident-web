import "server-only";

/**
 * The system's single point that talks to Laravel.
 *
 * It lives on the server only: `server-only` makes importing it from a client
 * component a build error, not a production failure. This is where the
 * `controller_token` read from the httpOnly cookie is injected, so that the
 * browser never sees it.
 */

/** Headers the browser can influence and that the backend needs. */
const FORWARDABLE = new Set([
  "accept",
  "accept-language",
  "content-type",
  "x-request-id",
]);

const SEGMENT_PATTERN = /^[A-Za-z0-9._~@+-]+$/;

export function backendBaseUrl (): string {
  // No NEXT_PUBLIC_ prefix: this variable never reaches the browser.
  const configured = process.env.BACKEND_API_URL;

  if (configured === undefined || configured.trim() === "") {
    throw new Error("BACKEND_API_URL is missing. The BFF does not know where to talk to.");
  }

  return configured.replace(/\/+$/, "");
}

/**
 * Rebuilds the backend path from the catch-all segments.
 *
 * It is deliberately restrictive: the proxy carries the credential, so a segment
 * able to climb out of the prefix or to point at another host would be an SSRF.
 */
export function buildBackendUrl (base: string, segments: string[], search: string): string {
  if (segments.length === 0) {
    throw new Error("The proxy needs at least one path segment.");
  }

  for (const segment of segments) {
    if (segment === "" || segment === "." || segment === "..") {
      throw new Error(`Path segment not allowed: '${segment}'.`);
    }

    // Whitelist: anything that does not match is left out. That covers in one go
    // slashes, backslashes, control characters, percent-encoding and any URL
    // scheme.
    if (!SEGMENT_PATTERN.test(segment)) {
      throw new Error(`Path segment not allowed: '${segment}'.`);
    }
  }

  return `${base}/${segments.join("/")}${search}`;
}

/** Whitelist: anything not in here does not cross. */
export function forwardableHeaders (incoming: Headers): Headers {
  const forwarded = new Headers();

  incoming.forEach((value, name) => {
    if (FORWARDABLE.has(name.toLowerCase())) {
      forwarded.set(name, value);
    }
  });

  return forwarded;
}

interface BackendRequest {
  segments: string[];
  search: string;
  method: string;
  headers: Headers;
  body?: BodyInit | null;
  controllerToken?: string | null;
}

export async function backendFetch (request: BackendRequest): Promise<Response> {
  const headers = forwardableHeaders(request.headers);

  if (request.controllerToken !== undefined && request.controllerToken !== null) {
    headers.set("X-Trident-Controller-Token", request.controllerToken);
  }

  return fetch(buildBackendUrl(backendBaseUrl(), request.segments, request.search), {
    method: request.method,
    headers,
    body: request.body ?? undefined,
    cache: "no-store",
    redirect: "manual",
  });
}
