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

  // The write protocol. A reused or malformed intention is a defect in the
  // client, so the text says what a person can do and nothing more.
  request_id_reused: "That action was already sent. Give it a moment.",
  request_id_invalid: "We could not send that. Try again.",

  // The game framework refusing a write the current state does not allow.
  game_not_in_lobby: "The game has already started.",
  game_not_running: "The game is not in play right now.",
  game_already_finished: "This game is over.",
  pool_position_not_in_pool: "That is not a position on this board.",
  pool_position_already_taken: "That one is already turned over.",
  no_pending_choice: "There is nothing waiting to be answered.",
  seat_not_found: "There is no such seat at this table.",
  seat_order_invalid: "That is not a valid order for this table.",
  roster_size_invalid: "That is not a number of players this game takes.",

  // The table's settings, refused against the declaration the lobby form was
  // generated from.
  room_config_key_unknown: "This game has no setting by that name.",
  room_config_value_invalid: "This game does not take that value for one of the settings.",
};

export function messageForError (error: ApiError): string {
  const mapped = ERROR_MESSAGES[error.errorCode];

  if (mapped !== undefined) {
    return mapped;
  }

  const fromBackend = error.message.trim();

  return fromBackend.length > 0 ? fromBackend : GENERIC_MESSAGE;
}
