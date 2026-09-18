import { DominoFace } from "@/components/domino/DominoFace";
import type { LastDraw, Seat } from "@/domains/game/types";
import { seatLabel } from "@/domains/game/utils/seats";
import { cn } from "@/lib/utils";

/**
 * The draw the cards on screen belong to, named.
 *
 * A television paints the cursor the server published, which after a draw
 * already names the next seat, and the cards under it belong to the draw before.
 * Both are correct, and unlabelled they read as one sentence: the room is told
 * it is Bruno's turn and then shown what Ana turned over, as though Bruno had
 * chosen it. This is the label that separates them.
 *
 * The face comes from the snapshot's record of the draw and never from the pool.
 * A draw that ends a stage arrives with the next stage's fresh pool in the same
 * snapshot, so the position just turned over is untaken and face down in it:
 * read off the pool, the one draw of the evening the game is named after is the
 * one draw with no tile on either screen.
 */

interface Props {
  draw: LastDraw;
  seats: Seat[];

  /** The television is read from three metres away; the phone, from thirty centimetres. */
  size?: "phone" | "tv";

  className?: string;
}

export function LastPlay ({ draw, seats, size = "tv", className }: Props) {
  const isTv = size === "tv";
  const name = seatLabel(seats, draw.seat);

  return (
    <div
      data-last-play={draw.position}
      className={cn("flex items-center", isTv ? "gap-[0.7em]" : "gap-4", className)}
    >
      <div className={cn("shrink-0", isTv ? "w-[1.5em]" : "w-14")}>
        <DominoFace tile={draw.tile} position={draw.position} seat={draw.seat} />
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        <p
          className={cn(
            "font-mono uppercase tracking-[0.2em] text-muted-foreground",
            isTv ? "text-[0.5em]" : "text-xs",
          )}
        >
          {name === null ? "Last play" : "Last play by"}
        </p>

        {name !== null && (
          <p
            data-last-play-name=""
            className={cn("salon-prose font-bold tracking-tight", isTv ? "salon-lead" : "text-2xl")}
          >
            {name}
          </p>
        )}
      </div>
    </div>
  );
}
