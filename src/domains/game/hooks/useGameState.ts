"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isApiError } from "@/domains/core/types/api-error";
import { messageForError } from "@/lib/error-codes";
import { gameApi } from "@/domains/game/services/gameApi";
import type { GameState } from "@/domains/game/types";
import { applyGameState } from "@/domains/game/utils/applyGameState";

interface UseGameState {
  state: GameState | null;
  error: string | null;
  loading: boolean;

  /** Asks the server for the state again. Same route as the initial load. */
  resync: () => Promise<void>;

  /** Delivers a state that arrived over the socket, subject to the version guard. */
  receive: (incoming: GameState) => void;
}

export function useGameState (gameId: string): UseGameState {
  const [ state, setState ] = useState<GameState | null>(null);
  const [ error, setError ] = useState<string | null>(null);
  const [ loading, setLoading ] = useState(true);

  // The guard needs the last **confirmed** state without re-creating the
  // callbacks. It is synced in an effect and not during the render: writing a
  // ref while rendering is exactly what React forbids.
  const latest = useRef<GameState | null>(null);

  useEffect(() => {
    latest.current = state;
  }, [ state ]);

  const resync = useCallback(async () => {
    try {
      const fresh = await gameApi.get(gameId);

      setState(applyGameState(latest.current, fresh).state);
      setError(null);
    } catch (caught: unknown) {
      setError(isApiError(caught) ? messageForError(caught) : "No hemos podido cargar la partida.");
    } finally {
      setLoading(false);
    }
  }, [ gameId ]);

  const receive = useCallback((incoming: GameState) => {
    const result = applyGameState(latest.current, incoming);

    setState(result.state);

    // There was a gap: what arrived was applied, but something may be missing.
    if (result.needsResync) {
      void resync();
    }
  }, [ resync ]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!cancelled) {
        await resync();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ resync ]);

  return { state, error, loading, resync, receive };
}
