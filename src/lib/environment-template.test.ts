import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The template and the code, held against each other.
 *
 * **A template that lies is worse than one that is short.** This one declared
 * five variables nothing reads — a Reverb scheme and four table limits — so
 * anybody who set `NEXT_PUBLIC_TRIDENT_MAX_PLAYERS=10` would have watched the
 * app keep accepting fifteen and had no way of finding out why.
 *
 * It is worse here than on the server, because every `NEXT_PUBLIC_` value is
 * inlined into the bundle at build time: the feedback for setting one wrongly is
 * not an error, it is nothing at all.
 */

const ROOT = join(import.meta.dirname, "..", "..");

const TEMPLATE = readFileSync(join(ROOT, ".env.example"), "utf8");

/** Variables the runtime provides; nobody puts these in a template. */
const NOT_OURS = new Set([ "NODE_ENV", "CI" ]);

/** Read by the end-to-end runner and by nothing the product ships. */
const TEST_ONLY = new Set([ "TRIDENT_E2E_REUSE_SERVER" ]);

function sourceFiles (directory: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(join(ROOT, directory), { withFileTypes: true, recursive: true })) {
    if (entry.isFile() && (/\.(ts|tsx|mts)$/).test(entry.name)) {
      found.push(join(entry.parentPath, entry.name));
    }
  }

  return found;
}

function declared (): string[] {
  return [ ...TEMPLATE.matchAll(/^([A-Z][A-Z0-9_]*)=/gm) ].map((match) => match[1] as string).sort();
}

function read (): string[] {
  const names = new Set<string>();

  for (const file of [ ...sourceFiles("src"), join(ROOT, "next.config.ts") ]) {
    for (const match of readFileSync(file, "utf8").matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
      const name = match[1] as string;

      if (!NOT_OURS.has(name) && !TEST_ONLY.has(name)) {
        names.add(name);
      }
    }
  }

  return [ ...names ].sort();
}

describe("the environment template", () => {
  it("is the only one, and it is read at all", () => {
    // One template and not one per environment: this product runs one way.
    const templates = readdirSync(ROOT).filter((name) => name.startsWith(".env.example"));

    expect(templates).toEqual([ ".env.example" ]);
    expect(declared().length).toBeGreaterThan(0);
  });

  it("offers every setting the app reads", () => {
    const missing = read().filter((name) => !declared().includes(name));

    expect(missing, `read by src/ and absent from .env.example: ${missing.join(", ")}`).toEqual([]);
  });

  it("declares nothing that is read by nobody", () => {
    // The five that were here: NEXT_PUBLIC_REVERB_SCHEME and the four table
    // limits. Setting one changed nothing, silently.
    const phantom = declared().filter((name) => !read().includes(name));

    expect(phantom, `in .env.example and read by nothing: ${phantom.join(", ")}`).toEqual([]);
  });

  it("says out loud which half of it is baked into the bundle", () => {
    // The single most surprising thing about configuring this app: a
    // NEXT_PUBLIC_ value set on a running container changes nothing, because it
    // was inlined when the image was built.
    expect(TEMPLATE).toContain("BUILD TIME");
  });

  it("keeps the backend URL off the browser", () => {
    // It must never carry the NEXT_PUBLIC_ prefix: the browser talks to this app
    // and this app talks to Laravel, which is the whole point of the BFF.
    expect(TEMPLATE).toContain("BACKEND_API_URL=");
    expect(TEMPLATE).not.toContain("NEXT_PUBLIC_BACKEND");
  });
});
