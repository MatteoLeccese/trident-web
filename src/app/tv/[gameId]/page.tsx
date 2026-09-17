"use client";

import { use, useCallback, useEffect } from "react";
import { ConnectionBadge } from "@/domains/game/components/ConnectionBadge";
import { SeatList } from "@/domains/game/components/SeatList";
import { useGameChannel } from "@/domains/game/hooks/useGameChannel";
import { useGameState } from "@/domains/game/hooks/useGameState";

/** How often the TV reconciles no matter what. */
const RECONCILE_MS = Number(process.env.NEXT_PUBLIC_TRIDENT_RECONCILE_POLL_MS ?? 30_000);

export default function TvPage ({ params }: PageProps<"/tv/[gameId]">) {
  const { gameId } = use(params);
  const { state, error, loading, resync, receive } = useGameState(gameId);

  const status = useGameChannel({
    gameId,
    onState: receive,
    onReconnect: useCallback(() => void resync(), [ resync ]),
  });

  /**
   * Unconditional reconciliation.
   *
   * It is the most valuable operational decision in the plan: a Reverb that is
   * down, a NAT rebind, or a socket that pusher-js keeps reporting as connected
   * while it swallows frames all degrade to thirty seconds of delay, not to a
   * frozen screen. Any event-based scheme requires the client to KNOW that
   * something happened. This one does not.
   */
  useEffect(() => {
    const timer = setInterval(() => void resync(), RECONCILE_MS);

    return () => clearInterval(timer);
  }, [ resync ]);

  if (loading) {
    return <main className="flex flex-1 items-center justify-center p-[5vmin] text-3xl text-muted-foreground">Loading…</main>;
  }

  if (state === null) {
    return (
      <main className="flex flex-1 items-center justify-center p-[5vmin]">
        <p role="alert" className="text-center text-3xl text-muted-foreground">
          {error ?? "That game does not exist or has already ended."}
        </p>
      </main>
    );
  }

  const isOver = state.status === "finished" || state.status === "abandoned";

  return (

    /* 5vmin of margin: televisions crop the edges (overscan). */
    <main className="flex flex-1 flex-col gap-8 p-[5vmin]">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-5xl font-bold tracking-tight">Trident</h1>
        <div className="flex items-center gap-6">
          {state.join_code !== null && (
            <p className="font-mono text-3xl tracking-[0.2em] tabular-nums text-muted-foreground">
              {state.join_code}
            </p>
          )}
          <ConnectionBadge status={status} />
        </div>
      </header>

      {isOver
        ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-6xl font-bold">This game has ended</p>
          </div>
        )
        : <SeatList seats={state.seats} size="tv" />}

      <footer className="font-mono text-lg text-muted-foreground">
        version {state.version} · {state.seats.length} players
      </footer>
    </main>
  );
}
