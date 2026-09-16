"use client";

import { useEffect, useState } from "react";
import Echo from "laravel-echo";
import Pusher from "pusher-js";
import type { GameState } from "@/domains/game/types";

export type ChannelStatus = "connecting" | "connected" | "offline";

interface Options {
  gameId: string;
  onState: (state: GameState) => void;

  /** Called on (re)connect: reconnection resyncs through the same route as the load. */
  onReconnect: () => void;
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
export function useGameChannel ({ gameId, onState, onReconnect }: Options): ChannelStatus {
  const [ status, setStatus ] = useState<ChannelStatus>("connecting");

  useEffect(() => {
    if (gameId === "") {
      return;
    }

    const echo = new Echo({
      broadcaster: "reverb",
      Pusher,
      key: process.env.NEXT_PUBLIC_REVERB_APP_KEY ?? "",
      wsHost: process.env.NEXT_PUBLIC_REVERB_HOST ?? window.location.hostname,
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

    echo.join(`game.${gameId}`).listen(".GameStateChanged", (payload: GameState) => {
      onState(payload);
    });

    return () => {
      echo.leave(`game.${gameId}`);
      // `leave` does not close the socket: without this, one connection leaks per mount.
      echo.disconnect();
    };
  }, [ gameId, onState, onReconnect ]);

  return status;
}
