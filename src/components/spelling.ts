import type { Role } from "../relations/index.ts";
import type { Kind } from "../theory/index.ts";

const TONES = new Set<Role>(["root", "third", "fifth", "seventh"]);
/** Root, 3rd, 5th and 7th get a ring and a role word; other scale tones do not. */
export const isChordTone = (role: Role) => TONES.has(role);

/**
 * Display only. Data stays ASCII (F#, Bb, m7b5); the screen shows ♯ and ♭,
 * set in Noto Music because the text face has no accidentals (DESIGN.md).
 */
const GLYPH: Record<string, string> = { "#": "♯", "##": "𝄪", b: "♭", bb: "𝄫" };

export type Segment = { text: string; accidental?: boolean };

/** Splits "C#m7b5" into ["C", "♯"(acc), "m7", "♭"(acc), "5"]. */
export function segments(text: string): Segment[] {
  const out: Segment[] = [];
  const pattern = /([A-G])(##|#|bb|b)|(^|[^A-Za-z])(##|#|bb|b)(?=\d)/g;
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    const start = m.index;
    const before = m[1] ?? m[3] ?? "";
    const acc = m[2] ?? m[4] ?? "";
    out.push({ text: text.slice(last, start) + before });
    out.push({ text: GLYPH[acc] ?? acc, accidental: true });
    last = start + m[0].length;
  }
  out.push({ text: text.slice(last) });
  return out.filter((s) => s.text !== "");
}

/** A chord symbol as displayed: dim → °, aug → +. */
export function chordLabel(symbol: string): string {
  return symbol
    .replace(/dim7$/, "°7")
    .replace(/dim$/, "°")
    .replace(/aug$/, "+");
}

export function kindLabel(kind: Kind): string {
  return kind.replace("-", " ");
}

export function targetName(target: { tonic: string; kind: Kind }): string {
  return `${target.tonic} ${kindLabel(target.kind)}`;
}

/** A name for screen readers: "Gb" → "G flat", "F#" → "F sharp". */
export function spokenName(text: string): string {
  const words: Record<string, string> = {
    "♯": " sharp",
    "♭": " flat",
    "𝄪": " double sharp",
    "𝄫": " double flat",
  };
  return segments(text)
    .map((s) => (s.accidental ? (words[s.text] ?? s.text) : s.text))
    .join("");
}
