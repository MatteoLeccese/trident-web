import type { Seat } from "@/domains/game/types";

/**
 * Looking a seat up by its number.
 *
 * Seats travel as an array of objects with an explicit `seat`, never as a
 * positional map, so index and seat number are not the same thing and a screen
 * that used one for the other would name the wrong person the moment the ring is
 * reordered.
 */

export function seatByNumber (seats: Seat[], seat: number | null): Seat | null {
  if (seat === null) {
    return null;
  }

  return seats.find((candidate) => candidate.seat === seat) ?? null;
}

/**
 * The name to put on screen for a seat, or null when there is nobody to name.
 *
 * Null is the honest answer and never a placeholder: a screen that invented
 * "Player 3" would put a name on a button that the person holding the phone
 * cannot match to anybody at the table.
 */
export function nicknameOf (seats: Seat[], seat: number | null): string | null {
  const found = seatByNumber(seats, seat);

  if (found === null || found.nickname === "") {
    return null;
  }

  return found.nickname;
}

/**
 * What to put on a button that has to be aimed at one person.
 *
 * A seat with no nickname falls back to its number, which is still something a
 * table can point at; a seat that does not exist falls back to null, and the
 * caller paints nothing rather than a name nobody answers to.
 */
export function seatLabel (seats: Seat[], seat: number | null): string | null {
  const found = seatByNumber(seats, seat);

  if (found === null) {
    return null;
  }

  return found.nickname === "" ? `Seat ${found.seat}` : found.nickname;
}
