"use client";

import { useEffect, useReducer, useRef } from "react";

/** What the socket reports about itself, before anybody decides whether to believe it. */
export type ChannelStatus = "connecting" | "connected" | "offline";

interface Settling {

  /** What the screen is told, which is not always what the socket just said. */
  reported: ChannelStatus;

  /** Whether this socket has ever been up. The first handshake is not a recovery. */
  everConnected: boolean;

  /** Whether a claim of health is currently serving its waiting period. */
  settling: boolean;
}

type SettlingEvent = { type: "raw"; status: ChannelStatus; } | { type: "settled"; };

function settlingReducer (state: Settling, event: SettlingEvent): Settling {
  if (event.type === "settled") {
    return state.settling ? { ...state, reported: "connected", settling: false } : state;
  }

  if (event.status !== "connected") {
    // Trouble is reported the instant it is claimed. A screen that were slow
    // here would keep a room reading a frozen board under a green dot.
    return { reported: event.status, everConnected: state.everConnected, settling: false };
  }

  if (!state.everConnected) {
    // The first handshake of the page is not a recovery from anything, and
    // holding it back would make every healthy load spend the waiting period
    // telling the room it is still connecting.
    return { reported: "connected", everConnected: true, settling: false };
  }

  // A reconnection has to earn it: the previous answer stands until this one has
  // held for the whole window.
  return { ...state, settling: true };
}

/**
 * The socket's own status, smoothed — **slow to claim health, instant to admit
 * trouble.**
 *
 * A socket on a bad network does not fail, it flaps: connected, unavailable,
 * connecting, connected, several times a minute. Two things read that signal and
 * both are damaged by the flapping.
 *
 * The first is the room. A badge that alternates between "Live" and "Offline"
 * every few seconds teaches a table that the screen is unreliable, which is the
 * opposite of what a badge is for.
 *
 * The second is worse and invisible: **the phone's rescue poll is switched off
 * whenever the socket claims to be connected.** A socket that comes up for one
 * second and drops again therefore takes away the only recovery the phone has,
 * and it does so exactly when the network is at its worst. Making the claim of
 * health wait is what keeps the poll running through a flapping connection.
 *
 * Nothing about a drop is delayed. The asymmetry is the design: a screen may be
 * slow to say it is fine and must never be slow to say it is not.
 */
export function useSettledStatus (raw: ChannelStatus, holdMs: number): ChannelStatus {
  const [ state, dispatch ] = useReducer(settlingReducer, {
    reported: raw,
    everConnected: raw === "connected",
    settling: false,
  });

  /** What the socket last said, so a change of it can be reacted to. */
  const seen = useRef<ChannelStatus | null>(null);

  useEffect(() => {
    if (seen.current === raw) {
      return;
    }

    seen.current = raw;

    dispatch({ type: "raw", status: raw });
  }, [ raw ]);

  useEffect(() => {
    if (!state.settling) {
      return;
    }

    const timer = setTimeout(() => dispatch({ type: "settled" }), holdMs);

    return () => clearTimeout(timer);
  }, [ state.settling, holdMs ]);

  return state.reported;
}
