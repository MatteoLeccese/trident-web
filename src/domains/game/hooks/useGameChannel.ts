"use client";

import { useEffect, useState } from "react";
import Echo from "laravel-echo";
import Pusher from "pusher-js";
import { type ChannelStatus, useSettledStatus } from "@/domains/game/hooks/useSettledStatus";

export type { ChannelStatus };

/**
 * How long a reconnection has to hold before the screen believes it.
 *
 * Ten seconds is longer than the flap of a phone changing cell and shorter than
 * anybody waits before tapping again.
 */
const SETTLE_MS = 10_000;

interface Options {
  gameId: string;

  /**
   * Untyped on purpose: what arrives here is whatever came down the socket. The
   * receiver checks it before it can replace the state of a table in play.
   */
  onState: (state: unknown) => void;

  /** Called on (re)connect: reconnection resyncs through the same route as the load. */
  onReconnect: () => void;

  /**
   * Whether this screen still has anything to hear.
   *
   * False once the game has reached a terminal status: the state can never
   * change again, so the socket is closed rather than held open all night for a
   * frame that is not coming. The status stops moving with it, which is honest —
   * on a game that has ended, "is this screen current?" is answered permanently.
   */
  enabled?: boolean;
}

/**
 * Subscription to a game's presence channel.
 *
 * Notes that are not style but correctness, verified against the pusher-js and
 * laravel-echo source:
 *
 * - `broadcaster: "reverb"` is the driver; the `key` is the app key, NOT the
 *   string "reverb" (the old system confused the two and could not work).
 * - `forceTLS: false` **literal**: `shouldUseTLS` returns true unless it is
 *   exactly false.
 * - `enabledTransports: ["ws"]` because, without narrowing them down, the
 *   sockjs/xhr fallbacks stay active, and their default host is
 *   `sockjs.pusher.com`: a dead socket on the LAN would spend seconds calling
 *   out to the internet.
 * - `authEndpoint` points at the same-origin BFF, because pusher-js does not
 *   send credentials to another origin and the cookie would not travel.
 */
function reverbHost (): string {
  const configured = process.env.NEXT_PUBLIC_REVERB_HOST;

  return configured !== undefined && configured !== ""
    ? configured
    : window.location.hostname;
}

export function useGameChannel ({ gameId, onState, onReconnect, enabled = true }: Options): ChannelStatus {
  const [ status, setStatus ] = useState<ChannelStatus>("connecting");

  useEffect(() => {
    if (gameId === "" || !enabled) {
      return;
    }

    const echo = new Echo({
      broadcaster: "reverb",
      Pusher,
      key: process.env.NEXT_PUBLIC_REVERB_APP_KEY ?? "",
      // Deliberately falls back to the host the page was loaded from. A
      // NEXT_PUBLIC_ variable is inlined at build time, so pinning the LAN IP
      // there would mean rebuilding the image every time the network changes.
      // The browser already knows where it came from.
      wsHost: reverbHost(),
      wsPort: Number(process.env.NEXT_PUBLIC_REVERB_PORT ?? 8080),
      forceTLS: false,
      enabledTransports: [ "ws" ],
      disableStats: true,
      authEndpoint: "/api/realtime/auth",
    });

    const connection = echo.connector.pusher.connection;

    connection.bind("connected", () => {
      setStatus("connected");
      onReconnect();
    });
    connection.bind("connecting", () => setStatus("connecting"));
    connection.bind("unavailable", () => setStatus("offline"));
    connection.bind("failed", () => setStatus("offline"));
    connection.bind("disconnected", () => setStatus("offline"));

    echo.join(`game.${gameId}`).listen(".GameStateChanged", (payload: unknown) => {
      onState(payload);
    });

    return () => {
      echo.leave(`game.${gameId}`);
      // `leave` does not close the socket: without this, one connection leaks per mount.
      echo.disconnect();
    };
  }, [ gameId, onState, onReconnect, enabled ]);

  /*
   * `onReconnect` fires on the RAW event above and never on the settled one: a
   * screen that has just reconnected should resync immediately, whether or not
   * it is willing to say out loud yet that it is healthy. Only what the room is
   * told is smoothed.
   */
  return useSettledStatus(status, SETTLE_MS);
}
