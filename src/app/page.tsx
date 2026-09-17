"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Tv, Users, X } from "lucide-react";
import { isApiError } from "@/domains/core/types/api-error";
import { gameApi } from "@/domains/game/services/gameApi";
import { messageForError } from "@/lib/error-codes";

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 15;

export default function LobbyPage () {
  const router = useRouter();

  const [ nickname, setNickname ] = useState("");
  const [ players, setPlayers ] = useState<string[]>([]);
  const [ error, setError ] = useState("");
  const [ creating, setCreating ] = useState(false);

  const addPlayer = () => {
    const trimmed = nickname.trim().replace(/\s+/g, " ");

    if (trimmed.length < 2 || trimmed.length > 24) {
      setError("The name must be between 2 and 24 characters.");

      return;
    }

    if (players.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
      setError(`"${trimmed}" is already at the table.`);

      return;
    }

    if (players.length >= MAX_PLAYERS) {
      setError(`${MAX_PLAYERS} players at most.`);

      return;
    }

    setPlayers([ ...players, trimmed ]);
    setNickname("");
    setError("");
  };

  const createGame = async () => {
    // Disabled while in flight: without this, two taps create two games.
    setCreating(true);
    setError("");

    try {
      const { game } = await gameApi.create(players);

      router.push(`/play/${game.game_id}`);
    } catch (caught: unknown) {
      setError(isApiError(caught) ? messageForError(caught) : "We could not create the game.");
      setCreating(false);
    }
  };

  const ready = players.length >= MIN_PLAYERS && players.length <= MAX_PLAYERS;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 px-4 py-12">
      <header className="space-y-3 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          A domino game
        </p>
        <h1 className="text-5xl font-bold tracking-tight">Trident</h1>
        <p className="text-muted-foreground">
          One phone passed around the table. One television watching it all live.
        </p>
      </header>

      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-4" aria-hidden="true" />
          Players ({players.length}/{MAX_PLAYERS})
        </div>

        <div className="flex gap-2">
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addPlayer()}
            maxLength={24}
            placeholder="Name…"
            aria-label="Player name"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 outline-none focus-visible:border-accent"
          />
          <button
            type="button"
            onClick={addPlayer}
            aria-label="Add player"
            className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add
          </button>
        </div>

        {error !== "" && (
          <p role="alert" className="rounded-lg border-l-2 border-destructive bg-muted px-3 py-2 text-sm">
            {error}
          </p>
        )}

        {players.length > 0 && (
          <ul className="grid gap-2">
            {players.map((player, index) => (
              <li
                key={player}
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
              >
                <span className="font-mono text-sm tabular-nums text-muted-foreground">{index + 1}</span>
                <span className="flex-1 truncate">{player}</span>
                <button
                  type="button"
                  onClick={() => setPlayers(players.filter((_, i) => i !== index))}
                  aria-label={`Remove ${player}`}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          disabled={!ready || creating}
          onClick={createGame}
          className="w-full rounded-lg bg-primary py-3 text-lg font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {creating
            ? "Creating…"
            : players.length < MIN_PLAYERS
              ? `${MIN_PLAYERS - players.length} more to go`
              : `Start with ${players.length}`}
        </button>
      </section>

      <Link
        href="/tv"
        className="flex items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <Tv className="size-4" aria-hidden="true" />
        I am the television
      </Link>
    </main>
  );
}
