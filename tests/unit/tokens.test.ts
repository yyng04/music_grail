import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  new URL("../../src/design/tokens.css", import.meta.url),
  "utf8",
);

function token(name: string): string | undefined {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(css);
  return match?.[1]?.trim().toUpperCase();
}

describe("design tokens", () => {
  it.each([
    ["bg", "#0B0D12"],
    ["surface", "#141821"],
    ["surface-2", "#1C2230"],
    ["text", "#E6E8EE"],
    ["text-muted", "#7A8194"],
    ["line", "#2A3142"],
    ["fn-root", "#F5B84A"],
    ["fn-third", "#4FC3F7"],
    ["fn-fifth", "#9C7CF4"],
    ["fn-seventh", "#F06292"],
    ["fn-other", "#727B90"],
  ])("defines --%s as %s", (name, value) => {
    expect(token(name)).toBe(value);
  });
});
