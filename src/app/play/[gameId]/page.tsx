"use client";

import { use, useCallback, useState } from "react";
import { isApiError } from "@/domains/core/types/api-error";
import { ConnectionBadge } from "@/domains/game/components/ConnectionBadge";
import { JoinCodeCard } from "@/domains/game/components/JoinCodeCard";
import { SeatList } from "@/domains/game/components/SeatList";
import { useGameChannel } from "@/domains/game/hooks/useGameChannel";
import { useGameState } from "@/domains/game/hooks/useGameState";
import { gameApi } from "@/domains/game/services/gameApi";
import type { Seat } from "@/domains/game/types";
import { messageForError } from "@/lib/error-codes";

export default function PlayPage ({ params }: PageProps<"/play/[gameId]">) {
  const { gameId } = use(params);
  const { state, error, loading, resync, receive } = useGameState(gameId);

  const status = useGameChannel({
    gameId,
    onState: receive,
    // Reconnecting resyncs through the SAME route as the initial load.
    onReconnect: useCallback(() => void resync(), [ resync ]),
  });

  const [ editing, setEditing ] = useState<Seat | null>(null);
  const [ draft, setDraft ] = useState("");
  const [ saveError, setSaveError ] = useState("");

  const save = async () => {
    if (editing === null) {
      return;
    }

    try {
      receive(await gameApi.renameSeat(gameId, editing.seat, draft));
      setEditing(null);
      setSaveError("");
    } catch (caught: unknown) {
      setSaveError(isApiError(caught) ? messageForError(caught) : "We could not save the name.");
    }
  };

  if (loading) {
    return <main className="flex flex-1 items-center justify-center p-8 text-muted-foreground">Loading…</main>;
  }

  if (error !== "" && state === null) {
    return (
      <main className="flex flex-1 items-center justify-center p-8">
        <p role="alert" className="text-center text-muted-foreground">{error}</p>
      </main>
    );
  }

  if (state === null) {
    return null;
  }

  const spectatorUrl = `${typeof window === "undefined" ? "" : window.location.origin}/tv/${gameId}`;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">The table</h1>
        <ConnectionBadge status={status} />
      </header>

      <JoinCodeCard code={state.join_code} url={spectatorUrl} />

      <section className="space-y-3">
        <p className="text-sm text-muted-foreground">Tap a name to change it.</p>
        <SeatList seats={state.seats} onRename={(seat) => { setEditing(seat); setDraft(seat.nickname); setSaveError(""); }} />
      </section>

      {editing !== null && (
        <section className="space-y-3 rounded-xl border border-accent bg-card p-4">
          <p className="text-sm text-muted-foreground">Seat {editing.seat}</p>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void save()}
            maxLength={24}
            autoFocus
            aria-label="New name"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus-visible:border-accent"
          />
          {saveError !== "" && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void save()}
              className="flex-1 rounded-lg bg-primary py-2 font-medium text-primary-foreground"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-lg border border-border px-4 py-2"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      <p className="font-mono text-xs text-muted-foreground">
        version {state.version} · {state.seats.length} players
      </p>
    </main>
  );
}
