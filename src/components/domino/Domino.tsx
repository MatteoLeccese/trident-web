import type { FC } from "react";
import styles from "./Domino.module.css";

interface IDominoProps {
  dominoNumber: string;
  inclinationDegrees?: number;
}

// Defines which grid cells get a dot for each pip‐count (0–6)
const pipCoordsMap: Record<number, [number, number][]> = {
  0: [],
  1: [ [ 1, 1 ] ],
  2: [ [ 0, 0 ], [ 2, 2 ] ],
  3: [ [ 0, 0 ], [ 1, 1 ], [ 2, 2 ] ],
  4: [ [ 0, 0 ], [ 0, 2 ], [ 2, 0 ], [ 2, 2 ] ],
  5: [ [ 0, 0 ], [ 0, 2 ], [ 1, 1 ], [ 2, 0 ], [ 2, 2 ] ],
  6: [ [ 0, 0 ], [ 0, 2 ], [ 1, 0 ], [ 1, 2 ], [ 2, 0 ], [ 2, 2 ] ],
};

/**
 * Returns a flat array of length 9 (3×3) where true means “draw a dot”
 */
function getPipMask (count: number): boolean[] {
  const mask = Array(9).fill(false);
  for (const [ r, c ] of pipCoordsMap[count] || []) {
    mask[r * 3 + c] = true;
  }
  return mask;
}

const Domino: FC<IDominoProps> = ({
  dominoNumber,
  inclinationDegrees = 0,
}) => {
  // Validate format: exactly two digits 0–6
  if (!(/^[0-6]{2}$/).test(dominoNumber)) {
    console.error(`Invalid dominoNumber: "${dominoNumber}"`);
    return null;
  }

  const topCount = parseInt(dominoNumber[0], 10);
  const bottomCount = parseInt(dominoNumber[1], 10);

  const topMask = getPipMask(topCount);
  const bottomMask = getPipMask(bottomCount);

  return (
    <div
      className={styles.domino}
      style={{ transform: `rotate(${inclinationDegrees}deg)` }}
    >
      {[ topMask, bottomMask ].map((mask, sideIdx) => (
        <div key={sideIdx} className={styles.side}>
          {mask.map((hasDot, cellIdx) => (
            <div key={cellIdx} className={styles.cell}>
              {hasDot && <span className={styles.dot} />}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default Domino;
