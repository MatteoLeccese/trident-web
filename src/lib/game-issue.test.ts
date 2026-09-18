import { describe, expect, it } from "vitest";
import { issuedGame } from "./game-issue";

const GAME = { game_id: "00000000-0000-4000-8000-000000000001", version: 1 };

function envelope (data: unknown): unknown {
  return { status: 201, message: "Game created.", error: null, data };
}

describe("lifting the write credential out of a response", () => {
  it("keeps the token and the game it belongs to", () => {
    const issued = issuedGame(envelope({ game: GAME, controller_token: "a".repeat(64) }));

    expect(issued.token).toBe("a".repeat(64));
    expect(issued.gameId).toBe(GAME.game_id);
  });

  it("returns an envelope the browser can have, with the token gone", () => {
    const issued = issuedGame(envelope({ game: GAME, controller_token: "a".repeat(64) }));

    expect(issued.sanitised).toEqual({ status: 201, message: "Game created.", error: null, data: { game: GAME } });

    // Serialised, because that is the form the browser actually receives, and
    // asserted case-insensitively on the whole body: the credential must not
    // survive anywhere in it, under any key.
    expect(JSON.stringify(issued.sanitised).toLowerCase()).not.toContain("controller_token");
    expect(JSON.stringify(issued.sanitised)).not.toContain("a".repeat(64));
  });

  it("drops the key rather than blanking it", () => {
    const issued = issuedGame(envelope({ game: GAME, controller_token: "a".repeat(64) }));
    const data = (issued.sanitised as { data: Record<string, unknown>; }).data;

    expect(Object.keys(data)).toEqual([ "game" ]);
  });

  it("carries the game through even when no token came with it", () => {
    const issued = issuedGame(envelope({ game: GAME }));

    expect(issued.token).toBeNull();
    expect(issued.sanitised).toEqual({ status: 201, message: "Game created.", error: null, data: { game: GAME } });
  });

  it("reports no token for one that is not a usable string", () => {
    expect(issuedGame(envelope({ game: GAME, controller_token: "" })).token).toBeNull();
    expect(issuedGame(envelope({ game: GAME, controller_token: 7 })).token).toBeNull();
  });

  it("passes a body that is not the envelope straight through", () => {
    // A failure the client has to see, and it carries no token to leak.
    expect(issuedGame(null)).toEqual({ token: null, gameId: null, sanitised: null });
    expect(issuedGame("<html>502</html>").sanitised).toBe("<html>502</html>");
    expect(issuedGame({ status: 502 }).sanitised).toEqual({ status: 502 });
  });

  it("reports no game when the payload has no game id to tie the token to", () => {
    // Without an id there is nothing to remember the token under, and storing it
    // against the wrong game would let one phone write to another's.
    const issued = issuedGame(envelope({ game: { version: 1 }, controller_token: "a".repeat(64) }));

    expect(issued.gameId).toBeNull();
  });
});
