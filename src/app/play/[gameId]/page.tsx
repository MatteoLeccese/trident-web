"use client";

import { use, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { TileGrid } from "@/components/board/TileGrid";
import { isApiError } from "@/domains/core/types/api-error";
import { ConfirmDrawSheet } from "@/domains/game/components/ConfirmDrawSheet";
import { ConnectionBadge } from "@/domains/game/components/ConnectionBadge";
import { CurrentPlayer } from "@/domains/game/components/CurrentPlayer";
import { GameOverScreen } from "@/domains/game/components/GameOverScreen";
import { HandOff } from "@/domains/game/components/HandOff";
import { EffectList } from "@/domains/game/components/EffectList";
import { Lobby } from "@/domains/game/components/Lobby";
import { TurnResult } from "@/domains/game/components/TurnResult";
import { useGameChannel } from "@/domains/game/hooks/useGameChannel";
import { useGameState } from "@/domains/game/hooks/useGameState";
import { useReconcile } from "@/domains/game/hooks/useReconcile";
import { useRoomConfigSpec } from "@/domains/game/hooks/useRoomConfigSpec";
import { useTurnSequence } from "@/domains/game/hooks/useTurnSequence";
import { gameApi } from "@/domains/game/services/gameApi";
import { boardIsMounted, phoneSeat } from "@/domains/game/utils/turnSequence";
import { seatLabel } from "@/domains/game/utils/seats";
import { messageForError } from "@/lib/error-codes";

/**
 * The phone: the one client that writes, passed from hand to hand.
 *
 * A turn runs board → tap → a question with a name in it → one write → the
 * snapshot, from which the tile is face up → the cards that draw fired → the
 * hand-off. Only the write touches the network; everything after it is client
 * state over bytes already in hand.
 *
 * **Between turns the board is not disabled, it is not mounted.** A disabled
 * grid invites a tap and then refuses it, which teaches a table that the screen
 * is unreliable; a screen with somebody's name on it invites passing the phone,
 * which is the actual next move.
 *
 * **Under the question it is mounted and refused**, which is the other case and
 * not an exception to that one: the question is about a tile that is still on
 * screen behind it, and the control that was just used has to survive being
 * used, or the focus lands on the document at the moment a modal opens.
 *
 * **The name on this screen is the seat holding the phone**, which from the
 * moment of the tap is no longer the cursor the server publishes. The television
 * paints that cursor. They diverge for exactly one tap, on purpose.
 *
 * No screen here carries a timer. Every step waits for a hand.
 */

/** How often the phone reconciles while its socket is down. Its battery is the constraint. */
const OFFLINE_POLL_MS = 3_000;

export default function PlayPage ({ params }: PageProps<"/play/[gameId]">) {
  const { gameId } = use(params);
  const router = useRouter();
  const { state, error, loading, resync, receive } = useGameState(gameId);

  const reconcile = useCallback(() => void resync(), [ resync ]);

  const status = useGameChannel({ gameId, onState: receive, onReconnect: reconcile });

  useReconcile({ resync: reconcile, everyMs: status === "connected" ? null : OFFLINE_POLL_MS });

  const turn = useTurnSequence({ gameId, state, receive });

  /*
   * The declaration a challenge card takes its title from. It is read once and
   * not watched: it belongs to the ruleset and no write changes it.
   */
  const { spec } = useRoomConfigSpec(gameId);

  const [ rematching, setRematching ] = useState(false);
  const [ rematchError, setRematchError ] = useState<string | null>(null);

  const playAgain = async () => {
    setRematching(true);
    setRematchError(null);

    try {
      const { game } = await gameApi.playAgain(gameId);

      router.push(`/play/${game.game_id}`);
    } catch (caught: unknown) {
      setRematchError(isApiError(caught) ? messageForError(caught) : "We could not start another game.");
      setRematching(false);
    }
  };

  if (loading) {
    return <main className="flex flex-1 items-center justify-center p-8 text-muted-foreground">Loading…</main>;
  }

  if (state === null) {
    return (
      <main className="flex flex-1 items-center justify-center p-8">
        <p role="alert" className="text-center text-muted-foreground">
          {error ?? "That game does not exist or has already ended."}
        </p>
      </main>
    );
  }

  const { sequence } = turn;
  const isOver = state.status === "finished" || state.status === "abandoned";
  const inPlay = state.status === "running" || state.status === "awaiting_choice";
  const holder = phoneSeat(sequence, state.current_seat);
  const holderName = seatLabel(state.seats, holder);

  /*
   * The face comes from the snapshot's record of the draw and never from the
   * pool. A draw that ends a stage arrives with the next stage's fresh pool in
   * the same snapshot, so the position that was just turned over is untaken and
   * face down in it: read off the pool, the one draw of the evening the game is
   * named after is the one draw with no tile on either screen.
   */
  const drawnTile = state.last_draw !== null && state.last_draw.position === sequence.position
    ? state.last_draw.tile
    : null;

  const spectatorUrl = `${typeof window === "undefined" ? "" : window.location.origin}/tv/${gameId}`;

  /*
   * The result is gated on the phase and never on the status. The write that
   * turns over the last tile of the pool is the write that finishes the game
   * (TR-34) and it carries that version's effects like every other (TR-38):
   * gated on `running`, the last things the table is asked for all evening —
   * addressed to whichever seats the ruleset named, which this screen never
   * works out — would be replaced by the end screen in the frame they arrived
   * in, and `effects` belongs to that version only. The same write can park the
   * game on a question, with the same consequence.
   */
  if (sequence.phase === "result" && sequence.version !== null) {
    return (
      <TurnResult
        tile={drawnTile}
        position={sequence.position}
        holderSeat={holder}
        holderName={holderName}
        effects={state.effects}
        version={state.version}
        roomConfig={state.room_config}
        seats={state.seats}
        spec={spec}

        // There is a next turn to hand the phone on to only while the game runs.
        onContinue={state.status === "running" ? turn.advance : turn.dismiss}
      />
    );
  }

  if (state.status === "running" && sequence.phase === "handoff") {
    // The name is the cursor the server published with the new state, which is
    // the seat this phone is going to.
    return <HandOff name={seatLabel(state.seats, state.current_seat)} onDone={turn.advance} />;
  }

  return (

    /*
      * `min-h-0` is what keeps this box the height of the screen: without it a
      * flex item grows to its content and the board below would be measured
      * against a box it had just made taller. The scrolling belongs here for
      * the screens that are honestly long — the lobby — while a mounted board
      * fits exactly and scrolls inside its own scroller instead.
      */
    <main className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col gap-4 overflow-y-auto px-4 py-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold tracking-tight">Trident</h1>
        <ConnectionBadge status={status} />
      </header>

      <CurrentPlayer
        label={inPlay ? "Holding the phone" : "Now playing"}
        name={inPlay ? holderName : null}
        fallback={isOver ? "The game is over" : "The game has not started"}
      />

      {sequence.notice !== null && (
        <p role="alert" className="rounded-lg border-l-2 border-accent bg-muted px-3 py-2 text-sm">
          {sequence.notice}
        </p>
      )}

      {state.status === "lobby" && (
        <Lobby gameId={gameId} state={state} receive={receive} spectatorUrl={spectatorUrl} />
      )}

      {/*
        * The last version's cards, above the record of the board.
        *
        * They are painted here as well as on the result screen, because the
        * result screen belongs to the turn sequence and a phone that was
        * reloaded has none: the effects are still in the snapshot in hand, and
        * this is the only screen left to read them on.
        */}
      {isOver && (
        <EffectList
          effects={state.effects}
          version={state.version}
          roomConfig={state.room_config}
          seats={state.seats}
          spec={spec}
        />
      )}

      {isOver && (
        <GameOverScreen
          state={state}
          onPlayAgain={() => void playAgain()}
          pending={rematching}
          error={rematchError}
        />
      )}

      {/*
        * Parked on a question the framework knows about and the shipped ruleset
        * never asks: there is no board to lay a finger on, so what is on screen
        * is whose turn it is and whatever the last version asked for.
        */}
      {inPlay && state.status !== "running" && (
        <EffectList
          effects={state.effects}
          version={state.version}
          roomConfig={state.room_config}
          seats={state.seats}
          spec={spec}
          viewerSeat={state.current_seat}
        />
      )}

      {state.status === "running" && boardIsMounted(sequence.phase) && (
        <>
          <TileGrid
            positions={state.pool}
            onSelect={turn.tap}
            disabled={sequence.phase !== "board"}
            pressedPosition={sequence.position}
            gap={10}
            className="min-h-0 flex-1"
          />

          {sequence.phase !== "board" && sequence.position !== null && (
            <ConfirmDrawSheet
              name={holderName}
              position={sequence.position}
              pending={sequence.phase === "submitting"}
              onConfirm={turn.confirm}
              onCancel={turn.cancel}
            />
          )}
        </>
      )}
    </main>
  );
}
