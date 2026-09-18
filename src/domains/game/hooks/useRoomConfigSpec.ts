"use client";

import { useEffect, useState } from "react";
import { gameApi } from "@/domains/game/services/gameApi";
import type { RoomConfigSpec } from "@/domains/game/types";

/**
 * The declaration the lobby form is generated from.
 *
 * It is read once per game and not watched: it belongs to the ruleset, carries
 * no version, and no write changes it, which is why it is a route of its own and
 * not a field of the snapshot.
 */
export function useRoomConfigSpec (gameId: string): { spec: RoomConfigSpec | null; failed: boolean; } {
  const [ spec, setSpec ] = useState<RoomConfigSpec | null>(null);
  const [ failed, setFailed ] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const loaded = await gameApi.roomConfigSpec(gameId);

        if (!cancelled) {
          setSpec(loaded);
        }
      } catch {
        if (!cancelled) {
          setFailed(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ gameId ]);

  return { spec, failed };
}
