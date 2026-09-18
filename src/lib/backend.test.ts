import { describe, expect, it } from "vitest";
import { buildBackendUrl, forwardableHeaders } from "./backend";

const BASE = "http://127.0.0.1:8000/api/v1";

describe("buildBackendUrl", () => {
  it("joins the catch-all segments onto the backend base", () => {
    expect(buildBackendUrl(BASE, [ "games" ], "")).toBe(`${BASE}/games`);
    expect(buildBackendUrl(BASE, [ "games", "abc", "seats", "3" ], "")).toBe(`${BASE}/games/abc/seats/3`);
  });

  it("preserves the query string", () => {
    expect(buildBackendUrl(BASE, [ "games" ], "?code=K7QP3M")).toBe(`${BASE}/games?code=K7QP3M`);
  });

  it("refuses to climb out of the api prefix", () => {
    // Without this, /api/proxy/../../admin would reach any route of the backend.
    const attacks = [
      [ "..", "admin" ],
      [ "games", "..", "..", "admin" ],
      [ "." ],
      [ "games", ".." ],
    ];

    for (const segments of attacks) {
      expect(() => buildBackendUrl(BASE, segments, "")).toThrow();
    }
  });

  it("refuses an absolute url smuggled in as a segment", () => {
    // An SSRF: the proxy carries the credential, so it cannot point at another host.
    const attacks = [
      [ "http://evil.test/steal" ],
      [ "//evil.test/steal" ],
      [ "games", "http://evil.test" ],
    ];

    for (const segments of attacks) {
      expect(() => buildBackendUrl(BASE, segments, "")).toThrow();
    }
  });

  it("refuses segments containing a backslash or a control character", () => {
    const nullByte = String.fromCharCode(0);

    expect(() => buildBackendUrl(BASE, [ "games\\..\\admin" ], "")).toThrow();
    expect(() => buildBackendUrl(BASE, [ `games${nullByte}` ], "")).toThrow();
  });

  it("refuses an empty segment list", () => {
    expect(() => buildBackendUrl(BASE, [], "")).toThrow();
  });

  it("accepts every shape a real route of this API uses", () => {
    // Every path of the backend, written out rather than assumed: the whitelist
    // is strict enough that a hyphen in a new segment is worth a test.
    const id = "0f8fad5b-d9cb-469f-a165-70867728950e";
    const real = [
      [ "health" ],
      [ "games" ],
      [ "games", id ],
      [ "games", "by-code", "K7QP3M" ],
      [ "games", id, "room-config-spec" ],
      [ "games", id, "seats", "3" ],
      [ "games", id, "seats", "order" ],
      [ "games", id, "room-config" ],
      [ "games", id, "start" ],
      [ "games", id, "pool", "36", "draw" ],
      [ "games", id, "play-again" ],
      [ "broadcasting", "auth" ],
    ];

    for (const segments of real) {
      expect(() => buildBackendUrl(BASE, segments, "")).not.toThrow();
    }
  });

  it("refuses anything outside that whitelist, including spaces and percent-encoding", () => {
    // A strict whitelist on purpose: no route of this API needs more, and what
    // is left over is exactly where an SSRF or a traversal gets in.
    const rejected = [ "a b", "a%2e%2e", "a/b", "a?b", "a#b", "a%00" ];

    for (const segment of rejected) {
      expect(() => buildBackendUrl(BASE, [ segment ], "")).toThrow();
    }
  });
});

describe("forwardableHeaders", () => {
  it("forwards the write intention, which the idempotency ledger is keyed by", () => {
    // Without this header crossing the proxy, every retry would be a new
    // intention and a double tap would turn two tiles over.
    const forwarded = forwardableHeaders(new Headers({ "x-request-id": "2bf1d0a0-0b9a-4f1e-8a34-4a1f4a2d1c77" }));

    expect(forwarded.get("x-request-id")).toBe("2bf1d0a0-0b9a-4f1e-8a34-4a1f4a2d1c77");
  });

  it("forwards only what the backend needs", () => {
    const incoming = new Headers({
      "content-type": "application/json",
      accept: "application/json",
      "x-request-id": "req-1",
    });

    const forwarded = forwardableHeaders(incoming);

    expect(forwarded.get("content-type")).toBe("application/json");
    expect(forwarded.get("accept")).toBe("application/json");
    expect(forwarded.get("x-request-id")).toBe("req-1");
  });

  it("never forwards a credential supplied by the browser", () => {
    // The server injects the credential from the httpOnly cookie.
    // If the browser could send its own, the whole model falls apart.
    const incoming = new Headers({
      cookie: "trident_controller=secret",
      authorization: "Bearer injected",
      "x-trident-controller-token": "stolen",
    });

    const forwarded = forwardableHeaders(incoming);

    expect(forwarded.get("cookie")).toBeNull();
    expect(forwarded.get("authorization")).toBeNull();
    expect(forwarded.get("x-trident-controller-token")).toBeNull();
  });

  it("never forwards hop-by-hop or spoofable routing headers", () => {
    const incoming = new Headers({
      host: "evil.test",
      "x-forwarded-for": "1.2.3.4",
      connection: "keep-alive",
    });

    const forwarded = forwardableHeaders(incoming);

    expect(forwarded.get("host")).toBeNull();
    expect(forwarded.get("x-forwarded-for")).toBeNull();
    expect(forwarded.get("connection")).toBeNull();
  });
});
