import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomConfigSpec } from "@/domains/game/types";
import { gameState } from "@/domains/game/testing/snapshot";

const mocks = vi.hoisted(() => ({
  roomConfigSpec: vi.fn(),
  renameSeat: vi.fn(),
  reorderSeats: vi.fn(),
  configureRoom: vi.fn(),
  start: vi.fn(),
}));

vi.mock("@/domains/game/services/gameApi", () => ({ gameApi: mocks }));

const { Lobby } = await import("./Lobby");

const GAME_ID = "00000000-0000-4000-8000-000000000001";

/** An invented declaration: the form is generated, so the lobby has never seen it before. */
const SPEC: RoomConfigSpec = {
  rule_set_id: "some.ruleset",
  fields: [
    { key: "some.text", kind: "text", label: "Some text", default: "A default.", max_length: 20, options: [] },
  ],
};

const LOBBY = gameState({ status: "lobby", currentSeat: null, version: 3, pool: [] });

function lobby () {
  const receive = vi.fn();
  const view = render(
    <Lobby gameId={GAME_ID} state={LOBBY} receive={receive} spectatorUrl="http://phone.local/tv/x" />,
  );

  /*
   * A name appears twice in the lobby on purpose — once in the list that renames
   * and once in the list that reorders — so a query has to say which one.
   */
  const nameInList = (seat: number): HTMLElement => {
    const found = view.container.querySelector<HTMLElement>(`[data-seat-list] [data-seat="${seat}"]`);

    if (found === null) {
      throw new Error(`Seat ${seat} is not in the list of names.`);
    }

    return found;
  };

  return { ...view, receive, nameInList };
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.roomConfigSpec.mockResolvedValue(SPEC);
  mocks.start.mockResolvedValue({ state: gameState({ version: 4 }), conflicted: false });
  mocks.reorderSeats.mockResolvedValue({ state: gameState({ version: 4, status: "lobby" }), conflicted: false });
  mocks.renameSeat.mockResolvedValue({ state: gameState({ version: 4, status: "lobby" }), conflicted: false });
  mocks.configureRoom.mockResolvedValue({ state: gameState({ version: 4, status: "lobby" }), conflicted: false });
});

afterEach(cleanup);

describe("the table before it starts", () => {
  it("shows the code and the link a television needs", () => {
    lobby();

    expect(screen.getByText("K7QP3M")).toBeInTheDocument();
    expect(screen.getByText("http://phone.local/tv/x")).toBeInTheDocument();
  });

  it("generates the settings form from the declaration it fetched", async () => {
    lobby();

    await waitFor(() => expect(screen.getByLabelText("Some text")).toBeInTheDocument());

    expect(mocks.roomConfigSpec).toHaveBeenCalledWith(GAME_ID);
  });

  it("says so, and keeps the rest of the lobby, when the declaration cannot be read", async () => {
    mocks.roomConfigSpec.mockRejectedValue(new Error("nope"));

    const { container } = lobby();

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("settings this game takes"));

    expect(container.querySelector("[data-seat-order]")).not.toBeNull();
    expect(container.querySelector("[data-start-game]")).not.toBeNull();
  });

  it("saves the settings against the version it read", async () => {
    lobby();

    await waitFor(() => expect(screen.getByLabelText("Some text")).toBeInTheDocument());

    await userEvent.click(screen.getByText("Save the settings"));

    expect(mocks.configureRoom).toHaveBeenCalledWith(GAME_ID, { "some.text": "A default." }, 3);
  });

  it("saves the ring as an absolute permutation against the version it read", async () => {
    lobby();

    await userEvent.click(screen.getByLabelText("Move Carla up"));
    await userEvent.click(screen.getByText("Save the order"));

    expect(mocks.reorderSeats).toHaveBeenCalledWith(GAME_ID, [ 1, 3, 2 ], 3);
  });

  it("renames a seat against the version it read and closes the box when it lands", async () => {
    const { container, nameInList } = lobby();

    await userEvent.click(nameInList(2));
    await userEvent.clear(screen.getByLabelText("New name"));
    await userEvent.type(screen.getByLabelText("New name"), "Bea");
    await userEvent.click(screen.getByText("Save"));

    expect(mocks.renameSeat).toHaveBeenCalledWith(GAME_ID, 2, "Bea", 3);
    await waitFor(() => expect(container.querySelector("input[aria-label='New name']")).toBeNull());
  });

  it("leaves the box open, with what came back on it, when a rename is refused", async () => {
    mocks.renameSeat.mockResolvedValue({ state: gameState({ version: 9, status: "lobby" }), conflicted: true });

    const { nameInList } = lobby();

    await userEvent.click(nameInList(2));
    await userEvent.click(screen.getByText("Save"));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("The game had already moved on."));
    expect(screen.getByLabelText("New name")).toBeInTheDocument();
  });

  it("starts the game against the version it read, and says nothing about what it deals", async () => {
    // What stage it opens in, what pool it lays out and who draws first are the
    // ruleset's answers. A client that could name any of them would be naming a
    // rule.
    lobby();

    await userEvent.click(screen.getByText("Start the game"));

    expect(mocks.start).toHaveBeenCalledWith(GAME_ID, 3);
    expect(mocks.start).toHaveBeenCalledTimes(1);
  });

  it("applies whatever a write answers with", async () => {
    const { receive } = lobby();

    await userEvent.click(screen.getByText("Start the game"));

    await waitFor(() => expect(receive).toHaveBeenCalledOnce());
  });
});
