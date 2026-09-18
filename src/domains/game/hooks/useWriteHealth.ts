"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  type WriteHealth,
  resetWriteHealth,
  subscribeToWriteHealth,
  writeHealthServerSnapshot,
  writeHealthSnapshot,
} from "@/domains/game/services/writeHealth";

/**
 * Whether the server is still answering this phone's writes.
 *
 * It resets when the phone moves to another game, because a rematch is a new
 * table: carrying the previous game's last failure onto it would paint a fresh
 * lobby as broken before anybody had typed a name.
 */
export function useWriteHealth (gameId: string): WriteHealth {
  useEffect(() => {
    resetWriteHealth();

    return () => resetWriteHealth();
  }, [ gameId ]);

  return useSyncExternalStore(subscribeToWriteHealth, writeHealthSnapshot, writeHealthServerSnapshot);
}
