/**
 * Where the stack is, and what the web app is built with while the spec runs.
 *
 * Every value has a default that works on a laptop with the API's compose file
 * up, and an environment variable that overrides it. Nothing here reads
 * `.env.local`: the app is rebuilt for the run with exactly these values, so a
 * machine whose `.env.local` points at a home LAN address still runs the spec
 * against localhost.
 */

function env (name: string, fallback: string): string {
  const configured = process.env[name];

  return configured === undefined || configured.trim() === "" ? fallback : configured;
}

/** The web app under test. Not 3000: that is where the compose stack publishes its own build. */
export const WEB_HOST = env("TRIDENT_E2E_WEB_HOST", "127.0.0.1");
export const WEB_PORT = env("TRIDENT_E2E_WEB_PORT", "3100");
export const BASE_URL = `http://${WEB_HOST}:${WEB_PORT}`;

/** Laravel, as the BFF reaches it. The browser never sees this address. */
export const API_URL = env("TRIDENT_E2E_API_URL", "http://127.0.0.1:8000/api/v1");

/** Reverb, as the browser reaches it. */
export const REVERB_HOST = env("TRIDENT_E2E_REVERB_HOST", "127.0.0.1");
export const REVERB_PORT = env("TRIDENT_E2E_REVERB_PORT", "8080");
export const REVERB_URL = `http://${REVERB_HOST}:${REVERB_PORT}/`;

/** Must match REVERB_APP_KEY on the API side, or every subscription fails. */
export const REVERB_APP_KEY = env("TRIDENT_E2E_REVERB_APP_KEY", "trident-local");

/**
 * Ten minutes, against a deployment default of thirty seconds.
 *
 * The watch screen reconciles over HTTP on a timer as well as over the socket,
 * and the two are indistinguishable from the DOM. Pushing the timer out past
 * the length of the run leaves the socket as the only thing that can explain a
 * frame arriving, which is what the two-second assertion is about. The spec also
 * counts the television's HTTP reads, so a poll could not pass unnoticed even if
 * one fired.
 */
export const RECONCILE_POLL_MS = env("TRIDENT_E2E_RECONCILE_POLL_MS", "600000");

/**
 * The environment the web app is built and served with.
 *
 * `NEXT_PUBLIC_*` values are inlined at build time, so the build and the server
 * have to see the same ones — which is why the web server command builds.
 */
export function webServerEnv (): Record<string, string> {
  return {
    BACKEND_API_URL: API_URL,
    NEXT_PUBLIC_REVERB_APP_KEY: REVERB_APP_KEY,
    NEXT_PUBLIC_REVERB_HOST: REVERB_HOST,
    NEXT_PUBLIC_REVERB_PORT: REVERB_PORT,
    NEXT_PUBLIC_REVERB_SCHEME: "http",
    NEXT_PUBLIC_TRIDENT_RECONCILE_POLL_MS: RECONCILE_POLL_MS,
  };
}
