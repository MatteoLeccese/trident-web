"use client";

import Link from "next/link";
import { TileGrid } from "@/components/board/TileGrid";
import type { GameState } from "@/domains/game/types";
import { cn } from "@/lib/utils";

/**
 * The end of a game, on both screens.
 *
 * **Nothing is counted** (TR-54). There is no score, no total, no ranking and no
 * "most tiles": what is on screen is the board as it ended — every position in
 * the order it was dealt, each showing its face and the seat that turned it over
 * — which is a record and not a result. A number here would invent a game nobody
 * played, and the seat numbers on the tiles are the record of who drew what and
 * are never added up.
 *
 * The record is painted straight from the pool the snapshot carries, so both
 * clients show the same board from the same bytes.
 *
 * **Play again belongs to the phone.** It opens the next game with the same
 * table, and the credential it issues is consumed by the server side of this app
 * before the answer reaches the browser. A television has no path to it, which
 * is the credential model and not a layout choice.
 *
 * **The television is given a way off this screen instead.** A rematch is a new
 * game with a new id and a new code, and the old snapshot carries no pointer to
 * it, so a watch screen left on a game that is over has nothing to converge on.
 * It is not waited for: the idle notice takes the deployment's minutes of
 * silence to appear, which is half an hour by default, and a dark room with a
 * remote control in it needs the link now. The phone is already showing the new
 * code, because a rematch lands it in the next game's lobby.
 */

interface Props {
  state: GameState;

  size?: "phone" | "tv";

  /** Given only where a rematch can be started: the phone that is running the game. */
  onPlayAgain?: () => void;

  pending?: boolean;

  error?: string | null;
}

export function GameOverScreen ({ state, size = "phone", onPlayAgain, pending = false, error = null }: Props) {
  const isTv = size === "tv";

  return (
    <section data-game-over="" className={cn("flex min-h-0 flex-1 flex-col gap-6", isTv && "gap-[1.2em]")}>
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 className={cn("font-bold tracking-tight", isTv ? "salon-name" : "text-4xl")}>
          The game is over
        </h2>
        <p className={cn("text-muted-foreground", isTv ? "salon-lead" : "text-lg")}>
          {state.seats.length} players
        </p>
      </header>

      <TileGrid
        positions={state.pool}
        gap={isTv ? 12 : 8}

        /* Every position is taken here, so "taken" is not information. */
        mutesTakenPositions={false}

        /*
         * The board as it ended, and not the board as the last player left it:
         * every position paints its face and the seat that turned it over, even
         * where the table chose to clear its tiles as it went. Honoured here,
         * the setting would leave forty-nine empty places on the one screen
         * whose whole purpose is the record.
         *
         * Nothing can be tapped on this screen, so the reason the setting exists
         * — a board that must not move under a thumb between turns — has run out
         * with the game.
         */
        honoursBoardPresence={false}

        /*
         * A floor on the phone, where this screen is something to scroll: the
         * cards above it are as tall as the rules made them, and a board that
         * gave up the rest of the height would leave forty-nine tiles inside a
         * few pixels. The television has no floor because it may not scroll —
         * there the board takes the height that is left and has to fit it.
         */
        className={isTv ? undefined : "min-h-[50vh]"}
        header={(
          <p className={cn("pb-3 text-muted-foreground", isTv ? "salon-lead" : "text-sm")}>
            The board as it ended
          </p>
        )}
      />

      <ul className={cn("flex flex-wrap gap-3", isTv && "gap-[0.6em]")}>
        {state.seats.map((seat) => (
          <li
            key={seat.seat}
            className={cn(
              "salon-prose rounded-full border border-border bg-card px-4 py-2",
              isTv ? "text-[0.8em]" : "text-base",
            )}
          >
            {seat.nickname}
          </li>
        ))}
      </ul>

      {error !== null && (
        <p role="alert" className={cn("text-destructive", isTv ? "salon-lead" : "text-base")}>
          {error}
        </p>
      )}

      {isTv && (
        <Link
          href="/tv"
          data-watch-another=""
          className="salon-prose self-start rounded-xl bg-primary px-[1em] py-[0.6em] font-semibold text-primary-foreground"
        >
          Watch another game
        </Link>
      )}

      {onPlayAgain !== undefined && (
        <button
          type="button"
          onClick={onPlayAgain}
          disabled={pending}
          data-play-again=""
          className="w-full rounded-2xl bg-primary py-5 text-xl font-semibold text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Dealing a new game…" : "Play again"}
        </button>
      )}
    </section>
  );
}
