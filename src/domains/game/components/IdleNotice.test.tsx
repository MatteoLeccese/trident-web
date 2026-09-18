import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IdleNotice } from "./IdleNotice";

const LAST = "2026-09-17T20:00:00+00:00";
const AT = Date.parse(LAST);
const MINUTE = 60_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AT);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the television's idle notice", () => {
  it("says nothing while the game is moving", () => {
    const { container } = render(<IdleNotice lastActivityAt={LAST} noticeMinutes={10} />);

    expect(container.querySelector("[data-idle-notice]")).toBeNull();
  });

  it("appears once the silence reaches the threshold the snapshot carried", async () => {
    // The threshold is the server's, not this bundle's: a television arrives by
    // join code and never saw the creation response.
    const { container } = render(<IdleNotice lastActivityAt={LAST} noticeMinutes={10} tickMs={1000} />);

    await act(async () => {
      vi.setSystemTime(AT + 11 * MINUTE);
      vi.advanceTimersByTime(1000);
    });

    expect(container.querySelector("[data-idle-notice]")).not.toBeNull();
    expect(screen.getByText(/10 minutes/)).toBeInTheDocument();
  });

  it("goes away again when the game comes back to life", async () => {
    const view = render(<IdleNotice lastActivityAt={LAST} noticeMinutes={10} tickMs={1000} />);

    await act(async () => {
      vi.setSystemTime(AT + 11 * MINUTE);
      vi.advanceTimersByTime(1000);
    });

    expect(view.container.querySelector("[data-idle-notice]")).not.toBeNull();

    // A new write arrives with a newer timestamp, and the notice was never a
    // verdict about the game.
    view.rerender(
      <IdleNotice
        lastActivityAt={new Date(AT + 11 * MINUTE).toISOString()}
        noticeMinutes={10}
        tickMs={1000}
      />,
    );

    expect(view.container.querySelector("[data-idle-notice]")).toBeNull();
  });

  it("offers a way out and never takes one", async () => {
    const { container } = render(<IdleNotice lastActivityAt={LAST} noticeMinutes={10} tickMs={1000} />);

    await act(async () => {
      vi.setSystemTime(AT + 30 * MINUTE);
      vi.advanceTimersByTime(1000);
    });

    expect(container.querySelector("[data-idle-exit]")).toHaveAttribute("href", "/tv");
  });

  it("says nothing when the deployment set no threshold", async () => {
    const { container } = render(<IdleNotice lastActivityAt={LAST} noticeMinutes={0} tickMs={1000} />);

    await act(async () => {
      vi.setSystemTime(AT + 600 * MINUTE);
      vi.advanceTimersByTime(1000);
    });

    expect(container.querySelector("[data-idle-notice]")).toBeNull();
  });
});
