import { describe, expect, it } from "vitest";
import { isSameOrder, moveSeat, seatOrder } from "./seatOrder";
import { seat } from "@/domains/game/testing/snapshot";

describe("the ring's order", () => {
  it("reads the seat numbers off the roster in the order it arrived", () => {
    expect(seatOrder([ seat(3, "Carla"), seat(1, "Ana"), seat(2, "Bruno") ])).toEqual([ 3, 1, 2 ]);
  });

  it("moves an entry to an index without losing or duplicating one", () => {
    expect(moveSeat([ 1, 2, 3, 4 ], 0, 2)).toEqual([ 2, 3, 1, 4 ]);
    expect(moveSeat([ 1, 2, 3, 4 ], 3, 0)).toEqual([ 4, 1, 2, 3 ]);
    expect(moveSeat([ 1, 2, 3, 4 ], 2, 1)).toEqual([ 1, 3, 2, 4 ]);
  });

  it("keeps every seat exactly once whatever it is asked", () => {
    const start = [ 1, 2, 3, 4, 5, 6 ];

    for (let from = 0; from < start.length; from += 1) {
      for (let to = 0; to < start.length; to += 1) {
        const moved = moveSeat(start, from, to);

        expect([ ...moved ].sort()).toEqual([ ...start ].sort());
        expect(moved).toHaveLength(start.length);
      }
    }
  });

  it("answers a move that goes nowhere with the order it was given", () => {
    const order = [ 1, 2, 3 ];

    // A drag that ends off the list is a drag that did not happen.
    expect(moveSeat(order, 1, 1)).toBe(order);
    expect(moveSeat(order, -1, 2)).toBe(order);
    expect(moveSeat(order, 0, 9)).toBe(order);
  });

  it("compares two orders by position and not as sets", () => {
    expect(isSameOrder([ 1, 2, 3 ], [ 1, 2, 3 ])).toBe(true);
    expect(isSameOrder([ 1, 2, 3 ], [ 3, 2, 1 ])).toBe(false);
    expect(isSameOrder([ 1, 2 ], [ 1, 2, 3 ])).toBe(false);
  });
});
