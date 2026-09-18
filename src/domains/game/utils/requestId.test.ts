import { describe, expect, it } from "vitest";
import { newRequestId } from "./requestId";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newRequestId", () => {
  it("mints the shape the backend's ledger column takes", () => {
    // `game_moves.request_id` is a uuid column; anything else comes back
    // 422 request_id_invalid before the write is applied.
    expect(newRequestId()).toMatch(UUID_V4);
  });

  it("mints a different one every time", () => {
    const minted = new Set(Array.from({ length: 500 }, newRequestId));

    expect(minted.size).toBe(500);
  });

  it("never reaches for crypto.randomUUID", () => {
    // It is a secure-context API and this runs over plain HTTP on a home LAN,
    // where it is simply not there.
    const randomUUID = Object.getOwnPropertyDescriptor(crypto, "randomUUID");

    Object.defineProperty(crypto, "randomUUID", {
      configurable: true,
      value: () => {
        throw new Error("randomUUID is not available over plain HTTP.");
      },
    });

    try {
      expect(newRequestId()).toMatch(UUID_V4);
    } finally {
      if (randomUUID === undefined) {
        Reflect.deleteProperty(crypto, "randomUUID");
      } else {
        Object.defineProperty(crypto, "randomUUID", randomUUID);
      }
    }
  });
});
