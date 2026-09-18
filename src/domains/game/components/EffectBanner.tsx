import type { CSSProperties } from "react";
import type { Effect, RoomConfig, RoomConfigSpec, Seat } from "@/domains/game/types";
import { ChallengeCard } from "@/domains/game/components/ChallengeCard";
import { isAnnounceEffect, isAssignRoleEffect, isChallengeEffect, paramsOf } from "@/domains/game/utils/effects";
import { seatLabel } from "@/domains/game/utils/seats";
import { formatMessage } from "@/lib/message-keys";
import { cn } from "@/lib/utils";

/**
 * One effect of one version, painted.
 *
 * It narrows through the exported guards and never through a switch on `kind`:
 * the union's neutral member accepts any kind, so a bare comparison would narrow
 * to a lie and the screen would read a field off nothing.
 *
 * **The fallback is neutral and it is the point.** An effect of a kind this
 * build has never met, an effect of a known kind that arrives malformed, and an
 * announcement this build has no copy for all land on the same answer: nothing
 * is painted, nothing throws, and the rest of the version is painted around it.
 * A ruleset may declare a kind tomorrow, and a television must keep painting
 * when it does.
 */

interface Props {
  effect: Effect;
  roomConfig: RoomConfig;
  seats: Seat[];

  /** The ruleset's declaration, which is where a challenge card takes its title from. */
  spec?: RoomConfigSpec | null;

  /** The seat holding this screen. */
  viewerSeat?: number | null;

  size?: "phone" | "tv";

  index?: number;
}

export function EffectBanner ({
  effect,
  roomConfig,
  seats,
  spec = null,
  viewerSeat = null,
  size = "phone",
  index = 0,
}: Props) {
  const isTv = size === "tv";

  if (isChallengeEffect(effect)) {
    return (
      <ChallengeCard
        effect={effect}
        roomConfig={roomConfig}
        seats={seats}
        spec={spec}
        viewerSeat={viewerSeat}
        size={size}
        index={index}
      />
    );
  }

  if (isAssignRoleEffect(effect)) {
    const name = seatLabel(seats, effect.seat);

    if (name === null) {
      return null;
    }

    return (
      <article
        data-role-banner=""
        style={{ "--stage-index": index } as CSSProperties}
        className={cn(
          "stage-in flex flex-wrap items-baseline gap-3 rounded-2xl border border-accent bg-card",
          isTv ? "gap-5 p-[1.2em]" : "p-5",
        )}
      >
        <p className={cn("salon-prose font-bold tracking-tight", isTv ? "salon-name" : "text-3xl")}>
          {name}
        </p>

        {/*
          * The role is an opaque machine token the ruleset owns. It is painted as
          * the token it is, in a chip that reads as machine text, because
          * translating it would mean this file knowing what roles exist.
          */}
        <p
          data-role-token={effect.role}
          className={cn(
            "salon-prose rounded-full bg-accent px-3 py-1 font-mono uppercase tracking-[0.15em] text-accent-foreground",
            isTv ? "text-[0.55em]" : "text-xs",
          )}
        >
          {effect.role}
        </p>
      </article>
    );
  }

  if (isAnnounceEffect(effect)) {
    const message = formatMessage(effect.message_key, paramsOf(effect));

    if (message === null) {
      return null;
    }

    return (
      <article
        data-announcement=""
        style={{ "--stage-index": index } as CSSProperties}
        className={cn(
          "stage-in salon-prose rounded-2xl border border-border bg-muted",
          isTv ? "salon-lead p-[1.2em]" : "p-5 text-xl",
        )}
      >
        {message}
      </article>
    );
  }

  return null;
}
