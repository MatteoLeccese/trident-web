import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Session } from "@/domains/core/types";

interface AppState {
  session: Session | null;
  setSession: (session: Session) => void;
  clearSession: () => void;
}

/**
 * The single global store. It holds only cross-cutting session context.
 *
 * It never holds server data (the game state lives in the screen's `useState`)
 * and it NEVER holds a credential: the `controller_token` is in an httpOnly
 * cookie and no copy of it whatsoever must exist in JavaScript.
 */
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
      clearSession: () => set({ session: null }),
    }),
    {
      name: "trident-app",
      storage: createJSONStorage(() => localStorage),
      // Explicit whitelist of what gets persisted.
      partialize: (state) => ({ session: state.session }),
    },
  ),
);

/** Non-reactive access, for use outside React (interceptors). */
export const getAppState = (): AppState => useAppStore.getState();
