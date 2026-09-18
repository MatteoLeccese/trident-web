"use client";

/**
 * The end of a turn: a full screen whose only content is a name.
 *
 * **One transition, identical every time.** It is not configurable, it does not
 * depend on the stage, it is the same for every seat, and it never reaches the
 * API: no key of any kind chooses it. That is what makes it a habit a table
 * learns in one evening.
 *
 * The name is on the button as well as on the screen, so the wrong person feels
 * that it is wrong before they tap it. Nothing here counts down; it waits for a
 * hand.
 */

interface Props {

  /** Who the phone goes to next: the cursor the server published with the new state. */
  name: string | null;

  onDone: () => void;
}

export function HandOff ({ name, onDone }: Props) {
  return (
    <section
      data-handoff=""
      className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-10 bg-background p-8"
    >
      <p className="font-mono text-sm uppercase tracking-[0.3em] text-muted-foreground">
        Pass the phone to
      </p>

      <p data-handoff-name="" className="salon-prose text-center text-6xl font-bold tracking-tight">
        {name ?? "the next player"}
      </p>

      <button
        type="button"
        onClick={onDone}
        data-handoff-button=""
        className="w-full max-w-sm rounded-2xl bg-primary px-6 py-6 text-2xl font-semibold text-primary-foreground"
      >
        {name === null ? "I have the phone" : `I am ${name}`}
      </button>
    </section>
  );
}
