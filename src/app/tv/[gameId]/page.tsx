"use client";

import { use, useCallback } from "react";
import { TileGrid } from "@/components/board/TileGrid";
import { ConnectionBadge } from "@/domains/game/components/ConnectionBadge";
import { CurrentPlayer } from "@/domains/game/components/CurrentPlayer";
import { EffectList } from "@/domains/game/components/EffectList";
import { GameOverScreen } from "@/domains/game/components/GameOverScreen";
import { IdleNotice } from "@/domains/game/components/IdleNotice";
import { LastPlay } from "@/domains/game/components/LastPlay";
import { SeatList } from "@/domains/game/components/SeatList";
import { useFinalBeat } from "@/domains/game/hooks/useFinalBeat";
import { useGameChannel } from "@/domains/game/hooks/useGameChannel";
import { useGameState } from "@/domains/game/hooks/useGameState";
import { pollIntervalMs, useReconcile } from "@/domains/game/hooks/useReconcile";
import { useRoomConfigSpec } from "@/domains/game/hooks/useRoomConfigSpec";
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

/**
 * How long the last turn of the game holds the screen before the record of the
 * evening replaces it.
 *
 * Long enough for a room to read the card out loud and start doing what it says,
 * short enough that nobody thinks the television has stopped.
 */
const FINAL_BEAT_MS = 15_000;

export default function TvPage ({ params }: PageProps<"/tv/[gameId]">) {
  const { gameId } = use(params);
  const { state, error, loading, resync, receive } = useGameState(gameId);

  const reconcile = useCallback(() => void resync(), [ resync ]);

  /*
   * A game that has ended has published its last version, so both recoveries are
   * switched off: the socket is closed rather than held open all night, and the
   * poll stops asking for a snapshot that can never change again. Left running,
   * a television abandoned on a finished game would keep a connection and two
   * requests a minute going until somebody unplugged it.
   */
  const settled = state !== null && (state.status === "finished" || state.status === "abandoned");

  const status = useGameChannel({
    gameId,
    onState: receive,
    onReconnect: reconcile,
    enabled: !settled,
  });

  useReconcile({ resync: reconcile, everyMs: RECONCILE_MS, enabled: !settled });

  /*
   * The declaration a challenge card takes its title from. It is read once and
   * not watched: it belongs to the ruleset, no write changes it, and a card
   * whose title has not arrived is painted untitled rather than titled by a
   * screen that worked the name out of a settings key.
   */
  const { spec } = useRoomConfigSpec(gameId);

  const holdingLastTurn = useFinalBeat(
    state === null ? "unknown" : settled ? "over" : "live",
    FINAL_BEAT_MS,
  );

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

  // Named again after the early returns purely so the branches below read as
  // branches: it is the same answer the hooks above were given.
  const isOver = settled;
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

      {/*
        * Only while the game can still go somewhere. `last_activity_at` freezes
        * with the last write, so on a game that ended properly the notice starts
        * counting the moment the room finished playing and crowns the record of
        * the evening with "this may have been left behind" a few minutes later.
        */}
      {!isOver && (
        <IdleNotice
          lastActivityAt={state.last_activity_at}
          noticeMinutes={state.tv_idle_notice_minutes}
        />
      )}

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
        * The end of the game, in two beats.
        *
        * The write that turns over the last tile of the pool is the write that
        * finishes the game (TR-34), and that tile fires its two challenges like
        * every other (TR-38). Painted in the same frame as the record of the
        * evening, the last thing the table is asked for all night lands beside a
        * screen announcing the game is over and the room reads the ending
        * instead of the card. So the last turn holds the screen on its own
        * first, and the record follows it.
        */}
      {isOver && holdingLastTurn && (
        <div
          data-final-beat=""
          className="flex min-h-0 flex-1 flex-col justify-center gap-[1em] overflow-y-auto"
        >
          {state.last_draw !== null && <LastPlay draw={state.last_draw} seats={state.seats} size="tv" />}

          <EffectList
            effects={state.effects}
            version={state.version}
            roomConfig={state.room_config}
            seats={state.seats}
            spec={spec}
            size="tv"
          />
        </div>
      )}

      {/*
        * The record, with the last version's cards still beside it: the beat
        * gave them their moment, and taking them away afterwards would wipe a
        * challenge the table may still be in the middle of doing.
        *
        * They share the height rather than stacking, because this screen may
        * not scroll: stacked, two cards at this size and the record of the board
        * together come to more than a television has, and what a room cannot
        * scroll to is not on the screen at all.
        */}
      {isOver && !holdingLastTurn && (
        <div
          className={cn(
            "grid min-h-0 flex-1 gap-[1em]",
            hasCards && "lg:grid-cols-[1fr_1.1fr]",
          )}
        >
          {hasCards && (
            <div className="flex min-h-0 flex-col gap-[0.8em] overflow-y-auto">
              {state.last_draw !== null && <LastPlay draw={state.last_draw} seats={state.seats} size="tv" />}

              <EffectList
                effects={state.effects}
                version={state.version}
                roomConfig={state.room_config}
                seats={state.seats}
                spec={spec}
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
              * Whose draw these cards belong to, said out loud. The cursor above
              * names the next seat and these belong to the draw before it: both
              * are right, and unlabelled the room reads them as one sentence.
              */}
            {state.last_draw !== null && <LastPlay draw={state.last_draw} seats={state.seats} size="tv" />}

            {/*
              * No seat is passed as the viewer: a television speaks for the room
              * and not for anybody at it. Every card is painted the same way —
              * including the one addressed to somebody who is not holding the
              * phone, which needs no special case here because the recipient
              * travels inside the effect.
              */}
            <EffectList
              effects={state.effects}
              version={state.version}
              roomConfig={state.room_config}
              seats={state.seats}
              spec={spec}
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
