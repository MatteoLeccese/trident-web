import { describe, expect, it } from "vitest";
import { nicknameOf, seatByNumber, seatLabel } from "./seats";
import { seat } from "@/domains/game/testing/snapshot";

const SEATS = [ seat(1, "Ana"), seat(4, "Bruno"), seat(9, "") ];

describe("looking a seat up", () => {
  it("finds it by its number and not by its place in the list", () => {
    // Seats travel as objects with an explicit number; using the index would
    // name the wrong person the moment the ring is reordered.
    expect(seatByNumber(SEATS, 4)?.nickname).toBe("Bruno");
    expect(seatByNumber(SEATS, 2)).toBeNull();
    expect(seatByNumber(SEATS, null)).toBeNull();
  });

  it("gives back no name rather than an invented one", () => {
    expect(nicknameOf(SEATS, 1)).toBe("Ana");
    expect(nicknameOf(SEATS, 9)).toBeNull();
    expect(nicknameOf(SEATS, 7)).toBeNull();
  });

  it("labels a nameless seat with its number and an absent seat with nothing", () => {
    expect(seatLabel(SEATS, 1)).toBe("Ana");
    expect(seatLabel(SEATS, 9)).toBe("Seat 9");
    expect(seatLabel(SEATS, 7)).toBeNull();
    expect(seatLabel(SEATS, null)).toBeNull();
  });
});
