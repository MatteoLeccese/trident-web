import { API_URL, REVERB_URL } from "./support/stack";

/**
 * Refuses to run without the stack, and says how to start it.
 *
 * Without this the failure is a socket that never goes live and a television
 * that never updates — which reads exactly like the product being broken. The
 * spec is about two browsers talking to one Laravel and one Reverb, so there is
 * nothing to fake: what it can do is fail in one line that names the command.
 */

const START_THE_STACK = [
  "Start the stack and run again:",
  "",
  "  cd ../trident-api && docker compose up -d --build api reverb",
  "",
  "That brings up Postgres, both Redis instances, the API on :8000 and Reverb on :8080.",
].join("\n");

interface Probe {
  healthy: boolean;

  /** Seconds the API asked to be left alone for, when it is the rate limiter answering. */
  rateLimitedFor: number | null;
}

/** Anything that answers HTTP is listening. Reverb answers a bare GET with 404. */
async function answers (url: string): Promise<boolean> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(5_000) });

    return true;
  } catch {
    return false;
  }
}

async function probeApi (): Promise<Probe> {
  try {
    const response = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(5_000) });

    if (response.status === 429) {
      const asked = Number(response.headers.get("retry-after") ?? "");

      return { healthy: false, rateLimitedFor: Number.isFinite(asked) && asked > 0 ? asked : 60 };
    }

    const body: unknown = await response.json();

    return {
      healthy: response.ok
        && typeof body === "object"
        && body !== null
        && (body as { data?: { status?: unknown; }; }).data?.status === "ok",
      rateLimitedFor: null,
    };
  } catch {
    return { healthy: false, rateLimitedFor: null };
  }
}

/**
 * Waits out the API's own rate limit before the run starts.
 *
 * A whole run is some sixty requests and the limit is per minute, so two runs
 * back to back can reach it — and a rate-limited API mid-suite looks like a
 * broken product rather than like the throttle it is. The wait is announced,
 * bounded by what the API itself asked for, and it happens here rather than
 * inside anything that asserts. The limit is the product's; a spec that ran with
 * it turned down would not be reporting on the product.
 */
async function waitOutTheThrottle (probe: Probe): Promise<Probe> {
  if (probe.rateLimitedFor === null) {
    return probe;
  }

  const seconds = Math.min(probe.rateLimitedFor + 1, 90);

  process.stdout.write(
    `The API is rate limiting this host, which is what a run that follows another one looks like.\n`
    + `Waiting ${seconds}s for its window to reset.\n`,
  );

  await new Promise((resolve) => setTimeout(resolve, seconds * 1_000));

  return probeApi();
}

export default async function globalSetup (): Promise<void> {
  const api = await waitOutTheThrottle(await probeApi());
  const missing: string[] = [];

  if (!api.healthy) {
    missing.push(api.rateLimitedFor === null
      ? `  - the API did not answer at ${API_URL}/health`
      : `  - the API is still rate limiting this host at ${API_URL}/health, and its window is a minute`);
  }

  if (!await answers(REVERB_URL)) {
    missing.push(`  - Reverb did not answer at ${REVERB_URL}`);
  }

  if (missing.length > 0) {
    throw new Error([ "", ...missing, "", START_THE_STACK, "" ].join("\n"));
  }
}
