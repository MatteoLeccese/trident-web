"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isApiError } from "@/domains/core/types/api-error";
import { messageForError } from "@/lib/error-codes";
import { gameApi } from "@/domains/game/services/gameApi";
import type { GameState } from "@/domains/game/types";
import { applyGameState } from "@/domains/game/utils/applyGameState";
import { isGameState } from "@/domains/game/utils/isGameState";

interface UseGameState {
  state: GameState | null;
  error: string | null;
  loading: boolean;

  /** Asks the server for the state again. Same route as the initial load. */
  resync: () => Promise<void>;

  /** Delivers a state that arrived over the socket, subject to the version guard. */
  receive: (incoming: unknown) => void;
}

export function useGameState (gameId: string): UseGameState {
  const [ state, setState ] = useState<GameState | null>(null);
  const [ error, setError ] = useState<string | null>(null);
  const [ loading, setLoading ] = useState(true);

  /**
   * The guard's baseline: the newest state that has been **applied**, which is
   * not the same thing as the newest state that has been committed.
   *
   * It is written the moment a snapshot is accepted, and never only in an effect
   * after the commit. Two deliveries can land inside one commit window — a
   * socket frame and the poll's answer, or a write's answer and the frame the
   * same write broadcast — and a baseline that is a commit behind compares both
   * against the same older version, so the second one passes the guard whatever
   * its version and an older frame wins. Dropping a frame that is older or equal
   * has to be a property of this hook and not only of the pure function
   * underneath it (documentation/conventions/state-versioning.md).
   *
   * Writing it from a callback is not writing it during a render, which is the
   * thing React forbids.
   */
  const latest = useRef<GameState | null>(null);

  /** Whether a read is already on its way, so the recovery paths cannot stack up. */
  const reading = useRef(false);

  /** The one place a snapshot is accepted. @returns whether a frame went missing. */
  const apply = useCallback((incoming: GameState): boolean => {
    const result = applyGameState(latest.current, incoming);

    latest.current = result.state;
    setState(result.state);

    return result.needsResync;
  }, []);

  const resync = useCallback(async () => {

    /*
     * One read at a time.
     *
     * Every recovery path calls this — the interval, waking up, coming back
     * online, a frame with a gap in it, a frame that was not a snapshot — and
     * the request's own timeout is longer than the phone's three-second poll, so
     * without this they stack up: several reads of the same game in flight at
     * once, each spending the table's shared rate limit, and each racing the
     * others to write its answer back. Dropping the second call is right rather
     * than merely cheap, because the one already in flight is asking exactly the
     * same question and its answer will be at least as new.
     */
    if (reading.current) {
      return;
    }

    reading.current = true;

    try {
      const fresh = await gameApi.get(gameId);

      // A read that was in flight while a newer frame arrived must not write its
      // own older answer back over it.
      apply(fresh);
      setError(null);
    } catch (caught: unknown) {
      setError(isApiError(caught) ? messageForError(caught) : "We could not load the game.");
    } finally {
      reading.current = false;
      setLoading(false);
    }
  }, [ apply, gameId ]);

  const receive = useCallback((incoming: unknown) => {

    /*
     * The socket is the one path where a payload is typed by assertion and not
     * by the compiler, so it is checked before it can replace the state of a
     * table in play. A frame that is not a snapshot asks the server instead:
     * every payload is a full snapshot, so the state still converges, which is
     * the same self-healing a lost frame takes.
     */
    if (!isGameState(incoming)) {
      void resync();

      return;
    }

    // There was a gap: what arrived was applied, but something may be missing.
    if (apply(incoming)) {
      void resync();
    }
  }, [ apply, resync ]);

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
