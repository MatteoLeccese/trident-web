"use client";

import { useEffect, useReducer, useRef } from "react";

/**
 * Where a screen stands with respect to the end of the game.
 *
 * `unknown` is the state of a screen that has no snapshot yet, and it is a case
 * of its own rather than a synonym for "not over": a screen that treated its own
 * loading frame as having watched a live game would stage the end of every game
 * it was ever opened on, including the ones that finished an hour before.
 */
export type EndPhase = "unknown" | "live" | "over";

interface Beat {

  /** Whether this screen has seen the game being played at all. */
  watched: boolean;

  /** Whether the turn that ended it is still holding the screen on its own. */
  holding: boolean;
}

type BeatEvent = { type: "live"; } | { type: "over"; } | { type: "released"; };

const initialBeat: Beat = { watched: false, holding: false };

function beatReducer (beat: Beat, event: BeatEvent): Beat {
  switch (event.type) {
    case "live":

      // A rematch runs through here too: the beat is armed again for the game
      // that follows, and the previous one is let go.
      return { watched: true, holding: false };

    case "over":

      // Only a screen that watched the game being played has a last turn to
      // hold. For any other, this is a game that ended before it arrived.
      return beat.watched ? { watched: true, holding: true } : beat;

    case "released":
      return beat.holding ? { ...beat, holding: false } : beat;

    default:
      return beat;
  }
}

/**
 * Whether the television is still holding the turn that ended the game.
 *
 * The write that turns over the last tile of the pool is the write that finishes
 * the game (TR-34), and it fires that tile's challenges like every other draw
 * (TR-38). Painted in the same frame as the record of the evening, the last
 * thing the table is asked for all night arrives beside a screen that says the
 * game is over, and the room reads the ending instead of the card. This holds
 * the last turn on its own first, and the record follows it.
 *
 * **It is armed by having watched the game end, never by the status alone.** A
 * television opened on a game that finished an hour ago has no last turn to
 * show, and lands on the record directly, with no animation of a moment nobody
 * in the room saw happen.
 *
 * It is the one duration on either screen that is not a hand. A television has
 * no hand to wait for and the phone's tap does not reach it: acknowledging a
 * card is not in the write protocol, and putting it there would cost a move kind
 * and a migration to synchronise an animation.
 */
export function useFinalBeat (phase: EndPhase, holdMs: number): boolean {
  const [ beat, dispatch ] = useReducer(beatReducer, initialBeat);

  /** The phase this screen last saw, so the beat can react to a change of it. */
  const seenPhase = useRef<EndPhase>("unknown");

  useEffect(() => {
    const before = seenPhase.current;

    seenPhase.current = phase;

    if (phase === "unknown" || phase === before) {
      return;
    }

    dispatch({ type: phase });
  }, [ phase ]);

  useEffect(() => {
    if (!beat.holding) {
      return;
    }

    const timer = setTimeout(() => dispatch({ type: "released" }), holdMs);

    return () => clearTimeout(timer);
  }, [ beat.holding, holdMs ]);

  return beat.holding;
}
