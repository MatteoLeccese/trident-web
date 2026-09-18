"use client";

import type { Effect, RoomConfig, Seat } from "@/domains/game/types";
import { CurrentPlayer } from "@/domains/game/components/CurrentPlayer";
import { EffectList } from "@/domains/game/components/EffectList";
import { DominoFace } from "@/components/domino/DominoFace";

/**
 * What one draw produced: the tile lying face up and the cards it fired.
 *
 * **The tile turns over because the state changed, not because somebody
 * tapped.** What is on screen here is derived from a snapshot — the face is the
 * one the pool now carries at that position, and the cards are that version's
 * effects — so the television stages the same thing from the same bytes, and a
 * phone that lost a frame and resynced lands on the same final picture instead
 * of on a half-played animation.
 *
 * The name at the top is the seat holding the phone, which by now is no longer
 * the seat the server's cursor names. That divergence is deliberate and lasts
 * one tap.
 */

interface Props {

  /** The two-character face string the pool now carries, or null if it is not published. */
  tile: string | null;

  position: number | null;

  /** The seat holding the phone, and its name. */
  holderSeat: number | null;
  holderName: string | null;

  effects: Effect[];

  /** The version the effects belong to, which keys their cards. */
  version: number;

  roomConfig: RoomConfig;
  seats: Seat[];

  onContinue: () => void;
}

export function TurnResult ({
  tile,
  position,
  holderSeat,
  holderName,
  effects,
  version,
  roomConfig,
  seats,
  onContinue,
}: Props) {
  return (
    <section data-turn-result="" className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-8">
      <CurrentPlayer label="Holding the phone" name={holderName} />

      {tile !== null && (
        <div className="flex justify-center">
          <div data-drawn-tile={position ?? undefined} className="flip-in w-28">
            <DominoFace tile={tile} />
          </div>
        </div>
      )}

      <EffectList
        effects={effects}
        version={version}
        roomConfig={roomConfig}
        seats={seats}
        viewerSeat={holderSeat}

        /* The tile has the first beat of the staging; the cards follow it. */
        offset={1}
      />

      <button
        type="button"
        onClick={onContinue}
        data-turn-continue=""
        className="mt-auto w-full rounded-2xl bg-primary py-5 text-xl font-semibold text-primary-foreground"
      >
        Done reading
      </button>
    </section>
  );
}
