import type { Effect, RoomConfig, RoomConfigSpec, Seat } from "@/domains/game/types";
import { EffectBanner } from "@/domains/game/components/EffectBanner";
import { paintableEffects } from "@/domains/game/utils/effects";
import { cn } from "@/lib/utils";

/**
 * What the rules asked of the table on one version, in the order the ruleset
 * emitted them.
 *
 * The order is the payload's and is never sorted, grouped or deduplicated: which
 * challenge comes first and how many a tile fires are the ruleset's answers
 * (TR-38, TR-39, TR-41), and a screen that rearranged them would be deciding a
 * rule.
 *
 * The cards are staggered by a CSS delay and never by a timer. The stagger is
 * what puts a beat between the tile turning over and the cards that follow it
 * (TR-48b) without anything on screen advancing on its own.
 *
 * **They are keyed by the version they belong to.** A CSS animation runs when an
 * element is inserted and never again, and this list stays mounted for the whole
 * of a game on the television: keyed by position alone, one version's cards
 * would land on the previous version's nodes and the text would swap with no
 * beat at all from the second tile of the night onwards. The version in the key
 * is what makes them new nodes.
 */

interface Props {
  effects: Effect[];

  /** The version these effects belong to. It keys the cards, so they re-stage. */
  version: number;

  roomConfig: RoomConfig;
  seats: Seat[];

  /** The ruleset's declaration, which is where a challenge card takes its title from. */
  spec?: RoomConfigSpec | null;

  /** The seat holding this screen. */
  viewerSeat?: number | null;

  size?: "phone" | "tv";

  /** Cards begin staging at this index, leaving room for whatever precedes them. */
  offset?: number;

  className?: string;
}

export function EffectList ({
  effects,
  version,
  roomConfig,
  seats,
  spec = null,
  viewerSeat = null,
  size = "phone",
  offset = 0,
  className,
}: Props) {
  const painted = paintableEffects(effects);

  if (painted.length === 0) {
    return null;
  }

  return (
    <div data-effect-list="" className={cn("flex flex-col gap-4", className)}>
      {painted.map((effect, index) => (
        <EffectBanner
          key={`${version}-${index}`}
          effect={effect}
          roomConfig={roomConfig}
          seats={seats}
          spec={spec}
          viewerSeat={viewerSeat}
          size={size}
          index={offset + index}
        />
      ))}
    </div>
  );
}
