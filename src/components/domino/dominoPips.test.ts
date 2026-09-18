import { describe, expect, it } from "vitest";
import {
  PIP_CELLS,
  PIP_GRID_SIZE,
  getPipMask,
  isTileValue,
  pipCoordsMap,
  tileFaces,
} from "./dominoPips";

/**
 * The salvaged pip logic, tested where it now lives.
 *
 * The map is read as a table and never as a set of cases: every face is asserted
 * by the same expression, so nothing here can quietly grow a branch for one
 * particular face.
 */

/** A face and the pips it shows, which is a fact about dominoes and not about any ruleset. */
const FACES: [number, number][] = [ [ 0, 0 ], [ 1, 1 ], [ 2, 2 ], [ 3, 3 ], [ 4, 4 ], [ 5, 5 ], [ 6, 6 ] ];

function litCells (mask: boolean[]): number[] {
  return mask.flatMap((lit, index) => lit ? [ index ] : []);
}

describe("the pip mask", () => {
  it.each(FACES)("draws %i dots for a face of %i", (face, dots) => {
    expect(litCells(getPipMask(face))).toHaveLength(dots);
  });

  it.each(FACES)("returns one cell per position of the 3x3 grid for a face of %i", (face) => {
    expect(getPipMask(face)).toHaveLength(PIP_CELLS);
    expect(PIP_GRID_SIZE * PIP_GRID_SIZE).toBe(PIP_CELLS);
  });

  it("lays every pip out symmetrically about the centre of the face", () => {
    // A domino's pips are a point-symmetric pattern: the cell opposite a lit one
    // is lit too, except for the centre pip of an odd face.
    for (const [ face ] of FACES) {
      const mask = getPipMask(face);

      for (const cell of litCells(mask)) {
        expect(mask[PIP_CELLS - 1 - cell]).toBe(true);
      }
    }
  });

  it("puts the single pip of a one in the centre cell", () => {
    expect(litCells(getPipMask(1))).toEqual([ 4 ]);
  });

  it("reads a coordinate as row then column", () => {
    // `pipCoordsMap` stores `[row, column]` and the mask index is row-major, which
    // is what makes the two columns of a six read as columns and not as rows.
    expect(pipCoordsMap[6]).toContainEqual([ 1, 0 ]);
    expect(litCells(getPipMask(6))).toEqual([ 0, 2, 3, 5, 6, 8 ]);
  });

  it("draws nothing for a face it has no entry for, instead of throwing", () => {
    // A ruleset declares its own deck, so a face outside this map is possible on
    // the wire. A blank half is a tile that still paints.
    expect(litCells(getPipMask(9))).toEqual([]);
    expect(getPipMask(9)).toHaveLength(PIP_CELLS);
  });

  it("does not let one face's mask leak into the next call", () => {
    const six = getPipMask(6);

    getPipMask(0);

    expect(litCells(six)).toHaveLength(6);
  });
});

describe("the tile string", () => {
  it("accepts the two-character value the wire carries", () => {
    expect(isTileValue("21")).toBe(true);
    expect(isTileValue("00")).toBe(true);
    expect(isTileValue("66")).toBe(true);
  });

  it("keeps the two faces in the order the string gives them", () => {
    // TR-02: `21` and `12` are different tiles, so the faces are never sorted.
    expect(tileFaces("21")).toEqual([ 2, 1 ]);
    expect(tileFaces("12")).toEqual([ 1, 2 ]);
  });

  it("refuses anything that is not two drawable faces", () => {
    for (const value of [ "", "2", "212", "2|1", "7", "77", "2a", " 21" ]) {
      expect(isTileValue(value)).toBe(false);
      expect(tileFaces(value)).toBeNull();
    }
  });

  it("does not treat the doubles as a special case", () => {
    // Every double parses by the same expression as every other tile: the pip
    // renderer has no idea that one of them ends a stage.
    for (const [ face ] of FACES) {
      expect(tileFaces(`${face}${face}`)).toEqual([ face, face ]);
    }
  });
});
