import { describe, expect, it } from "vitest";
import {
  cagedPositions,
  chordTones,
  describeMotion,
  guideShapes,
  guideToneMotion,
  harmonyShapes,
  pairShapes,
  stringSets,
  triadShapes,
} from "../../src/relations/index.ts";
import { tuning } from "../../src/theory/index.ts";

const GUITAR = tuning("guitar", "standard").strings;
const G_MAJOR = { tonic: "G", kind: "major" } as const;
const names = (sets: { name: string }[]) => sets.map((s) => s.name);

describe("string sets, named by their open notes (low to high)", () => {
  it("guitar: three strings, two strings, and two with one skipped", () => {
    expect(names(stringSets(GUITAR, 3))).toEqual([
      "G B E",
      "D G B",
      "A D G",
      "E A D",
    ]);
    expect(stringSets(GUITAR, 3)[0]?.strings).toEqual([3, 4, 5]);
    expect(names(stringSets(GUITAR, 2))).toEqual([
      "B E",
      "G B",
      "D G",
      "A D",
      "E A",
    ]);
    expect(names(stringSets(GUITAR, 2, true))).toEqual([
      "G E",
      "D B",
      "A G",
      "E D",
    ]);
  });

  it("bass: 4 and 5 strings", () => {
    const bass4 = tuning("bass4", "standard").strings;
    const bass5 = tuning("bass5", "standard").strings;
    expect(names(stringSets(bass4, 3))).toEqual(["A D G", "E A D"]);
    expect(names(stringSets(bass4, 2))).toEqual(["D G", "A D", "E A"]);
    expect(names(stringSets(bass5, 3))).toEqual(["A D G", "E A D", "B E A"]);
  });

  it("drop D", () => {
    const dropD = tuning("guitar", "drop-d").strings;
    expect(names(stringSets(dropD, 3))).toEqual([
      "G B E",
      "D G B",
      "A D G",
      "D A D",
    ]);
  });
});

describe("triads and inversions", () => {
  it("names C major's inversions by the bass note: C E G, E G C, G C E", () => {
    const shapes = triadShapes(GUITAR, [2, 3, 4], chordTones("C"), 24);
    const byTag = (tag: string) =>
      shapes.find((s) => s.tag === tag)?.dots.map((d) => d.name);
    expect(byTag("Root position")).toEqual(["C", "E", "G"]);
    expect(byTag("1st inversion")).toEqual(["E", "G", "C"]);
    expect(byTag("2nd inversion")).toEqual(["G", "C", "E"]);
  });

  it("G major on strings G B E: one G, B and D per shape, one per string, within 4 frets", () => {
    const shapes = triadShapes(GUITAR, [3, 4, 5], chordTones("G"), 24);
    expect(shapes.length).toBeGreaterThanOrEqual(3);
    for (const s of shapes) {
      expect(s.dots.map((d) => d.name).sort()).toEqual(["B", "D", "G"]);
      expect(new Set(s.dots.map((d) => d.string)).size).toBe(3);
      expect(s.high - s.low).toBeLessThanOrEqual(3);
      // The inversion is set by the note on string 3 (G), the lowest of the set.
      const bass = s.dots.find((d) => d.string === 3);
      expect(s.bass).toBe(bass?.name);
      expect(s.tag).toBe(
        bass?.role === "root"
          ? "Root position"
          : bass?.role === "third"
            ? "1st inversion"
            : "2nd inversion",
      );
    }
    expect(new Set(shapes.map((s) => s.tag)).size).toBe(3);
    const lows = shapes.map((s) => s.low);
    expect(lows).toEqual([...lows].sort((a, b) => a - b));
  });
});

describe("two-note chords", () => {
  const tags = (shapes: ReturnType<typeof harmonyShapes>) =>
    shapes
      .slice(0, 7)
      .map((s) => `${s.dots.map((d) => d.name).join("-")} ${s.interval ?? ""}`);

  it("G major in 3rds on strings G B", () => {
    expect(tags(harmonyShapes(GUITAR, G_MAJOR, 2, [3, 4], 24))).toEqual([
      "G-B M3",
      "A-C m3",
      "B-D m3",
      "C-E M3",
      "D-F# M3",
      "E-G m3",
      "F#-A m3",
    ]);
  });

  it("G major in 6ths on strings D B (G skipped)", () => {
    const shapes = harmonyShapes(GUITAR, G_MAJOR, 5, [2, 4], 24);
    const interval = (low: string) =>
      shapes.find((s) => s.dots[0]?.name === low)?.interval;
    expect(["G", "A", "B", "C", "D", "E", "F#"].map(interval)).toEqual([
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
  ] as const)("pairs from G7: %s + %s gives %s (%s)", (a, b, notes, iv) => {
    const tones = chordTones("G7");
    const x = tones.find((t) => t.role === a);
    const y = tones.find((t) => t.role === b);
    if (!x || !y) throw new Error("missing tone");
    const pairs = [...stringSets(GUITAR, 2), ...stringSets(GUITAR, 2, true)];
    const shape = pairs
      .flatMap((p) =>
        pairShapes(GUITAR, [p.strings[0] ?? 0, p.strings[1] ?? 1], x, y, 24),
      )
      .find((s) => s.dots.map((d) => d.name).join("-") === notes);
    expect(shape?.interval).toBe(iv);
    expect(shape && shape.high - shape.low).toBeLessThanOrEqual(3);
  });

  it("keeps each view to a handful: G7 3rd + 7th on strings B E", () => {
    const tones = chordTones("G7");
    const [third, seventh] = [tones[1], tones[3]];
    if (!third || !seventh) throw new Error("missing tone");
    const shapes = pairShapes(GUITAR, [4, 5], third, seventh, 24);
    expect(shapes.length).toBeGreaterThan(0);
    expect(shapes.length).toBeLessThanOrEqual(6);
    expect(shapes[0]?.dots.map((d) => d.name)).toEqual(["B", "F"]);
    expect(shapes[0]?.interval).toBe("d5");
  });
});

describe("guide-tone motion in words", () => {
  it("Gmaj7 → Cmaj7: a whole step", () => {
    expect(describeMotion(guideToneMotion("Gmaj7", "Cmaj7"))).toBe(
      "B held, F# → E, a whole step down.",
    );
  });

  it("Am7 → D7: a half step", () => {
    expect(describeMotion(guideToneMotion("Am7", "D7"))).toBe(
      "C held, G → F#, a half step down.",
    );
  });

  it("two moving notes are kept apart", () => {
    expect(describeMotion(guideToneMotion("Gmaj7", "Am7"))).toBe(
      "B → C, a half step up. F# → G, a half step up.",
    );
  });

  it("draws each move on its own string: Am7 → D7 on strings D G", () => {
    const shape = guideShapes(GUITAR, [2, 3], "Am7", "D7", 24).find((s) =>
      s.dots.some((d) => d.name === "C" && d.string === 3),
    );
    const c = shape?.dots.find((d) => d.name === "C");
    const g = shape?.dots.find((d) => d.name === "G");
    expect(shape?.moves).toContainEqual({
      string: c?.string,
      from: c?.fret,
      to: c?.fret,
    });
    expect(shape?.moves).toContainEqual({
      string: g?.string,
      from: g?.fret,
      to: (g?.fret ?? 0) - 1,
    });
    expect(shape?.next?.map((d) => d.name).sort()).toEqual(["C", "F#"]);
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
