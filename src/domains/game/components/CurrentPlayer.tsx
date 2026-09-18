import { cn } from "@/lib/utils";

/**
 * Whoever the screen is about, on screen at all times.
 *
 * Both clients carry one in every state, and the two deliberately disagree for
 * the length of one tap: the television paints the cursor the server published,
 * which after a draw already names the next seat, while the phone paints the
 * seat in whose hand it is. Neither is catching up with the other — see
 * `turnSequence.ts`, where the divergence is written down.
 */

interface Props {

  /** What this name is: who is playing, who is holding the phone, who is next. */
  label: string;

  name: string | null;

  /** What to say when there is nobody to name, rather than invent one. */
  fallback?: string;

  /** The television is read from three metres away; the phone, from thirty centimetres. */
  size?: "phone" | "tv";

  className?: string;
}

export function CurrentPlayer ({ label, name, fallback = "Nobody yet", size = "phone", className }: Props) {
  const isTv = size === "tv";

  return (
    <div data-current-player="" className={cn("flex flex-col gap-1", className)}>
      <p
        className={cn(
          "font-mono uppercase tracking-[0.2em] text-muted-foreground",
          isTv ? "text-[0.5em]" : "text-xs",
        )}
      >
        {label}
      </p>
      <p
        data-current-player-name=""
        className={cn(
          "salon-prose font-bold tracking-tight",
          isTv ? "salon-name" : "text-3xl",
          name === null && "text-muted-foreground",
        )}
      >
        {name ?? fallback}
      </p>
    </div>
  );
}
