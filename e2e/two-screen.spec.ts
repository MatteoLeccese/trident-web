import { type Browser, type Page, expect, test } from "@playwright/test";
import {
  PHONE,
  SOCKET_BUDGET_MS,
  TELEVISION,
  confirmDraw,
  createGame,
  deliveryOf,
  drawOnce,
  faceUp,
  facesIn,
  firstFaceDown,
  startGame,
  tap,
  tileLabelAt,
  watchFeed,
} from "./support/table";

/**
 * The product, end to end: one phone that writes and one television that
 * watches, in two browsers that share nothing but a game.
 *
 * **Two contexts, never two pages.** A browser context is the cookie jar, so the
 * phone holding the write credential and the television holding none is not a
 * thing this spec arranges — it is what two contexts are
 * (trident-api/documentation/conventions/credential-model.md).
 *
 * **The two seconds are measured, not slept.** There is no
 * `waitForTimeout` in this file. Every wait is a deadline on an event: the clock
 * starts on the tap that writes and stops when the tile is in the television's
 * DOM. Three things then say it came over the socket and could not have come any
 * other way:
 *
 *  1. the spec records the television's WebSocket frames, waits for the one the
 *     write produced, and asserts it arrived no later than the paint — so the
 *     board on screen is that frame's board and not a coincidence;
 *  2. it counts the television's HTTP reads of the game over the same window and
 *     asserts there were none, so the reconciliation poll and the resync cannot
 *     be what fed the screen;
 *  3. the run builds the app with the poll pushed out to ten minutes
 *     (`e2e/support/stack.ts`), so no tick of it falls inside the run at all.
 *
 * **Nothing here names a rule.** A position to draw is whichever one the board
 * still shows face down, what came up is read back off the screen instead of
 * expected, and two screens are compared with each other rather than with a
 * board this file predicts — a stage boundary deals a fresh pool (TR-04, TR-25),
 * so the board after a draw is the ruleset's answer and not this spec's.
 */

const TABLE = [ "Ana", "Bea", "Caro" ];

interface Client {
  page: Page;
  cookies: () => Promise<{ name: string; httpOnly: boolean; }[]>;
  setOffline: (offline: boolean) => Promise<void>;
}

/** A device: its own context, so its own cookie jar. */
async function open (browser: Browser, viewport: { width: number; height: number; }): Promise<Client> {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  return {
    page,
    cookies: async () => (await context.cookies()).map(
      ({ name, httpOnly }) => ({ name, httpOnly }),
    ),
    setOffline: (offline: boolean) => context.setOffline(offline),
  };
}

/**
 * Plays turns until a screen's board has tiles on it.
 *
 * A draw does not always leave one there: a stage boundary deals a fresh pool,
 * and which draw crosses it is the ruleset's business (TR-24). The spec needs a
 * board with a record on it and cannot name the draw that produces one, so it
 * plays until the screen says it has one.
 */
async function playUntilBoardShows (phone: Page, watcher: Page, atLeast: number): Promise<number[]> {
  const limit = atLeast + 2;

  for (let played = 0; played < limit; played += 1) {
    await drawOnce(phone);

    const shown = await faceUp(watcher);

    if (shown.length >= atLeast) {
      return shown;
    }
  }

  throw new Error(`The board still showed fewer than ${atLeast} tiles after ${limit} turns.`);
}

