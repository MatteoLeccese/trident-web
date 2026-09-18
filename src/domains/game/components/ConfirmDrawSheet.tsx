"use client";

import { type KeyboardEvent, useEffect, useRef } from "react";

/**
 * The question between a tap and a write.
 *
 * **The name is inside the question.** A bare "Confirm?" is answered by whoever
 * is holding the phone, which around a table is regularly the wrong person; a
 * question that names somebody is one the room can hear and correct before the
 * tile turns over.
 *
 * It carries no timer and no countdown. It waits.
 *
 * **It is a modal and behaves like one.** It declares `aria-modal`, which hides
 * the board behind it from a screen reader only once the focus is inside, so it
 * takes the focus when it opens, keeps it while it is up, closes on Escape and
 * hands the focus back to the tile that was tapped. Without that, the board
 * behind it is hidden and nothing has been announced, which leaves a keyboard or
 * a screen reader at the top of the document with no way to find either button.
 */

interface Props {

  /** Who the question is about. */
  name: string | null;

  /** The position that was tapped, so the sheet is about a tile and not about a mood. */
  position: number;

  /** True from the moment the write leaves until the snapshot answers. */
  pending: boolean;

  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDrawSheet ({ name, position, pending, onConfirm, onCancel }: Props) {
  const sheet = useRef<HTMLDivElement | null>(null);
  const confirm = useRef<HTMLButtonElement | null>(null);

  /*
   * The focus comes in on open and goes back where it was on close. The element
   * it came from is the tile's control, which stays mounted and merely disabled
   * while this is up; a close that follows the draw itself takes the board with
   * it, and then there is nothing to go back to and nothing is done.
   */
  useEffect(() => {
    const cameFrom = document.activeElement;

    confirm.current?.focus();

    return () => {
      if (cameFrom instanceof HTMLElement && document.contains(cameFrom)) {
        cameFrom.focus();
      }
    };
  }, []);

  /*
   * While the write is in flight both buttons are disabled, which would drop the
   * focus out of the dialog and back to the document. It lands on the sheet
   * itself instead, so what is read out is the question and its progress.
   */
  useEffect(() => {
    if (pending) {
      sheet.current?.focus();
    }
  }, [ pending ]);

  function keep (event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") {
      if (!pending) {
        event.preventDefault();
        onCancel();
      }

      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const reachable = Array.from(
      sheet.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? [],
    );

    const first = reachable[0];
    const last = reachable[reachable.length - 1];

    if (first === undefined || last === undefined) {
      event.preventDefault();

      return;
    }

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const question = name === null
    ? "Take this one?"
    : `Does ${name} take this one?`;

  return (
    <div
      ref={sheet}
      data-confirm-sheet=""
      role="dialog"
      aria-modal="true"
      aria-label={question}
      aria-busy={pending}
      tabIndex={-1}
      onKeyDown={keep}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-8px_32px_rgba(0,0,0,0.25)] focus:outline-none"
    >
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Position {position}
        </p>
        <p className="salon-prose text-3xl font-bold tracking-tight">{question}</p>

        <div className="flex gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="rounded-xl border border-border px-5 py-4 text-lg disabled:opacity-40"
          >
            Not yet
          </button>
          <button
            ref={confirm}
            type="button"
            disabled={pending}
            onClick={onConfirm}
            data-confirm-draw=""
            className="flex-1 rounded-xl bg-primary py-4 text-xl font-semibold text-primary-foreground disabled:opacity-60"
          >
            {pending ? "Turning it over…" : "Turn it over"}
          </button>
        </div>
      </div>
    </div>
  );
}
