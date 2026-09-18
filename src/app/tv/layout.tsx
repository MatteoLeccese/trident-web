import type { ReactNode } from "react";

/**
 * Every watch screen is dark, whatever the television says it prefers.
 *
 * The theme is otherwise the system's, which is right for a phone somebody is
 * holding and wrong for the other half of this product: a television that
 * reports a light preference — and plenty do, out of the box, with nobody having
 * chosen it — would serve a bone-white rectangle into a room with the lights
 * down. That is not a preference being honoured, it is a wall of light in
 * somebody's living room.
 *
 * It is forced by the class the dark variant is defined on, applied here on a
 * wrapper, rather than by the theme provider: no script runs, so there is no
 * flash of the wrong theme while one loads, and nothing on the phone's side of
 * the app changes. The background is set explicitly because this element is
 * where the dark tokens start, and the page under it is painted from the
 * document's.
 */
export default function TvLayout ({ children }: { children: ReactNode; }) {
  return (
    <div data-forced-dark="" className="dark flex h-full min-h-0 flex-1 flex-col bg-background text-foreground">
      {children}
    </div>
  );
}
