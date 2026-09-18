import type { Seat } from "@/domains/game/types";

/**
 * The ring, as a list of seat numbers the lobby edits.
 *
 * The write is an **absolute permutation** and never a "move seat 4 up", which
 * is what makes a repeat of the same request harmless: sending the same order
 * twice lands on the same ring.
 */

export function seatOrder (seats: Seat[]): number[] {
  return seats.map((seat) => seat.seat);
}

/**
 * The order with the entry at `from` moved to `to`, both by index.
 *
 * Out-of-range indices return the order untouched: a drag that ends off the list
 * is a drag that did not happen, not an error to show.
 */
export function moveSeat (order: number[], from: number, to: number): number[] {
  if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) {
    return order;
  }

  const moved = [ ...order ];
  const [ entry ] = moved.splice(from, 1);

  moved.splice(to, 0, entry);

  return moved;
}

export function isSameOrder (left: number[], right: number[]): boolean {
  return left.length === right.length && left.every((seat, index) => seat === right[index]);
}
