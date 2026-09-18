import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The write credential's cookie, and the one attribute that decides whether a
 * phone at a table can write at all.
 *
 * R9 fixes this product to plain HTTP on a home LAN. A browser discards a
 * `Secure` cookie set from a non-trustworthy origin without saying so, so a
 * `Secure` the server adds on its own is the phone arriving at the table with no
 * credential and every write coming back refused. The e2e run serves on
 * `127.0.0.1`, which is trustworthy, and is the one place the failure cannot
 * appear — which is why the assertion lives here.
 */

const mocks = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  header: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ set: mocks.set, get: mocks.get, delete: mocks.delete }),
  headers: () => Promise.resolve({ get: mocks.header }),
}));

const { rememberController } = await import("./session");

const GAME_ID = "00000000-0000-4000-8000-000000000001";
const TOKEN = "f3".repeat(32);

/** @returns the options both cookies were written with. */
async function optionsAfterRemembering (forwardedProto: string | null): Promise<Record<string, unknown>[]> {
  mocks.header.mockReturnValue(forwardedProto);

  await rememberController(GAME_ID, TOKEN);

  return mocks.set.mock.calls.map((call) => call[2] as Record<string, unknown>);
}

beforeEach(() => {
  mocks.set.mockReset();
  mocks.header.mockReset();
});

describe("the controller cookie", () => {
  it("is not Secure on the plain-HTTP LAN address a table opens", async () => {
    // The failing deployment exactly: a production build, reached over http.
    vi.stubEnv("NODE_ENV", "production");

    for (const options of await optionsAfterRemembering(null)) {
      expect(options.secure).toBe(false);
    }

    vi.unstubAllEnvs();
  });

  it("is not Secure behind a proxy that reports plain http, whatever the build", async () => {
    vi.stubEnv("NODE_ENV", "production");

    for (const options of await optionsAfterRemembering("http")) {
      expect(options.secure).toBe(false);
    }

    vi.unstubAllEnvs();
  });

  it("is Secure once the request really did arrive over TLS", async () => {
    for (const options of await optionsAfterRemembering("https")) {
      expect(options.secure).toBe(true);
    }
  });

  it("reads the scheme the browser spoke, not the last hop's", async () => {
    for (const options of await optionsAfterRemembering("https, http")) {
      expect(options.secure).toBe(true);
    }
  });

  it("stays unreadable to the browser's own scripts whatever the scheme", async () => {
    for (const options of await optionsAfterRemembering("https")) {
      expect(options.httpOnly).toBe(true);
      expect(options.sameSite).toBe("lax");
    }
  });

  it("writes the credential and the game it belongs to", async () => {
    mocks.header.mockReturnValue(null);

    await rememberController(GAME_ID, TOKEN);

    expect(mocks.set).toHaveBeenCalledTimes(2);
    expect(mocks.set.mock.calls[0][0]).toBe("trident_controller");
    expect(mocks.set.mock.calls[0][1]).toBe(TOKEN);
    expect(mocks.set.mock.calls[1][0]).toBe("trident_game");
    expect(mocks.set.mock.calls[1][1]).toBe(GAME_ID);
  });
});
