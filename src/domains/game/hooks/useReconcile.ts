"use client";

import { useEffect, useRef } from "react";

/**
 * Asking the server again, on the two occasions a client cannot know it missed
 * something.
 *
 * Both are the same call the page load makes, through the same version guard, so
 * the recovery path is exercised every time a screen opens and never sits in a
 * branch nobody runs.
 *
 * - **A poll.** The television polls unconditionally, because a dead Reverb, a
 *   NAT rebind and a socket that keeps reporting itself connected while it
 *   swallows frames all look identical from the sofa; with the poll they all
 *   degrade to one interval of delay instead of to a frozen screen. The phone
 *   polls only while its socket is down, because its battery is the constraint
 *   and every write already answers with a fresh snapshot.
 * - **Coming back.** The phone was locked and has been handed to somebody else;
 *   the television woke up; the wifi came back. Three different events, because
 *   they are three different things: a laptop that wakes from sleep with the lid
 *   already open changes no visibility, and a network that returns changes
 *   neither.
 *
 * **Neither runs on a game that has ended.** A terminal snapshot is the last one
 * there will ever be, so both screens would otherwise spend the rest of the
 * night asking for it again and throwing the answer away at the version guard.
 */

/**
 * How often to poll, from a deployment value that may be anything at all.
 *
 * The television's poll is the one recovery that does not need the client to
 * know something went wrong, so a misconfigured value must never switch it off
 * and never turn it into a hot loop. `Number("")` is 0, which would install no
 * interval, and `Number("30s")` is NaN, which passes a `> 0` test and reaches
 * `setInterval` as no delay at all. Anything that is not a positive, finite
 * number falls back to the documented interval.
 */
export function pollIntervalMs (raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);

  return raw !== undefined && raw.trim() !== "" && Number.isFinite(parsed) && parsed > 0
    ? parsed
    : fallback;
}

interface Options {
  resync: () => void;

  /**
   * Milliseconds between polls, or null to poll not at all.
   *
   * Null is the phone with a healthy socket: it has no interval and still wants
   * to be told when it comes back, which is why that case is separate from
   * `enabled`.
   */
  everyMs: number | null;

  /**
   * Whether this screen can still learn anything.
   *
   * False on a game that has reached a terminal status: that snapshot is the
   * last one there will ever be, so neither the interval nor waking up has
   * anything to ask for.
   */
  enabled?: boolean;
}

export function useReconcile ({ resync, everyMs, enabled = true }: Options): void {
  const latest = useRef(resync);

  useEffect(() => {
    latest.current = resync;
  });

  useEffect(() => {
    if (!enabled || everyMs === null || everyMs <= 0) {
      return;
    }

    const timer = setInterval(() => latest.current(), everyMs);

    return () => clearInterval(timer);
  }, [ enabled, everyMs ]);

  useEffect(() => {
    if (!enabled) {
      // Nothing left to reconcile with: a screen whose game has ended holds the
      // final state and no event can produce another one.
      return;
    }

    const wake = () => {
      if (document.visibilityState === "visible") {
        latest.current();
      }
    };

    /*
     * `pageshow` rather than `load`: a phone restored from the back/forward
     * cache fires no navigation at all, and it is restored holding a snapshot
     * from whenever it was put away.
     */
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    window.addEventListener("pageshow", wake);

    return () => {
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
      window.removeEventListener("pageshow", wake);
    };
  }, [ enabled ]);
}