test("the phone draws and the television has it, over the socket, in under two seconds", async ({ browser }) => {
  const phone = await open(browser, PHONE);
  const television = await open(browser, TELEVISION);

  /* Attached before the load: a frame that arrives while the page is opening is a frame. */
  const feed = watchFeed(television.page);

  /* The bytes the browser is handed when the credential is issued, kept to be read back. */
  const issued = phone.page.waitForResponse(
    (response) => response.url().endsWith("/api/games") && response.request().method() === "POST",
  );

  const gameId = await createGame(phone.page, TABLE);

  const jar = await phone.cookies();
  const controller = jar.find((cookie) => cookie.name === "trident_controller");

  expect(controller, "the phone's jar holds the write credential").toBeDefined();
  expect(controller?.httpOnly, "and holds it where script cannot reach it").toBe(true);

  expect(
    await phone.page.evaluate(() => document.cookie),
    "the browser's own script sees no credential",
  ).not.toContain("trident_controller");

  expect(
    await (await issued).text(),
    "and the creation response reaching the browser never carried the token",
  ).not.toContain("controller_token");

  expect(
    await television.cookies(),
    "the television arrives by link and holds nothing at all",
  ).toEqual([]);

  await television.page.goto(`/tv/${gameId}`);

  /* The one-way feed is open before anything is written, or the measurement is about a subscription. */
  await expect(television.page.getByText("Live", { exact: true })).toBeVisible();

  await startGame(phone.page);
  await television.page.locator("[data-tile-grid]").waitFor();

  /* One turn first, so the measured one starts from a board that already has a tile on it. */
  await playUntilBoardShows(phone.page, television.page, 1);

  const position = await firstFaceDown(phone.page);

  /* The tap and the question it raises reach nothing: the write is the next line. */
  await tap(phone.page, position);

  const delivery = await deliveryOf({
    write: () => confirmDraw(phone.page),
    watcher: television.page,
    feed,
  });

  expect(
    delivery.elapsedMs,
    "the television had the board that write produced within the budget, measured from the tap",
  ).toBeLessThan(SOCKET_BUDGET_MS);

  expect(
    delivery.reads,
    "and it read nothing over HTTP while that happened, so the socket is what fed it",
  ).toBe(0);

  expect(delivery.frame.state.game_id).toBe(gameId);
  expect(
    delivery.frame.at - delivery.tappedAt,
    "the frame arrived no later than the paint, which is what makes the paint its consequence",
  ).toBeLessThanOrEqual(delivery.elapsedMs);

  /*
   * The phone shows the tile it turned over, on every draw and with no exception.
   * The snapshot records the draw in its own right, so this holds across the
   * draw that ends a stage as well — the one draw whose position has already
   * been replaced by the next stage's pool (TR-04, TR-25), and the one the game
   * is named after (TR-24).
   */
  await expect(phone.page.locator(`[data-drawn-tile="${position}"] [data-pips]`)).toHaveCount(1);

  /*
   * One projection, both paths: the face the phone got in the answer to its own
   * write is the face the television got over the socket (TR-06, TR-08), read off
   * both screens rather than written down here.
   *
   * The comparison needs the tile to be on the television's board, which the
   * draw that ends a stage takes away from it: the board it paints is the new
   * pool's, and that is correct.
   */
  if (delivery.frame.state.pool.some((entry) => entry.position === position && entry.tile !== null)) {
    const onTheBoard = await tileLabelAt(television.page, position);
    const onItsOwn = await phone.page
      .locator(`[data-drawn-tile="${position}"] [role="img"]`)
      .getAttribute("aria-label");

    expect(facesIn(onTheBoard)).not.toBeNull();
    expect(facesIn(onTheBoard)).toBe(facesIn(onItsOwn));

    // The board's cell says which position it is, which is the only thing that
    // tells one cell of forty-nine from another out loud.
    expect(onTheBoard).toContain(`Position ${position}`);
  }

  /*
   * The television paints that version's effects, all of them, and is compared
   * against the frame it was sent rather than against a number this spec knows.
   */
  await expect(
    television.page.locator("[data-challenge-card], [data-role-banner], [data-announcement]"),
  ).toHaveCount(delivery.frame.state.effects.length);

  /* Read-only is structural: there is no control on that screen to find. */
  await expect(television.page.locator("[data-tile-grid] button")).toHaveCount(0);
  await expect(
    television.page.locator("[data-confirm-draw], [data-start-game], [data-play-again]"),
  ).toHaveCount(0);

  expect(
    await television.cookies(),
    "and after watching a whole turn it still holds nothing",
  ).toEqual([]);
});

