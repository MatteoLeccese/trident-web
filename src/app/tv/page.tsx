"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isApiError } from "@/domains/core/types/api-error";
import { gameApi } from "@/domains/game/services/gameApi";
import { messageForError } from "@/lib/error-codes";

/**
 * TV entry point. It is typed with a remote control, so the field is huge and the
 * code is six unambiguous characters.
 *
 * It carries the salon scale like every other watch screen: five per cent of each
 * edge per axis, so nothing sits where an old television crops, and no text below
 * the size a room can read from the sofa.
 */
export default function TvEntryPage () {
  const router = useRouter();
  const [ code, setCode ] = useState("");
  const [ error, setError ] = useState("");
  const [ looking, setLooking ] = useState(false);

  const open = async () => {
    setLooking(true);
    setError("");

    try {
      const game = await gameApi.byCode(code);

      router.push(`/tv/${game.game_id}`);
    } catch (caught: unknown) {
      setError(isApiError(caught) ? messageForError(caught) : "We could not find that game.");
      setLooking(false);
    }
  };

  return (
    <main className="salon flex flex-1 flex-col items-center justify-center gap-[1em]">
      <h1 className="salon-lead text-center font-bold tracking-tight">
        Type the game code
      </h1>

      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        onKeyDown={(e) => e.key === "Enter" && void open()}
        maxLength={8}
        autoFocus
        aria-label="Game code"
        placeholder="K7QP3M"
        className="w-full max-w-md rounded-xl border-2 border-border bg-card px-6 py-5 text-center font-mono text-5xl tracking-[0.2em] outline-none focus-visible:border-accent"
      />

      {error !== "" && <p role="alert" className="salon-prose text-destructive">{error}</p>}

      <button
        type="button"
        disabled={looking}
        onClick={() => void open()}
        className="salon-lead rounded-xl bg-primary px-[1em] py-[0.5em] font-semibold text-primary-foreground disabled:opacity-40"
      >
        {looking ? "Looking…" : "Watch the game"}
      </button>
    </main>
  );
}
