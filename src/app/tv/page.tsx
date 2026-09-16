"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isApiError } from "@/domains/core/types/api-error";
import { gameApi } from "@/domains/game/services/gameApi";
import { messageForError } from "@/lib/error-codes";

/**
 * TV entry point. It is typed with a remote control, so the field is huge and the
 * code is six unambiguous characters.
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
      setError(isApiError(caught) ? messageForError(caught) : "No hemos encontrado esa partida.");
      setLooking(false);
    }
  };

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-[5vmin]">
      <h1 className="text-center text-4xl font-bold tracking-tight sm:text-5xl">
        Escribe el código de la partida
      </h1>

      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        onKeyDown={(e) => e.key === "Enter" && void open()}
        maxLength={8}
        autoFocus
        aria-label="Código de la partida"
        placeholder="K7QP3M"
        className="w-full max-w-md rounded-xl border-2 border-border bg-card px-6 py-5 text-center font-mono text-5xl tracking-[0.2em] outline-none focus-visible:border-accent"
      />

      {error !== "" && <p role="alert" className="text-xl text-destructive">{error}</p>}

      <button
        type="button"
        disabled={looking}
        onClick={() => void open()}
        className="rounded-xl bg-primary px-10 py-4 text-2xl font-semibold text-primary-foreground disabled:opacity-40"
      >
        {looking ? "Buscando…" : "Ver la partida"}
      </button>
    </main>
  );
}
