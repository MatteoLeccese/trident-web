import { describe, expect, it } from "vitest";
import {
  type TurnSequence,
  boardIsMounted,
  initialTurnSequence,
  phoneSeat,
  turnSequenceReducer,
} from "./turnSequence";

function run (events: Parameters<typeof turnSequenceReducer>[1][], from = initialTurnSequence): TurnSequence {
  return events.reduce(turnSequenceReducer, from);
}

describe("the turn sequence", () => {
  it("runs a whole turn on taps and one answer from the server", () => {
    const afterTap = run([ { type: "tap", position: 7, holder: 1 } ]);

    expect(afterTap).toEqual({ phase: "confirming", position: 7, holder: 1, version: null, notice: null });

    const afterConfirm = run([ { type: "confirm" } ], afterTap);

    expect(afterConfirm.phase).toBe("submitting");

    const afterDraw = run([ { type: "drawn", version: 12 } ], afterConfirm);

    expect(afterDraw).toEqual({ phase: "result", position: 7, holder: 1, version: 12, notice: null });
    expect(run([ { type: "advance" } ], afterDraw).phase).toBe("handoff");
    expect(run([ { type: "advance" }, { type: "advance" } ], afterDraw)).toEqual(initialTurnSequence);
  });

  it("only takes a tap from the board", () => {
    // A frame arriving while the sheet is open must not re-arm a tap underneath it.
    const confirming = run([ { type: "tap", position: 7, holder: 1 } ]);
    const again = run([ { type: "tap", position: 8, holder: 1 } ], confirming);

    expect(again).toBe(confirming);

    const submitting = run([ { type: "confirm" } ], confirming);

    expect(run([ { type: "tap", position: 8, holder: 1 } ], submitting)).toBe(submitting);
  });

  it("cancels back to a clean board and only from the question", () => {
    const confirming = run([ { type: "tap", position: 7, holder: 1 } ]);

    expect(run([ { type: "cancel" } ], confirming)).toEqual(initialTurnSequence);

    const submitting = run([ { type: "confirm" } ], confirming);

    // A cancel after the write has left would leave the screen lying about a
    // draw the server is already applying.
    expect(run([ { type: "cancel" } ], submitting)).toBe(submitting);
  });

  it("puts a refused write back on the board with something to read", () => {
    const submitting = run([
      { type: "tap", position: 7, holder: 1 },
      { type: "confirm" },
    ]);

    const refused = run([ { type: "refused", notice: "It moved on." } ], submitting);

    expect(refused.phase).toBe("board");
    expect(refused.position).toBeNull();
    expect(refused.holder).toBeNull();
    expect(refused.notice).toBe("It moved on.");
  });

  it("stages a result only for the write it is waiting on", () => {
    // A frame off the socket must not throw a result onto a board nobody tapped.
    expect(run([ { type: "drawn", version: 4 } ])).toBe(initialTurnSequence);

    const result = run([
      { type: "tap", position: 7, holder: 1 },
      { type: "confirm" },
      { type: "drawn", version: 4 },
    ]);

    expect(run([ { type: "drawn", version: 9 } ], result)).toBe(result);
    expect(result.version).toBe(4);
  });

  it("clears a tap that was never confirmed", () => {
    const confirming = run([ { type: "tap", position: 7, holder: 1 } ]);

    expect(run([ { type: "reset" } ], confirming)).toEqual(initialTurnSequence);
  });

  it("holds the seat that was playing when the tap happened", () => {
    // The cursor the server publishes moves on with the draw; the phone does not.
    // The divergence lasts exactly until the hand-off is tapped through.
    const result = run([
      { type: "tap", position: 7, holder: 1 },
      { type: "confirm" },
      { type: "drawn", version: 4 },
    ]);

    expect(phoneSeat(result, 2)).toBe(1);
    expect(phoneSeat(run([ { type: "advance" } ], result), 2)).toBe(1);
    expect(phoneSeat(run([ { type: "advance" }, { type: "advance" } ], result), 2)).toBe(2);
  });

  it("falls back to the server's cursor before a tap", () => {
    expect(phoneSeat(initialTurnSequence, 3)).toBe(3);
    expect(phoneSeat(initialTurnSequence, null)).toBeNull();
  });

  it("opens the game on a hand-off and not on a live board", () => {
    // The phone is in the hand of whoever tapped start, which is the first seat
    // one time in however many are at the table.
    const opened = run([ { type: "opened" } ]);

    expect(opened.phase).toBe("handoff");
    expect(opened.position).toBeNull();
    expect(opened.holder).toBeNull();

    expect(run([ { type: "advance" } ], opened).phase).toBe("board");
  });

  it("ignores an opening that arrives when a turn is already under way", () => {
    // Two frames saying the game started must not throw away a tap.
    const tapped = run([ { type: "tap", position: 5, holder: 1 } ]);

    expect(run([ { type: "opened" } ], tapped)).toBe(tapped);
  });

  it("mounts the board for the three phases that are about the board", () => {
    expect(boardIsMounted("board")).toBe(true);
    expect(boardIsMounted("confirming")).toBe(true);
    expect(boardIsMounted("submitting")).toBe(true);

    // Not disabled: absent. A disabled grid invites a tap it then refuses.
    expect(boardIsMounted("result")).toBe(false);
    expect(boardIsMounted("handoff")).toBe(false);
  });
});
