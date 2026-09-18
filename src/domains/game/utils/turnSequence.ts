/**
 * The phone's turn, as a pure state machine.
 *
 * Only the first two steps of a turn touch the network. Everything after the
 * snapshot lands — the tile lying face up, the cards it fired, the hand-off — is
 * client state over bytes that are already in hand, so the sequence is a
 * reducer that can be asserted without a network, a timer or a screen.
 *
 * Nothing here advances on its own. Every transition is an event, every event
 * that is not the server answering is a human tap, and no phase carries a
 * deadline: a table reads a card aloud for as long as it takes.
 *
 * **The board is not mounted outside `board`, `confirming` and `submitting`.** A
 * disabled grid invites a tap and then refuses it; a screen with a name on it
 * invites passing the phone. That is why the phase is a state and not a flag on
 * the board.
 */

export type TurnPhase = "board" | "confirming" | "submitting" | "result" | "handoff";

export interface TurnSequence {
  phase: TurnPhase;

  /** The position the phone tapped, held from the tap until the board comes back. */
  position: number | null;

  /**
   * The seat in whose hand the phone is.
   *
   * It is captured at the tap, from the cursor the server published **before**
   * the write, and it is what the phone keeps painting through the result and
   * the hand-off. The television paints the server's cursor over the same
   * versions, which by then names the next seat: the two clients diverge on
   * purpose, and the divergence lasts exactly one tap.
   */
  holder: number | null;

  /** The version the result on screen was derived from, so a later frame does not restage it. */
  version: number | null;

  /** What to tell the person when a write came back refused. */
  notice: string | null;
}

export type TurnEvent =
  | { type: "opened"; }
  | { type: "tap"; position: number; holder: number | null; }
  | { type: "cancel"; }
  | { type: "confirm"; }
  | { type: "drawn"; version: number; }
  | { type: "refused"; notice: string; }
  | { type: "advance"; }
  | { type: "reset"; };

export const initialTurnSequence: TurnSequence = {
  phase: "board",
  position: null,
  holder: null,
  version: null,
  notice: null,
};

export function turnSequenceReducer (sequence: TurnSequence, event: TurnEvent): TurnSequence {
  switch (event.type) {
    case "opened":

      /*
       * The game has just begun, so the first turn starts where every other
       * turn starts: with a name on the screen and the phone in the wrong hand.
       * Whoever typed the names and tapped start is holding it, and at a table
       * of five that is the first seat one time in five — one thumb on the way
       * to putting the phone down would otherwise turn over the opening tile for
       * somebody else, and after the write there is no way back.
       */
      return sequence.phase === "board" ? { ...initialTurnSequence, phase: "handoff" } : sequence;

    case "tap":

      // Only from the board, so a frame arriving mid-sheet cannot re-arm a tap.
      return sequence.phase === "board"
        ? { phase: "confirming", position: event.position, holder: event.holder, version: null, notice: null }
        : sequence;

    case "cancel":
      return sequence.phase === "confirming" ? initialTurnSequence : sequence;

    case "confirm":
      return sequence.phase === "confirming" ? { ...sequence, phase: "submitting" } : sequence;

    case "drawn":

      // The tile turns over because the state changed, never because of the tap:
      // the result stages the version the server answered with, which is the
      // same version the television stages from the same bytes.
      return sequence.phase === "submitting"
        ? { ...sequence, phase: "result", version: event.version, notice: null }
        : sequence;

    case "refused":

      // A refusal returns the phone to the board with something to read. The
      // state it was refused against has already been applied elsewhere, so the
      // board it comes back to is the current one.
      return sequence.phase === "submitting"
        ? { ...initialTurnSequence, notice: event.notice }
        : sequence;

    case "advance":
      if (sequence.phase === "result") {
        return { ...sequence, phase: "handoff" };
      }

      return sequence.phase === "handoff" ? initialTurnSequence : sequence;

    case "reset":
      return initialTurnSequence;
  }
}

/**
 * The seat the phone is painting for.
 *
 * Before a tap it is the server's cursor, and from the tap until the hand-off
 * ends it is the seat that was holding the phone when the tap happened.
 */
export function phoneSeat (sequence: TurnSequence, currentSeat: number | null): number | null {
  return sequence.holder ?? currentSeat;
}

/** Whether the board is on screen at all in this phase. */
export function boardIsMounted (phase: TurnPhase): boolean {
  return phase === "board" || phase === "confirming" || phase === "submitting";
}
