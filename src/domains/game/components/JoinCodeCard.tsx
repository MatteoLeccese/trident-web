"use client";

import { QRCodeSVG } from "qrcode.react";

/**
 * What the television has to open.
 *
 * The code is large because it is typed with a remote control, from the sofa,
 * and the QR because another phone scans it. Both carry only the **read**
 * credential.
 *
 * Rendered only while the game holds a code: a finished game has released it.
 */
export function JoinCodeCard ({ code, url }: { code: string; url: string; }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 text-center">
      <p className="text-sm text-muted-foreground">Open this on the television</p>

      <p className="font-mono text-4xl font-bold tracking-[0.2em] tabular-nums">{code}</p>

      <div className="rounded-lg bg-white p-3">
        <QRCodeSVG value={url} size={132} />
      </div>

      <p className="break-all font-mono text-xs text-muted-foreground">{url}</p>
    </div>
  );
}
