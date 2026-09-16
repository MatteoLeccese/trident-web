import type { ApiError } from "@/domains/core/types/api-error";

const GENERIC_MESSAGE = "Ha ocurrido un error inesperado. Vuelve a intentarlo.";

/**
 * Backend machine codes → text for a person.
 *
 * Adding a code here is part of adding it in the backend: if it is missing, the
 * player sees the raw API message instead of one meant for them.
 */
const ERROR_MESSAGES: Record<string, string> = {
  // Shared kernel
  validation_error: "Hay algo mal en lo que has enviado. Revísalo.",
  unauthenticated: "Necesitas volver a entrar en la partida.",
  forbidden: "No puedes hacer eso desde esta pantalla.",
  not_found: "No hemos encontrado eso.",
  too_many_requests: "Vas muy rápido. Espera un momento.",
  internal_error: "El servidor ha tenido un problema. Vuelve a intentarlo en un momento.",

  // Game
  game_not_found: "Esa partida no existe o ya ha terminado.",
  game_version_conflict: "La partida ha avanzado. Actualizando…",
  not_your_turn: "No es tu turno todavía.",
  tile_already_taken: "Esa ficha ya la ha cogido alguien.",
  nickname_taken: "Ese nombre ya está en uso en esta partida.",
  controller_token_required: "Sólo el móvil que lleva la partida puede hacer eso.",
  controller_token_invalid: "Este móvil ya no lleva la partida.",
};

export function messageForError (error: ApiError): string {
  const mapped = ERROR_MESSAGES[error.errorCode];

  if (mapped !== undefined) {
    return mapped;
  }

  const fromBackend = error.message.trim();

  return fromBackend.length > 0 ? fromBackend : GENERIC_MESSAGE;
}
