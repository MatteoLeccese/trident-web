import { expect, type Page } from "@playwright/test";
import type { GameState } from "@/domains/game/types";

/**
 * The two clients of this product, and the moves a spec makes with them.
 *
 * Everything here is addressed by the DOM hooks the screens already carry
 * (`[data-position]`, `[data-confirm-draw]`, `[data-handoff-button]`…) or by an
 * accessible name. Nothing reads a face, a stage, a settings key or a role: a
 * position to draw is chosen by asking the board which tiles are face down, and
 * what came up is read back off the screen rather than expected.
 */

/** A phone in a hand. */
export const PHONE = { width: 390, height: 844 } as const;

/** A television across the room, at the resolution a cheap smart TV reports. */
export const TELEVISION = { width: 1280, height: 720 } as const;

/**
 * What the television is allowed to take to show what a write produced.
 *
 * It is a deadline on an event-driven wait and never a sleep: the clock starts
 * on the tap that writes and stops when the board is on screen.
 */
export const SOCKET_BUDGET_MS = 2_000;

/** The one event the feed carries. Everything else on that socket is protocol. */
const STATE_EVENT = "GameStateChanged";

export interface StateFrame {

  /** Wall clock, so a frame can be placed against the tap that caused it. */
  at: number;

  state: GameState;
}

export interface Feed {

  /** Every socket the page opened, by url. */
  sockets: string[];

  /** Every state frame that arrived over one of them, in order. */
  frames: StateFrame[];

  /** When the page read this game's state over HTTP, which is the other delivery path. */
  reads: number[];

  /**
   * The frame at that index, waiting for it if it has not arrived yet.
   *
   * A deadline and not a sleep: it settles the instant the frame is delivered,
   * and an index that has already arrived resolves without waiting at all, which
   * is what keeps a fast frame from racing the caller.
   */
  frameAfter: (index: number, timeoutMs: number) => Promise<StateFrame>;
}

/**
 * Records what actually reached a page, by both paths.
 *
 * The socket is read as frames and not as a connection being up, because a
 * television updating tells you nothing about which path fed it. Counting the
 * HTTP reads beside them is what turns "it arrived in time" into "it arrived
 * over the socket".
 *
 * Attach it before navigating: frames that arrive during the load are frames.
 */
export function watchFeed (page: Page): Feed {
  const frames: StateFrame[] = [];
  const waiting = new Set<() => void>();

  const feed: Feed = {
    sockets: [],
    frames,
    reads: [],
    frameAfter: (index, timeoutMs) => new Promise<StateFrame>((resolve, reject) => {
      const deadline = setTimeout(() => {
        waiting.delete(check);
        reject(new Error(`No state frame reached the watching screen within ${timeoutMs} ms.`));
      }, timeoutMs);

      function check (): void {
        const frame = frames[index];

        if (frame !== undefined) {
          clearTimeout(deadline);
          waiting.delete(check);
          resolve(frame);
        }
      }

      waiting.add(check);
      check();
    }),
  };

  page.on("websocket", (socket) => {
    feed.sockets.push(socket.url());

    socket.on("framereceived", (frame) => {
      const state = stateFrom(frame.payload);

      if (state !== null) {
        frames.push({ at: Date.now(), state });

        for (const notify of [ ...waiting ]) {
          notify();
        }
      }
    });
  });

  page.on("request", (request) => {
    if (request.url().includes("/api/proxy/games/")) {
      feed.reads.push(Date.now());
    }
  });

  return feed;
}

/**
 * The snapshot inside a socket frame, or null if the frame is not one.
 *
 * The transport wraps it twice: an envelope naming the event, whose `data` is
 * itself a JSON string. A frame that does not parse is not a state frame, which
 * is the same answer the client's own guard gives.
 */
function stateFrom (payload: string | Buffer): GameState | null {
  if (typeof payload !== "string") {
    return null;
  }

  try {
    const envelope: unknown = JSON.parse(payload);

    if (typeof envelope !== "object" || envelope === null) {
      return null;
    }

    const { event, data } = envelope as { event?: unknown; data?: unknown; };

    if (event !== STATE_EVENT || typeof data !== "string") {
      return null;
    }

    const state: unknown = JSON.parse(data);

    return typeof state === "object" && state !== null && "version" in state && "pool" in state
      ? state as GameState
      : null;
  } catch {
    return null;
  }
}

/** The positions a state carries a face at, ascending: the board it describes. */
export function boardOf (state: GameState): number[] {
  return state.pool
    .filter((entry) => entry.tile !== null)
    .map((entry) => entry.position)
    .sort((left, right) => left - right);
}

/**
 * Creates a game from the phone's own front page and returns its id.
 *
 * It goes through the screen rather than through the API because the thing being
 * set up is the credential: the write token is issued by this POST, and it is
 * this browser context's cookie jar that must end up holding it.
 */
export async function createGame (page: Page, nicknames: string[]): Promise<string> {
  await page.goto("/");

  for (const nickname of nicknames) {
    await page.getByLabel("Player name").fill(nickname);
    await page.getByRole("button", { name: "Add player" }).click();
  }

  await page.getByRole("button", { name: `Start with ${nicknames.length}` }).click();
  await page.waitForURL(/\/play\/[0-9a-f-]{36}$/);

  const gameId = new URL(page.url()).pathname.split("/").pop() ?? "";

  expect(gameId).not.toBe("");

  return gameId;
}

/** Deals the first pool. The board is on screen when this resolves. */
export async function startGame (page: Page): Promise<void> {
  await page.locator("[data-start-game]").click();

  /*
   * The first turn is gated like the other ninety-seven. Whoever typed the names
   * and tapped start is holding the phone, and at a table of five the first seat
   * is somebody else four times in five, so the game opens on a hand-off and not
   * on a live board.
   */
  await page.locator("[data-handoff-button]").click();
  await page.locator("[data-tile-grid]").waitFor();
}

