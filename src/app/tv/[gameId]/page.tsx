"use client";

import { use, useCallback } from "react";
import { TileGrid } from "@/components/board/TileGrid";
import { ConnectionBadge } from "@/domains/game/components/ConnectionBadge";
import { CurrentPlayer } from "@/domains/game/components/CurrentPlayer";
import { EffectList } from "@/domains/game/components/EffectList";
import { GameOverScreen } from "@/domains/game/components/GameOverScreen";
import { IdleNotice } from "@/domains/game/components/IdleNotice";
import { SeatList } from "@/domains/game/components/SeatList";
import { useGameChannel } from "@/domains/game/hooks/useGameChannel";
import { useGameState } from "@/domains/game/hooks/useGameState";
import { pollIntervalMs, useReconcile } from "@/domains/game/hooks/useReconcile";
import { paintableEffects } from "@/domains/game/utils/effects";
import { seatLabel } from "@/domains/game/utils/seats";
import { cn } from "@/lib/utils";

/**
 * The television: the same game, read-only, from the sofa.
 *
 * It holds no credential that can write. It arrives by link or by join code,
 * both of which are read credentials, and its socket is a one-way feed: there is
 * no control on this screen, and there is no path from it to a write.
 *
 * **It paints the server's cursor, always.** After a draw that cursor already
 * names the next seat, while the phone is still painting the seat holding it.
 * The two clients disagree for exactly one tap, and that is the design and not a
 * lag: the room is being told whose turn it is next, while the person with the
 * phone in their hand is still reading out what they turned over.
 */

/**
 * How often the television reconciles no matter what the socket claims.
 *
 * A value that is missing, empty or not a number falls back to thirty seconds
 * rather than to no poll: without this poll a dead Reverb or a NAT rebind is a
 * frozen screen for the rest of the evening.
 */
const RECONCILE_MS = pollIntervalMs(process.env.NEXT_PUBLIC_TRIDENT_RECONCILE_POLL_MS, 30_000);

export default function TvPage ({ params }: PageProps<"/tv/[gameId]">) {
  const { gameId } = use(params);
  const { state, error, loading, resync, receive } = useGameState(gameId);

  const reconcile = useCallback(() => void resync(), [ resync ]);

  const status = useGameChannel({ gameId, onState: receive, onReconnect: reconcile });

  useReconcile({ resync: reconcile, everyMs: RECONCILE_MS });

  if (loading) {
    return (
      <main className="salon flex flex-1 items-center justify-center text-muted-foreground">
        Loading…
      </main>
    );
  }

  if (state === null) {
    return (
      <main className="salon flex flex-1 items-center justify-center">
        <p role="alert" className="salon-lead text-center text-muted-foreground">
          {error ?? "That game does not exist or has already ended."}
        </p>
      </main>
    );
  }

  const isOver = state.status === "finished" || state.status === "abandoned";
  const inPlay = state.status === "running" || state.status === "awaiting_choice";

  // Whether anything will be painted, rather than whether anything was sent: an
  // effect of a kind this build does not know leaves no card behind, and a column
  // kept for it would take half the screen away from the board.
  const hasCards = paintableEffects(state.effects).length > 0;

  return (
    <main className="salon flex min-h-0 flex-1 flex-col gap-[0.8em]">
      <header className="flex flex-wrap items-baseline justify-between gap-[0.6em]">
        <h1 className="text-[1.2em] font-bold tracking-tight">Trident</h1>
        <div className="flex items-center gap-[0.8em]">
          {state.join_code !== null && (
            <p className="font-mono text-[1.1em] tracking-[0.2em] tabular-nums text-muted-foreground">
              {state.join_code}
            </p>
          )}
          <ConnectionBadge status={status} size="tv" />
        </div>
      </header>

      <IdleNotice
        lastActivityAt={state.last_activity_at}
        noticeMinutes={state.tv_idle_notice_minutes}
      />

      {/*
        * The server's cursor, in every state and never anybody else's. It sits
        * above the branch so that the room is told whose turn it is whatever the
        * screen is showing.
        *
        * The name is withheld once the game is no longer in play, which is what
        * lets the fallback speak: `current_seat` outlives the game, so the
        * room's biggest text would otherwise tell four of five players it is
        * somebody's turn on a game that has ended.
        */}
      <CurrentPlayer
        label={inPlay ? "Now playing" : "This table"}
        name={inPlay ? seatLabel(state.seats, state.current_seat) : null}
        fallback={isOver ? "The game has ended" : "The game has not started"}
        size="tv"
      />

      {/*
        * The end of the game: the last version's cards beside the board as it
        * ended, in the same two columns the screen uses while it runs.
        *
        * The cards have to be here at all because the write that turns over the
        * last tile of the pool is the write that finishes the game (TR-34), and
        * that tile fires its two challenges like every other (TR-38). Painted
        * only while the game runs, they would vanish in the frame they arrived
        * in, and no later frame carries them: `effects` belongs to one version.
        *
        * They share the height rather than stacking, because this screen may
        * not scroll: stacked, two cards at this size and the record of the board
        * together come to more than a television has, and what a room cannot
        * scroll to is not on the screen at all.
        */}
      {isOver && (
        <div
          className={cn(
            "grid min-h-0 flex-1 gap-[1em]",
            hasCards && "lg:grid-cols-[1fr_1.1fr]",
          )}
        >
          {hasCards && (
            <div className="flex min-h-0 flex-col gap-[0.8em] overflow-y-auto">
              <EffectList
                effects={state.effects}
                version={state.version}
                roomConfig={state.room_config}
                seats={state.seats}
                size="tv"
              />
            </div>
          )}

          <GameOverScreen state={state} size="tv" />
        </div>
      )}

      {!isOver && inPlay && (
        <div className="grid min-h-0 flex-1 gap-[1em] lg:grid-cols-[1fr_1.1fr]">
          <div className="flex min-h-0 flex-col gap-[0.8em] overflow-y-auto">

            {/*
              * No seat is passed as the viewer: a television speaks for the room
              * and not for anybody at it. Every card is painted the same way, with
              * its recipient's name large — including the one addressed to somebody
              * who is not holding the phone, which needs no special case here
              * because the recipient travels inside the effect.
              */}
            <EffectList
              effects={state.effects}
              version={state.version}
              roomConfig={state.room_config}
              seats={state.seats}
              size="tv"
            />
          </div>

          <TileGrid positions={state.pool} gap={14} className="min-h-0" />
        </div>
      )}

      {!isOver && !inPlay && (
        <div className="flex min-h-0 flex-1 flex-col gap-[1em] overflow-y-auto">
          <SeatList seats={state.seats} size="tv" />
        </div>
      )}
    </main>
  );
}
