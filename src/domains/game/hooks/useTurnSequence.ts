"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { isApiError } from "@/domains/core/types/api-error";
import { gameApi } from "@/domains/game/services/gameApi";
import type { GameState } from "@/domains/game/types";
import {
  type TurnSequence,
  initialTurnSequence,
  turnSequenceReducer,
} from "@/domains/game/utils/turnSequence";
import { messageForError } from "@/lib/error-codes";

/**
 * The phone's turn, wired to the one write it makes.
 *
 * The machine itself is pure and lives in `turnSequence.ts`; this adds the
 * network to exactly one of its transitions. Everything after the snapshot
 * lands is client state over bytes already in hand.
 *
 * The write names the version the phone read. A refusal comes back carrying the
 * current state, which is applied and not discarded, so the phone converges from
 * the refusal itself rather than asking a person to refresh — and it lands back
 * on the board, with something to read, instead of on a result for a draw that
 * did not happen.
 */

export interface TurnControls {
  sequence: TurnSequence;

  /** A tap on a position. The tile reacts before anything reaches the network. */
  tap: (position: number) => void;

  cancel: () => void;

  /** The one transition that writes. */
  confirm: () => void;

  /** The human tap that moves the result on, and then the hand-off. */
  advance: () => void;

  /**
   * The human tap that closes a result there is no next turn after: the draw
   * that finished the game, or the one that parked it on a question.
   */
  dismiss: () => void;
}

interface Options {
  gameId: string;
  state: GameState | null;
  receive: (incoming: GameState) => void;
}

export function useTurnSequence ({ gameId, state, receive }: Options): TurnControls {
  const [ sequence, dispatch ] = useReducer(turnSequenceReducer, initialTurnSequence);

  // The handlers must read the newest state without being rebuilt by every frame
  // that arrives, or a tap would be wired to a snapshot two versions old.
  const latest = useRef<GameState | null>(state);
  const receiveRef = useRef(receive);

  /**
   * Closed the instant a write leaves and opened when it is answered.
   *
   * The reducer's phase cannot do this job: two taps inside one React batch both
   * read the same phase, so both would pass a guard written against it, and two
   * intentions mean two request ids and two tiles turned over. A ref changes
   * before the second tap is handled.
   */
  const inFlight = useRef(false);

  useEffect(() => {
    latest.current = state;
    receiveRef.current = receive;
  });

  const status = state?.status ?? null;

  /** The status this phone last saw, so the sequence can react to a change of it. */
  const seenStatus = useRef(status);

  useEffect(() => {
    const before = seenStatus.current;

    seenStatus.current = status;

    /*
     * Play has just begun on the phone that began it. It is in the organiser's
     * hand and the first seat's name is on the screen, so the first turn is
     * gated like the other ninety-seven.
     *
     * Only on the transition this phone watched: a phone that reloads into a
     * game already in play has not just been handed to anybody, and it lands on
     * the board with the cursor's name, which is correct.
     */
    if (before === "lobby" && status === "running") {
      dispatch({ type: "opened" });

      return;
    }

    /*
     * A game that is no longer in play has no turn on the phone, with one
     * exception: a result that is on screen has to be read. The draw that
     * finishes a game is the same write that carries that tile's two challenges
     * (TR-34, TR-38) and no later frame carries them, so resetting here would
     * take the last two things the table is asked for off the screen in the
     * frame they arrived in. The board is not mounted in `result`, so nothing is
     * held hostage; the person taps through it.
     */
    if (status !== null && status !== "running" && sequence.phase !== "result") {
      dispatch({ type: "reset" });
    }
  }, [ status, sequence.phase ]);

  const tap = useCallback((position: number) => {
    dispatch({ type: "tap", position, holder: latest.current?.current_seat ?? null });
  }, []);

  const cancel = useCallback(() => dispatch({ type: "cancel" }), []);

  const advance = useCallback(() => dispatch({ type: "advance" }), []);

  const dismiss = useCallback(() => dispatch({ type: "reset" }), []);

  const confirm = useCallback(() => {
    const current = latest.current;
    const position = sequence.position;

    if (current === null || position === null || sequence.phase !== "confirming" || inFlight.current) {
      return;
    }

    inFlight.current = true;
    dispatch({ type: "confirm" });

    void (async () => {
      try {
        const result = await gameApi.draw(gameId, position, current.version);

        receiveRef.current(result.state);

        if (result.conflicted) {
          dispatch({ type: "refused", notice: "The game had already moved on. Here is the board again." });

          return;
        }

        dispatch({ type: "drawn", version: result.state.version });
      } catch (caught: unknown) {
        dispatch({
          type: "refused",
          notice: isApiError(caught) ? messageForError(caught) : "We could not turn that one over.",
        });
      } finally {
        inFlight.current = false;
      }
    })();
  }, [ gameId, sequence.phase, sequence.position ]);

  return { sequence, tap, cancel, confirm, advance, dismiss };
}
