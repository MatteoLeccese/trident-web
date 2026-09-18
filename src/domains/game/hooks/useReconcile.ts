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
 * - **Coming back into view.** The phone was locked and has been handed to
 *   somebody else; the television woke up.
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

  /** Milliseconds between polls, or null to poll not at all. */
  everyMs: number | null;
}

export function useReconcile ({ resync, everyMs }: Options): void {
  const latest = useRef(resync);

  useEffect(() => {
    latest.current = resync;
  });

  useEffect(() => {
    if (everyMs === null || everyMs <= 0) {
      return;
    }

    const timer = setInterval(() => latest.current(), everyMs);

    return () => clearInterval(timer);
  }, [ everyMs ]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        latest.current();
      }
    };

    document.addEventListener("visibilitychange", onVisible);

    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
}
