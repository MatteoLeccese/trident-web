import { beforeEach, describe, expect, it } from "vitest";
import { getAppState, useAppStore } from "./useAppStore";

beforeEach(() => {
  useAppStore.setState({ session: null });
  window.localStorage.clear();
});

describe("useAppStore", () => {
  it("starts with no session", () => {
    expect(useAppStore.getState().session).toBeNull();
  });

  it("remembers the session handed back by the BFF", () => {
    useAppStore.getState().setSession({ gameId: "abc", role: "controller" });

    expect(useAppStore.getState().session).toEqual({ gameId: "abc", role: "controller" });
  });

  it("clears the session", () => {
    useAppStore.getState().setSession({ gameId: "abc", role: "spectator" });
    useAppStore.getState().clearSession();

    expect(useAppStore.getState().session).toBeNull();
  });

  it("exposes a non-reactive accessor for use outside React", () => {
    // The axios interceptors read the store without subscribing to it.
    useAppStore.getState().setSession({ gameId: "abc", role: "controller" });

    expect(getAppState().session?.gameId).toBe("abc");
  });

  it("persists only the session, never anything else", () => {
    useAppStore.getState().setSession({ gameId: "abc", role: "controller" });

    const persisted = window.localStorage.getItem("trident-app");

    expect(persisted).not.toBeNull();
    expect(Object.keys(JSON.parse(persisted as string).state)).toEqual([ "session" ]);
  });

  it("never persists a credential", () => {
    // The controller_token lives ONLY in an httpOnly cookie. If it shows up
    // in localStorage, any script on the page can steal the game.
    useAppStore.getState().setSession({ gameId: "abc", role: "controller" });

    const dump = JSON.stringify(window.localStorage);

    expect(dump).not.toMatch(/token/i);
    expect(dump).not.toMatch(/secret/i);
  });
});
