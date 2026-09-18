"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isApiError } from "@/domains/core/types/api-error";
import type { MutationResult } from "@/domains/game/services/writeProtocol";
import type { GameState } from "@/domains/game/types";
import { messageForError } from "@/lib/error-codes";

/**
 * One write, with the two things every control that makes one needs: whether it
 * is in flight, and what to say when it was refused.
 *
 * Every write returns a snapshot — the one it produced, or, when it was refused
 * as stale, the current one — and both go through the version guard. That is the
 * healing: a phone that fell behind converges from the refusal itself instead of
 * asking a person to refresh.
 *
 * The control stays disabled for the whole call, retries included, so the person
 * is never the retry mechanism.
 */

export interface Write {
  pending: boolean;
  error: string | null;

  /** Runs the write and answers whether it landed as asked. */
  run: (call: () => Promise<MutationResult>) => Promise<boolean>;

  clear: () => void;
}

export function useWrite (receive: (state: GameState) => void): Write {
  const [ pending, setPending ] = useState(false);
  const [ error, setError ] = useState<string | null>(null);
  const receiveRef = useRef(receive);
  const alive = useRef(true);

  useEffect(() => {
    receiveRef.current = receive;
  });

  useEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(async (call: () => Promise<MutationResult>): Promise<boolean> => {
    setPending(true);
    setError(null);

    try {
      const result = await call();

      receiveRef.current(result.state);

      if (result.conflicted) {
        if (alive.current) {
          setError("The game had already moved on. Try that again.");
        }

        return false;
      }

      return true;
    } catch (caught: unknown) {
      if (alive.current) {
        setError(isApiError(caught) ? messageForError(caught) : "We could not save that.");
      }

      return false;
    } finally {
      if (alive.current) {
        setPending(false);
      }
    }
  }, []);

  return { pending, error, run, clear: useCallback(() => setError(null), []) };
}
