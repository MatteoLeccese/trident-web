import type { ApiError } from "@/domains/core/types/api-error";

const GENERIC_MESSAGE = "Something went wrong. Give it another go.";

/**
 * Backend machine codes → text for a person.
 *
 * Adding a code here is part of adding it in the backend: if it is missing, the
 * player sees the raw API message instead of one meant for them.
 */
const ERROR_MESSAGES: Record<string, string> = {
  // Shared kernel
  validation_error: "Something in what you sent is not right. Check it over.",
  unauthenticated: "You need to join the game again.",
  forbidden: "You cannot do that from this screen.",
  not_found: "We could not find that.",
  too_many_requests: "You are going too fast. Wait a moment.",
  internal_error: "The server hit a problem. Try again in a moment.",

  // Game
  game_not_found: "That game does not exist, or it is already over.",
  game_version_conflict: "The game has moved on. Catching up…",
  not_your_turn: "It is not your turn yet.",
  tile_already_taken: "Someone has already taken that tile.",
  nickname_taken: "That name is already taken in this game.",
  controller_token_required: "Only the phone running the game can do that.",
  controller_token_invalid: "This phone is no longer running the game.",
};

export function messageForError (error: ApiError): string {
  const mapped = ERROR_MESSAGES[error.errorCode];

  if (mapped !== undefined) {
    return mapped;
  }

  const fromBackend = error.message.trim();

  return fromBackend.length > 0 ? fromBackend : GENERIC_MESSAGE;
}
