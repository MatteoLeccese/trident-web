import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: [ "latin" ],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: [ "latin" ],
});

export const metadata: Metadata = {
  title: "Trident",
  description: "A domino game to play with friends around a table.",
};

export const viewport: Viewport = {
  // The phone gets passed from hand to hand: no accidental zoom when touching a tile.
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#121a16" },
  ],
};

export default function RootLayout ({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/*
        * A real height and not a minimum. Every screen under here sizes its
        * board by measuring the box it was given, and `min-height` leaves that
        * box resolving against its own content: the measurement then answers
        * with the largest tile that fits the content it just produced, the
        * content grows to match, and the phone's board comes out several
        * viewports tall with its own scroller inert. A definite height is what
        * makes `flex-1` below mean "the space that is left".
        *
        * Overflow stays visible: a screen whose content is honestly taller than
        * the viewport — the lobby — still scrolls the page.
        */}
      <body className="h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
