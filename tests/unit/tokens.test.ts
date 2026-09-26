import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  new URL("../../src/design/tokens.css", import.meta.url),
  "utf8",
);

function token(name: string): string | undefined {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(css);
  return match?.[1]?.trim();
}

// The approved look (DESIGN.md, round 4) replaces the spec's starting values (§4.1, §4.2).
describe("design tokens", () => {
  it.each([
    ["bg", "oklch(0.155 0.006 25)"],
    ["text", "oklch(0.955 0.004 25)"],
    ["text-muted", "oklch(0.6 0.008 25)"],
    ["fn-root", "oklch(0.86 0.14 82)"],
    ["fn-third", "oklch(0.83 0.1 230)"],
    ["fn-fifth", "oklch(0.75 0.15 300)"],
    ["fn-seventh", "oklch(0.82 0.11 172)"],
    ["fn-other", "oklch(0.6 0.012 260)"],
    ["outside-opacity", "0.4"],
  ])("defines --%s as %s", (name, value) => {
    expect(token(name)).toBe(value);
  });
});
