import type { CSSProperties } from "react";
import type { ChallengeEffect, RoomConfig, Seat } from "@/domains/game/types";
import { seatLabel } from "@/domains/game/utils/seats";
import { settingText } from "@/domains/game/utils/settingText";
import { cn } from "@/lib/utils";

/**
 * One challenge, as the table reads it out.
 *
 * Two fields of the effect and nothing else: `config_key` is looked up in the
 * flat settings map the snapshot carries, and `seat` is the **recipient**, which
 * the ruleset decided. This component never works out who a challenge belongs
 * to, and it could not: it does not know what a face, a role or a stage is.
 *
 * That is also what makes the one card in the game addressed to somebody who is
 * not holding the phone work without a special case. It is a card whose `seat`
 * happens to differ from the seat holding the screen, so it is painted the way
 * every card is — with its recipient's name large — and the television paints it
 * identically from the same bytes.
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

  /** The seat holding this screen, so the card can show that it names somebody else. */
  viewerSeat?: number | null;

  size?: "phone" | "tv";

  /** Position in the staging of this version's cards. */
  index?: number;
}

export function ChallengeCard ({ effect, roomConfig, seats, viewerSeat = null, size = "phone", index = 0 }: Props) {
  const text = settingText(roomConfig, effect.config_key);

  if (text === null) {
    return null;
  }

  const isTv = size === "tv";
  const recipient = effect.seat === null ? null : seatLabel(seats, effect.seat);
  const elsewhere = effect.seat !== null && viewerSeat !== null && effect.seat !== viewerSeat;

  return (
    <article
      data-challenge-card=""
      data-elsewhere={elsewhere ? "" : undefined}
      style={{ "--stage-index": index } as CSSProperties}
      className={cn(
        "stage-in flex flex-col gap-3 rounded-2xl border bg-card",
        isTv ? "gap-5 p-[1.2em]" : "p-5",
        elsewhere ? "border-accent" : "border-border",
      )}
    >
      <p
        data-challenge-recipient=""
        className={cn(
          "salon-prose font-bold tracking-tight",
          isTv ? "salon-name" : "text-3xl",
          elsewhere && "text-accent",
        )}
      >
        {recipient ?? "Everyone"}
      </p>
      <p className={cn("salon-prose", isTv ? "salon-lead" : "text-xl")}>{text}</p>
    </article>
  );
}
