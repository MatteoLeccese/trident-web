"use client";

import { useState } from "react";
import type { ConfigValue, RoomConfig, RoomConfigField, RoomConfigSpec } from "@/domains/game/types";
import {
  type FormValues,
  fieldError,
  formErrors,
  initialValues,
  submittableValues,
  textLength,
} from "@/domains/game/utils/roomConfigForm";

/**
 * The table's settings, **generated from the declaration** the backend publishes.
 *
 * Not one input here is written by hand. The form renders whatever the ruleset
 * declares, with the label it declares, the length it declares and the options
 * it declares, so this file contains no settings key, no count of boxes and no
 * idea of what any of them are for. A ruleset that declares another setting
 * tomorrow gets another box and nothing here changes.
 *
 * The same declaration the boxes are drawn from is the one the submission is
 * checked against on the server, which is why the refusal a person sees while
 * they are still looking at what they typed says the same thing the server would
 * have said.
 *
 * **The text is untrusted and it is painted at the size of a room.** It is
 * rendered as text and never as markup — nothing in this repository sets inner
 * HTML — and its length is bounded here by the declared maximum, which is the
 * number that makes it fit inside a television's safe area instead of pushing
 * the rest of the card off screen.
 */

interface Props {
  spec: RoomConfigSpec;

  /** What the table has saved, already resolved with the ruleset's defaults. */
  roomConfig: RoomConfig;

  /** Closed once the game leaves the lobby: the settings are frozen when play begins. */
  disabled?: boolean;

  onSave: (values: FormValues) => void;

  saving?: boolean;

  error?: string | null;
}

export function RoomSettingsForm ({ spec, roomConfig, disabled = false, onSave, saving = false, error = null }: Props) {
  const [ values, setValues ] = useState<FormValues>(() => initialValues(spec, roomConfig));

  const errors = formErrors(spec, values);
  const invalid = Object.keys(errors).length > 0;

  const set = (key: string, value: ConfigValue) => setValues((current) => ({ ...current, [key]: value }));

  return (
    <form
      data-room-settings=""
      onSubmit={(event) => {
        event.preventDefault();

        if (!invalid && !disabled && !saving) {
          onSave(submittableValues(spec, values));
        }
      }}
      className="flex flex-col gap-5"
    >
      {spec.fields.map((field) => (
        <SettingField
          key={field.key}
          field={field}
          value={values[field.key]}
          error={fieldError(field, values[field.key])}
          disabled={disabled || saving}
          onChange={(value) => set(field.key, value)}
        />
      ))}

      {error !== null && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={disabled || saving || invalid}
        className="rounded-xl bg-primary py-3 text-lg font-semibold text-primary-foreground disabled:opacity-40"
      >
        {saving ? "Saving…" : "Save the settings"}
      </button>
    </form>
  );
}

interface FieldProps {
  field: RoomConfigField;
  value: ConfigValue | undefined;
  error: string | null;
  disabled: boolean;
  onChange: (value: ConfigValue) => void;
}

function SettingField ({ field, value, error, disabled, onChange }: FieldProps) {
  const inputId = `setting-${field.key}`;

  /*
   * Read as a plain string on purpose. The declared kinds are a closed union in
   * the types, but the payload is not: a ruleset that declares a fourth kind
   * reaches this component, and the last branch is what answers it.
   */
  const kind: string = field.kind;

  return (
    <div data-setting={field.key} className="flex flex-col gap-2">
      <label htmlFor={inputId} className="font-medium">{field.label}</label>

      {kind === "text" && (
        <>
          <textarea
            id={inputId}
            rows={2}
            value={typeof value === "string" ? value : ""}
            maxLength={field.max_length ?? undefined}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 outline-none focus-visible:border-accent disabled:opacity-50"
          />
          {field.max_length !== null && (
            <p className="text-right font-mono text-xs text-muted-foreground">
              {textLength(typeof value === "string" ? value : "")}/{field.max_length}
            </p>
          )}
        </>
      )}

      {kind === "toggle" && (
        <input
          id={inputId}
          type="checkbox"
          checked={value === true}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="size-6 self-start accent-[var(--accent)]"
        />
      )}

      {kind === "choice" && (
        <select
          id={inputId}
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 outline-none focus-visible:border-accent disabled:opacity-50"
        >
          {field.options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      )}

      {/*
        * A kind this build has never met is shown and never edited. Guessing at a
        * control for it would submit a value of the wrong type, which comes back
        * refused by name.
        */}
      {kind !== "text" && kind !== "toggle" && kind !== "choice" && (
        <p id={inputId} className="salon-prose rounded-lg border border-border bg-muted px-3 py-2 font-mono text-sm">
          {String(value ?? field.default)}
        </p>
      )}

      {error !== null && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
