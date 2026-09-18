import { defineConfig } from "@playwright/test";
import { BASE_URL, WEB_HOST, WEB_PORT, webServerEnv } from "./e2e/support/stack";

/**
 * The two-screen spec, against the real stack.
 *
 * There is nothing here to fake. The product is one phone writing over HTTPS and
 * one television reading over a socket, so the spec needs Laravel, Reverb, a
 * database and this app. Bring it up in two commands and run it in one:
 *
 *   cd ../trident-api && docker compose up -d --build api reverb
 *   npm run test:e2e
 *
 * The first command also starts Postgres and both Redis instances, which the API
 * declares as dependencies. The second builds this app and serves it on 3100 —
 * not 3000, so it never collides with the build the web compose file publishes
 * there, and never reports on it either.
 *
 * `next start` prints a warning about `output: "standalone"`. It is serving the
 * ordinary `.next` build, which is what is being tested; the standalone bundle
 * is what the Docker image runs.
 *
 * Nothing in this run reads `.env.local`. The app is rebuilt with the values in
 * `e2e/support/stack.ts`, because `NEXT_PUBLIC_*` is inlined at build time and a
 * machine whose `.env.local` names a home LAN address would otherwise send the
 * browser looking for Reverb on an address the test host cannot reach.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",

  /*
   * One worker, and no retries.
   *
   * The spec measures how long a frame takes to cross a socket, and two suites
   * competing for this machine's cores would measure the machine instead. A
   * retry would do worse: it would let a missed deadline pass on the second
   * attempt, which is the one thing a timing assertion must never do.
   */
  workers: 1,
  fullyParallel: false,
  retries: 0,
  forbidOnly: !!process.env.CI,

  /*
   * A turn is several taps against a real API and a late join plays four of
   * them, but what sets this number is the reconnect: a dropped socket is not
   * noticed until the transport's own activity timeout has passed.
   */
  timeout: 180_000,
  expect: { timeout: 10_000 },

  reporter: [ [ "list" ] ],

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [ { name: "chromium", use: { browserName: "chromium" } } ],

  webServer: {

    /*
     * It builds. `NEXT_PUBLIC_*` is inlined at build time, so serving a build
     * made with other values would put the browser on another Reverb and the
     * failure would look like a broken socket.
     */
    command: `npm run build && npm run start -- --port ${WEB_PORT} --hostname ${WEB_HOST}`,
    url: `${BASE_URL}/api/health`,
    env: webServerEnv(),
    timeout: 300_000,
    stdout: "pipe",
    stderr: "pipe",

    /*
     * Off by default: a run that serves a build it did not make is a run that
     * reports on source nobody here changed. Set TRIDENT_E2E_REUSE_SERVER=1
     * while iterating on the spec itself.
     */
    reuseExistingServer: process.env.TRIDENT_E2E_REUSE_SERVER === "1",
  },
});
