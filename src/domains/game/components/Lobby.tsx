"use client";

import { useState } from "react";
import { JoinCodeCard } from "@/domains/game/components/JoinCodeCard";
import { RoomSettingsForm } from "@/domains/game/components/RoomSettingsForm";
import { SeatList } from "@/domains/game/components/SeatList";
import { SeatOrderEditor } from "@/domains/game/components/SeatOrderEditor";
import { useRoomConfigSpec } from "@/domains/game/hooks/useRoomConfigSpec";
import { useWrite } from "@/domains/game/hooks/useWrite";
import { gameApi } from "@/domains/game/services/gameApi";
import type { GameState, Seat } from "@/domains/game/types";

/**
 * The table before it starts: who is here, in what order, and what the room
 * says.
 *
 * Everything on this screen is frozen the moment play begins — the names, the
 * ring and the settings — and it is the aggregate that refuses them afterwards,
 * not a rule this screen knows. So the lobby offers what the lobby offers, and a
 * write that arrives too late comes back refused by name.
 */

interface Props {
  gameId: string;
  state: GameState;
  receive: (incoming: GameState) => void;

  /** Where the television should be pointed. */
  spectatorUrl: string;
}

export function Lobby ({ gameId, state, receive, spectatorUrl }: Props) {
  const { spec, failed } = useRoomConfigSpec(gameId);

  const rename = useWrite(receive);
  const reorder = useWrite(receive);
  const settings = useWrite(receive);
  const start = useWrite(receive);

  const [ editing, setEditing ] = useState<Seat | null>(null);
  const [ draft, setDraft ] = useState("");

  const save = async () => {
    if (editing === null) {
      return;
    }

    const applied = await rename.run(() => gameApi.renameSeat(gameId, editing.seat, draft, state.version));

    if (applied) {
      setEditing(null);
    }
  };

  return (
    <div data-lobby="" className="flex flex-col gap-8">
      {state.join_code !== null && <JoinCodeCard code={state.join_code} url={spectatorUrl} />}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">The names</h2>
        <p className="text-sm text-muted-foreground">Tap a name to change it.</p>
        <SeatList
          seats={state.seats}
          onRename={(seat) => {
            setEditing(seat);
            setDraft(seat.nickname);
            rename.clear();
          }}
        />

        {editing !== null && (
          <div className="space-y-3 rounded-xl border border-accent bg-card p-4">
            <p className="text-sm text-muted-foreground">Seat {editing.seat}</p>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              // Held while a save is on its way, like the button beside it: a
              // key that is not is a key a finger can repeat.
              onKeyDown={(event) => {
                if (event.key === "Enter" && !rename.pending) {
                  void save();
                }
              }}
              maxLength={24}
              autoFocus
              aria-label="New name"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus-visible:border-accent"
            />
            {rename.error !== null && <p role="alert" className="text-sm text-destructive">{rename.error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={rename.pending}
                onClick={() => void save()}
                className="flex-1 rounded-lg bg-primary py-2 font-medium text-primary-foreground disabled:opacity-40"
              >
                {rename.pending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-border px-4 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">The order the phone travels in</h2>
        <SeatOrderEditor
          seats={state.seats}
          saving={reorder.pending}
          error={reorder.error}
          onSave={(order) => void reorder.run(() => gameApi.reorderSeats(gameId, order, state.version))}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">What the room says</h2>

        {failed && (
          <p role="alert" className="text-sm text-destructive">
            We could not load the settings this game takes.
          </p>
        )}

        {spec !== null && (
          <RoomSettingsForm

            /*
             * Remounted when the saved settings change, so the boxes show what the
             * table has rather than an edit that a refusal already replaced.
             */
            key={state.version}
            spec={spec}
            roomConfig={state.room_config}
            saving={settings.pending}
            error={settings.error}
            onSave={(values) => void settings.run(() => gameApi.configureRoom(gameId, values, state.version))}
          />
        )}
      </section>

      {start.error !== null && <p role="alert" className="text-sm text-destructive">{start.error}</p>}

      <button
        type="button"
        data-start-game=""
        disabled={start.pending}
        onClick={() => void start.run(() => gameApi.start(gameId, state.version))}
        className="w-full rounded-2xl bg-primary py-5 text-xl font-semibold text-primary-foreground disabled:opacity-50"
      >
        {start.pending ? "Dealing…" : "Start the game"}
      </button>
    </div>
  );
}