/** The lowest position the board still shows face down, which is a position a tap can take. */
export async function firstFaceDown (page: Page): Promise<number> {
  const positions = await positionsWith(page, "[data-bevel]");

  expect(positions.length).toBeGreaterThan(0);

  return positions[0] as number;
}

/** Every position the board shows face up, ascending. It is what two screens are compared on. */
export function faceUp (page: Page): Promise<number[]> {
  return positionsWith(page, "[data-pips]");
}

async function positionsWith (page: Page, inner: string): Promise<number[]> {
  const cells = page.locator(`[data-tile-grid] li[data-position]:has(${inner})`);
  const attributes = await cells.evaluateAll(
    (nodes) => nodes.map((node) => node.getAttribute("data-position")),
  );

  return attributes
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value))
    .sort((left, right) => left - right);
}

/** A tap on a tile. It reaches nothing: the question that follows is client state. */
export async function tap (page: Page, position: number): Promise<void> {
  await page.locator(`[data-position="${position}"] button`).click();
  await page.locator("[data-confirm-sheet]").waitFor();
}

/** The one transition of a turn that writes. */
export async function confirmDraw (page: Page): Promise<void> {
  await page.locator("[data-confirm-draw]").click();
}

/** Reads the result, passes the phone on, and leaves it back on the board. */
export async function readAndPass (page: Page): Promise<void> {
  await page.locator("[data-turn-continue]").click();
  await page.locator("[data-handoff-button]").click();
  await page.locator("[data-tile-grid]").waitFor();
}

/** A whole turn, for the draws a spec needs behind it rather than under measurement. */
export async function drawOnce (page: Page): Promise<number> {
  const position = await firstFaceDown(page);

  await tap(page, position);
  await confirmDraw(page);
  await readAndPass(page);

  return position;
}

export interface Delivery {

  /** From the tap that wrote to the board being on the watching screen. */
  elapsedMs: number;

  /** The state that write produced, as the socket delivered it. */
  frame: StateFrame;

  /** HTTP reads the watcher made while that was happening. Zero is the claim. */
  reads: number;

  /** When the tap happened, so a frame's arrival can be placed against it. */
  tappedAt: number;
}

/**
 * Measures what it takes for a write on one screen to be on another.
 *
 * The clock starts before the tap and stops when the watching board matches the
 * state the socket delivered, so the number covers the write, the broadcast and
 * the paint, and nothing in between is waited out on a timer. The frames and the
 * reads are recorded over the same window, which is what says which path
 * delivered it.
 *
 * **The board it waits for comes from the frame, not from the position that was
 * tapped.** A draw does not always leave that tile on the board: a stage
 * boundary deals a new pool (TR-04, TR-25), and the one that crosses it is the
 * ruleset's to choose. Waiting for the board the state describes is right either
 * way, and it is why this measurement cannot be made to fail by a legal outcome.
 *
 * It refuses to measure a turn that starts from an empty board, because then
 * "the board became what the state says" could be satisfied by nothing changing
 * at all.
 */
export async function deliveryOf (options: {
  write: () => Promise<void>;
  watcher: Page;
  feed: Feed;
  budgetMs?: number;
}): Promise<Delivery> {
  const { write, watcher, feed } = options;
  const budgetMs = options.budgetMs ?? SOCKET_BUDGET_MS;

  expect(
    (await faceUp(watcher)).length,
    "the measured turn starts from a board with tiles on it, so the change cannot be nothing",
  ).toBeGreaterThan(0);

  const framesBefore = feed.frames.length;
  const readsBefore = feed.reads.length;
  const tappedAt = Date.now();

  await write();

  const frame = await feed.frameAfter(framesBefore, budgetMs);
  const board = boardOf(frame.state);

  await watcher.waitForFunction(
    (expected: number[]) => {
      const shown = Array.from(document.querySelectorAll("[data-tile-grid] li[data-position]"))
        .filter((cell) => cell.querySelector("[data-pips]") !== null)
        .map((cell) => Number(cell.getAttribute("data-position")))
        .sort((left, right) => left - right);

      return shown.length === expected.length && shown.every((value, index) => value === expected[index]);
    },
    board,
    { timeout: Math.max(1, budgetMs - (Date.now() - tappedAt)), polling: "raf" },
  );

  const delivery: Delivery = {
    elapsedMs: Date.now() - tappedAt,
    frame,
    reads: feed.reads.length - readsBefore,
    tappedAt,
  };

  /* Printed: a budget whose margin nobody ever sees is a budget that drifts unnoticed. */
  process.stdout.write(
    `      delivered in ${delivery.elapsedMs} ms · version ${frame.state.version} · ${delivery.reads} http read(s)\n`,
  );

  return delivery;
}

/** The accessible name of the tile at a position, as that screen paints it. */
export function tileLabelAt (page: Page, position: number): Promise<string | null> {
  return page.locator(`[data-position="${position}"] [role="img"]`).getAttribute("aria-label");
}

/**
 * The faces named inside an accessible tile name.
 *
 * The two screens paint the same tile in two different places — one cell of a
 * board, and one tile on its own — so the names they give it carry different
 * clauses around the same two faces. What crosses both paths and has to agree is
 * the faces, and this is what is compared.
 */
export function facesIn (label: string | null): string | null {
  const found = label === null ? null : (/tile (\d+) (\d+)/iu).exec(label);

  return found === null ? null : `${found[1]} ${found[2]}`;
}
