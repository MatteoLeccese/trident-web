"use client";

import { useEffect, useReducer, useRef } from "react";

interface Beat {

  /** The version whose cards are being shown, or null when nothing is. */
  version: number | null;
}

type BeatEvent = { type: "fired"; version: number; } | { type: "over"; };

const NOTHING: Beat = { version: null };

function cardBeatReducer (_beat: Beat, event: BeatEvent): Beat {
  return event.type === "fired" ? { version: event.version } : NOTHING;
}

/**
 * Whether the television is currently showing the cards a draw just fired.
 *
 * **The board and the cards stopped sharing the screen.** They used to sit in
 * two columns, and on a television that costs the board a quarter of its tile —
 * and on a 720p set it cost the room the bottom of the board entirely, because
 * the two-column layout answered by scrolling and nobody scrolls a television.
 * Now the board has the whole screen and the cards are painted over it for a
 * beat when they fire, where they have the whole screen too.
 *
 * Nothing is lost when the beat ends. The phone is holding the same cards on its
 * result screen until somebody taps through it, so the copy that has to persist
 * is in a hand, and the one that has to be seen by a room is on the wall.
 *
 * It is keyed on the version and not on the effects: two draws can fire the same
 * two challenges, and a beat that compared the cards would not restage the
 * second one.
 */
export function useCardBeat (version: number, hasCards: boolean, holdMs: number): boolean {
  const [ beat, dispatch ] = useReducer(cardBeatReducer, NOTHING);

  /** The version this screen last reacted to, so a new one can be spotted. */
  const seen = useRef<number | null>(null);

  useEffect(() => {
    if (seen.current === version) {
      return;
    }

    const first = seen.current === null;

    seen.current = version;

    /*
     * The first version a screen ever sees is not a draw it watched happen: a
     * television opened halfway through an evening would otherwise announce
     * whatever the last table did as though it had just happened.
     */
    if (first || !hasCards) {
      dispatch({ type: "over" });

      return;
    }

    dispatch({ type: "fired", version });
  }, [ version, hasCards ]);

  useEffect(() => {
    if (beat.version === null) {
      return;
    }

    const timer = setTimeout(() => dispatch({ type: "over" }), holdMs);

    return () => clearTimeout(timer);
  }, [ beat.version, holdMs ]);

  return beat.version !== null;
}
