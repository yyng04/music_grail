import { describe, expect, it } from "vitest";
import {
  cagedPositions,
  chordTones,
  guideShapes,
  harmonyShapes,
  pairShapes,
  triadShapes,
} from "../../src/relations/index.ts";
import { tuning } from "../../src/theory/index.ts";

const GUITAR = tuning("guitar", "standard").strings;
const G_MAJOR = { tonic: "G", kind: "major" } as const;
// Strings by number (1 = high E) as tuning indices (0 = low E).
const S123 = [3, 4, 5] as const;

describe("triads and inversions (§8.1)", () => {
  it("names C major's inversions by the bass note: C E G, E G C, G C E", () => {
    const shapes = triadShapes(GUITAR, [2, 3, 4], chordTones("C"), 24);
    const byTag = (tag: string) =>
      shapes.find((s) => s.tag === tag)?.dots.map((d) => d.name);
    expect(byTag("Root position")?.[0]).toBe("C");
    expect(byTag("1st inversion")?.[0]).toBe("E");
    expect(byTag("2nd inversion")?.[0]).toBe("G");
  });

  it("G major on strings 1-2-3: one G, B and D per shape, one per string, within 4 frets", () => {
    const shapes = triadShapes(GUITAR, S123, chordTones("G"), 24);
    expect(shapes.length).toBeGreaterThanOrEqual(3);
    for (const s of shapes) {
      expect(s.dots.map((d) => d.name).sort()).toEqual(["B", "D", "G"]);
      expect(new Set(s.dots.map((d) => d.string)).size).toBe(3);
      expect(s.high - s.low).toBeLessThanOrEqual(3);
      const bass = s.dots.find((d) => d.string === 3)?.role;
      expect(s.tag).toBe(
        bass === "root"
          ? "Root position"
          : bass === "third"
            ? "1st inversion"
            : "2nd inversion",
      );
    }
    expect(new Set(shapes.map((s) => s.tag)).size).toBe(3);
  });

  it("steps up the neck", () => {
    const shapes = triadShapes(GUITAR, S123, chordTones("G"), 24);
    const lows = shapes.map((s) => s.low);
    expect(lows).toEqual([...lows].sort((a, b) => a - b));
  });
});

describe("two-note chords (§8.1)", () => {
  const firstOctave = (shapes: ReturnType<typeof harmonyShapes>) =>
    shapes
      .slice(0, 7)
      .map((s) => `${s.dots.map((d) => d.name).join("-")} ${s.tag}`);

  it("G major in 3rds", () => {
    expect(firstOctave(harmonyShapes(GUITAR, G_MAJOR, 2, [3, 4], 24))).toEqual([
      "G-B M3",
      "A-C m3",
      "B-D m3",
      "C-E M3",
      "D-F# M3",
      "E-G m3",
      "F#-A m3",
    ]);
  });

  it("G major in 6ths", () => {
    const shapes = harmonyShapes(GUITAR, G_MAJOR, 5, [3, 5], 24);
    const tag = (low: string) =>
      shapes.find((s) => s.dots[0]?.name === low)?.tag;
    expect(["G", "A", "B", "C", "D", "E", "F#"].map(tag)).toEqual([
      "M6",
      "M6",
      "m6",
      "M6",
      "M6",
      "m6",
      "m6",
    ]);
  });

  it.each([
    ["root", "third", "G-B", "M3"],
    ["root", "fifth", "G-D", "P5"],
    ["third", "seventh", "B-F", "d5"],
    ["root", "seventh", "G-F", "m7"],
  ] as const)("pairs from G7: %s + %s is %s %s", (a, b, names, interval) => {
    const tones = chordTones("G7");
    const [x, y] = [a, b].map((r) => tones.find((t) => t.role === r));
    if (!x || !y) throw new Error("missing tone");
    const shape = pairShapes(GUITAR, x, y, 24).find(
      (s) => s.dots.map((d) => d.name).join("-") === names,
    );
    expect(shape?.tag).toBe(interval);
    expect(shape && shape.high - shape.low).toBeLessThanOrEqual(3);
  });
});

describe("guide tones", () => {
  it("Am7 → D7: C held, G → F#", () => {
    const shape = guideShapes(GUITAR, "Am7", "D7", 24).find(
      (s) => s.dots[0]?.name === "C",
    );
    expect(shape?.moves?.map((m) => m.held)).toEqual([true, false]);
    expect(shape?.next?.map((d) => d.name)).toEqual(["C", "F#"]);
  });
});

describe("CAGED positions", () => {
  it("G major in neck order, each 4 frets", () => {
    expect(cagedPositions(G_MAJOR)).toEqual([
      { name: "G", from: 0, to: 3 },
      { name: "E", from: 2, to: 5 },
      { name: "D", from: 4, to: 7 },
      { name: "C", from: 7, to: 10 },
      { name: "A", from: 9, to: 12 },
    ]);
  });
});