test("a television joining mid-game lands on the board already in play, then rides the feed", async ({ browser }) => {
  const phone = await open(browser, PHONE);
  const television = await open(browser, TELEVISION);

  const gameId = await createGame(phone.page, TABLE);

  await television.page.goto(`/tv/${gameId}`);
  await expect(television.page.getByText("Live", { exact: true })).toBeVisible();

  await startGame(phone.page);
  await television.page.locator("[data-tile-grid]").waitFor();

  await playUntilBoardShows(phone.page, television.page, 2);

  /* A television that was not here for any of that. Its own context, so its own empty jar. */
  const latecomer = await open(browser, TELEVISION);
  const lateFeed = watchFeed(latecomer.page);

  await latecomer.page.goto(`/tv/${gameId}`);
  await latecomer.page.locator("[data-tile-grid]").waitFor();

  const board = await faceUp(television.page);

  expect(board.length, "there is a board to land on").toBeGreaterThanOrEqual(2);

  /*
   * The load path and the socket path end on the same board. That is the whole of
   * R3: the payload is a full snapshot, so the screen that has been here all
   * along and the screen that has just arrived are the same code path.
   */
  await expect.poll(() => faceUp(latecomer.page)).toEqual(board);

  expect(await latecomer.cookies(), "it joined by link, so it can only read").toEqual([]);
  expect(
    await latecomer.page.locator("[data-current-player-name]").textContent(),
    "and it names the same seat the incumbent screen does",
  ).toBe(await television.page.locator("[data-current-player-name]").textContent());

  /* From there it is an ordinary watcher: the next draw arrives on its own socket. */
  await expect(latecomer.page.getByText("Live", { exact: true })).toBeVisible();

  const position = await firstFaceDown(phone.page);

  await tap(phone.page, position);

  const delivery = await deliveryOf({
    write: () => confirmDraw(phone.page),
    watcher: latecomer.page,
    feed: lateFeed,
  });

  expect(delivery.elapsedMs).toBeLessThan(SOCKET_BUDGET_MS);
  expect(delivery.reads, "over the socket, like every other screen").toBe(0);
  expect(delivery.frame.state.game_id).toBe(gameId);

  /*
   * And a television waking up is the same path again: it reloads and lands
   * where the other one already is.
   */
  await television.page.reload();
  await television.page.locator("[data-tile-grid]").waitFor();

  await expect.poll(() => faceUp(television.page)).toEqual(await faceUp(latecomer.page));
});

test("a television whose socket dropped catches up when it comes back", async ({ browser }) => {
  const phone = await open(browser, PHONE);
  const television = await open(browser, TELEVISION);
  const feed = watchFeed(television.page);

  const gameId = await createGame(phone.page, TABLE);

  await television.page.goto(`/tv/${gameId}`);
  await expect(television.page.getByText("Live", { exact: true })).toBeVisible();

  await startGame(phone.page);
  await television.page.locator("[data-tile-grid]").waitFor();

  await playUntilBoardShows(phone.page, television.page, 1);

  /*
   * The network goes out from under the socket, and the spec waits for the
   * screen to say so rather than for a number of seconds. That wait is the
   * transport noticing a connection that is gone without having been closed,
   * which takes an activity timeout of its own; it is also the only way to reach
   * the reconnect, because a socket restored before it has been given up on
   * simply delivers what it was holding, and no reconnect ever happens.
   */
  await television.setOffline(true);
  await expect(
    television.page.getByText("Live", { exact: true }),
    "staleness is on the screen rather than left to be inferred",
  ).toHaveCount(0, { timeout: 90_000 });

  await drawOnce(phone.page);

  expect(
    await faceUp(television.page),
    "the frame was genuinely missed: the screen is behind the phone",
  ).not.toEqual(await faceUp(phone.page));

  const readsWhileBehind = feed.reads.length;

  await television.setOffline(false);

  /*
   * Coming back is not a special branch. The socket reconnects, the reconnect
   * asks for the state through the route the page load uses, and the guard
   * applies it because it is newer — the same path as a late join and as a
   * television waking up (R3). Reconciliation by poll is ten minutes out in this
   * run, so it is not what heals this.
   */
  await expect(television.page.getByText("Live", { exact: true })).toBeVisible({ timeout: 60_000 });

  await expect.poll(
    () => faceUp(television.page),
    { timeout: 30_000 },
  ).toEqual(await faceUp(phone.page));

  expect(
    feed.reads.length,
    "and it healed by reading the state again, which is what a page load does",
  ).toBeGreaterThan(readsWhileBehind);
});
