import type { CSSProperties } from "react";
import type { ChallengeEffect, RoomConfig, RoomConfigSpec, Seat } from "@/domains/game/types";
import { seatLabel } from "@/domains/game/utils/seats";
import { settingLabel } from "@/domains/game/utils/settingLabel";
import { settingText } from "@/domains/game/utils/settingText";
import { cn } from "@/lib/utils";

/**
 * One challenge, as the table reads it out: what it is, then what to do, then
 * who does it.
 *
 * **The title is the declared label of the key and never a word this file
 * composed.** A screen that took the face out of a settings key would be reading
 * a rule off a setting, so the name arrives with the ruleset's declaration or it
 * does not arrive at all: without the declaration in hand the card is painted
 * untitled, which is the state of a screen whose spec request is still in
 * flight.
 *
 * The recipient is last and small, and it is still here. It is the ruleset's
 * answer and not this component's — the one card in the game addressed to
 * somebody other than whoever drew the tile is the reason `Effect` carries a
 * recipient at all — and dropping it would take the only asymmetry of the game
 * off the screen and leave the room to remember it.
 *
 * The text is the table's, untrusted and painted at the size of a room. It is
 * rendered as text and never as markup, it wraps anywhere, and it is never
 * truncated: cutting it short hides exactly what the application exists to
 * announce. Its length is bounded where it is written, against the same
 * declaration the backend validates it with.
 *
 * A key that resolves to nothing paints no card at all — an empty setting is the
 * table saying this one does nothing.
 */

interface Props {
  effect: ChallengeEffect;
  roomConfig: RoomConfig;
  seats: Seat[];

  /** The ruleset's declaration, which is where the card's title comes from. */
  spec?: RoomConfigSpec | null;

  /** The seat holding this screen, so the card can show that it names somebody else. */
  viewerSeat?: number | null;

  size?: "phone" | "tv";

  /** Position in the staging of this version's cards. */
  index?: number;
}

export function ChallengeCard ({
  effect,
  roomConfig,
  seats,
  spec = null,
  viewerSeat = null,
  size = "phone",
  index = 0,
}: Props) {
  const text = settingText(roomConfig, effect.config_key);

  if (text === null) {
    return null;
  }

  const isTv = size === "tv";
  const title = settingLabel(spec, effect.config_key);
  const recipient = effect.seat === null ? "the table" : seatLabel(seats, effect.seat);
  const elsewhere = effect.seat !== null && viewerSeat !== null && effect.seat !== viewerSeat;

  return (
    <article
      data-challenge-card=""
      data-elsewhere={elsewhere ? "" : undefined}
      style={{ "--stage-index": index } as CSSProperties}
      className={cn(
        "stage-in flex flex-col gap-3 rounded-2xl border bg-card",
        isTv ? "gap-4 p-[1.2em]" : "p-5",
        elsewhere ? "border-accent" : "border-border",
      )}
    >
      {title !== null && (
        <p
          data-challenge-title=""
          className={cn("salon-prose font-bold tracking-tight", isTv ? "salon-name" : "text-3xl")}
        >
          {title}
        </p>
      )}

      <p className={cn("salon-prose", isTv ? "salon-lead" : "text-xl")}>{text}</p>

      {recipient !== null && (
        <p
          data-challenge-recipient=""
          className={cn(
            "flex flex-wrap items-baseline gap-2",
            isTv ? "text-[0.6em]" : "text-sm",
            elsewhere ? "text-accent" : "text-muted-foreground",
          )}
        >
          <span className="font-mono uppercase tracking-[0.2em]">Answered by</span>
          <span data-challenge-recipient-name="" className="salon-prose font-semibold">{recipient}</span>
        </p>
      )}
    </article>
  );
}
