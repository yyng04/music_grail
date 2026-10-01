import { describe, expect, it } from "vitest";
import {
  chordAtBar,
  chordTones,
  guideTones,
  guideToneMotion,
  heldVoices,
  parseProgression,
  progressionChords,
  progressionShells,
  progressionVoicing,
  shellMovement,
  startBars,
} from "../../src/relations/index.ts";
import { chordInfo, tuning } from "../../src/theory/index.ts";
import { progression } from "../fixtures/course.ts";

const GUITAR = tuning("guitar", "standard").strings;
const notesOf = (dots: readonly { name: string; fret: number }[]) =>
  dots.map((d) => [d.name, d.fret]);

describe("parsing a typed progression", () => {
  it("reads the owner's progression as 7 chords, Adim7 spelled A C Eb Gb", () => {
    const tokens = parseProgression(progression.text);
    expect(progressionChords(tokens)).toEqual(progression.chords);
    expect(chordInfo("Adim7")?.notes).toEqual(progression.adim7);
  });

  it("keeps a symbol that is not a chord in place, with no chord, and skips it", () => {
    const tokens = parseProgression("Amaj7 Adim7 Xm7 Emaj7");
    expect(tokens.map((t) => t.text)).toEqual([
      "Amaj7",
      "Adim7",
      "Xm7",
      "Emaj7",
    ]);
    expect(tokens[2]?.chord).toBeUndefined();
    expect(tokens[2]?.start).toBe(12);
    expect(progressionChords(tokens)).toEqual(["Amaj7", "Adim7", "Emaj7"]);
  });

  it("allows chords outside any one key, and extra spaces", () => {
    expect(progressionChords(parseProgression("  Dm7   Db7 Cmaj7 "))).toEqual([
      "Dm7",
      "Db7",
      "Cmaj7",
    ]);
    expect(parseProgression("")).toEqual([]);
  });
});

describe("the owner's progression, by its 3rds and 7ths", () => {
  it("names each chord's 3rd and 7th", () => {
    for (const [chord, third, seventh] of progression.guideTones)
      expect(guideTones(chord)).toEqual([third, seventh]);
  });

  it("moves each guide tone the shortest way (Gb → F# counts as held)", () => {
    for (const { from, to, moves } of progression.motion)
      expect(
        guideToneMotion(from, to).map((m) => [m.from, m.to, m.semitones]),
      ).toEqual(moves);
  });
});

describe("shells for a progression", () => {
  it("gives the R 7 3 shapes with the root on E at fret 5", () => {
    for (const { chord, notes } of progression.shellsR73OnE) {
      const shape = progressionShells(chord, GUITAR, 12).find(
        (s) => s.tag === "R 7 3, root on E" && s.low >= 4 && s.high <= 6,
      );
      expect(shape, chord).toBeDefined();
      expect(notesOf(shape?.dots ?? [])).toEqual(notes);
    }
  });

  it("puts a triad's 5th where a 7th chord's 7th goes, labelled as the 5th", () => {
    const shapes = progressionShells("C", GUITAR, 12);
    expect(shapes.length).toBeGreaterThan(0);
    for (const s of shapes) {
      expect(s.dots.map((d) => d.role).sort()).toEqual([
        "fifth",
        "root",
        "third",
      ]);
      expect(s.tag).toMatch(/^R (3 5|5 3), root on [EA]$/);
    }
  });

  it("with Auto, starts the owner's loop on the R 7 3 shapes at fret 5 and holds Gb → F#", () => {
    const shapes = progressionVoicing(progression.chords, GUITAR, "auto");
    expect(shapes).toHaveLength(7);
    expect(notesOf(shapes[0]?.dots ?? [])).toEqual(
      progression.shellsR73OnE[0].notes,
    );
    expect(notesOf(shapes[1]?.dots ?? [])).toEqual(
      progression.shellsR73OnE[2].notes,
    );
    // Adim7 → G#m7: the 7th stays on the D string at fret 4 (Gb, then F#).
    expect(heldVoices(shapes[1], shapes[2])).toEqual([{ string: 2, fret: 4 }]);
    // F#m7 → Fmaj7: A and E stay where they are.
    expect(heldVoices(shapes[4], shapes[5])).toHaveLength(2);
  });

  it("with Auto, takes for each chord the shell closest to the one before", () => {
    const shapes = progressionVoicing(progression.chords, GUITAR, "auto");
    shapes.forEach((shape, i) => {
      const prev = shapes[i - 1];
      if (!shape || !prev) return;
      const best = Math.min(
        ...progressionShells(progression.chords[i] ?? "", GUITAR, 12).map((s) =>
          shellMovement(prev, s),
        ),
      );
      expect(shellMovement(prev, shape)).toBe(best);
    });
  });

  it("with a root string set, keeps every root on that string", () => {
    for (const [root, string] of [
      ["6th", 0],
      ["5th", 1],
    ] as const) {
      const shapes = progressionVoicing(progression.chords, GUITAR, root);
      for (const s of shapes) {
        const lowest = Math.min(...(s?.dots ?? []).map((d) => d.string));
        expect(lowest).toBe(string);
        const bass = s?.dots.find((d) => d.string === lowest);
        expect(bass?.role).toBe("root");
      }
    }
  });

  it("stays within the first 12 frets", () => {
    for (const s of progressionVoicing(progression.chords, GUITAR, "auto"))
      expect(s?.high).toBeLessThanOrEqual(12);
  });

  it("works on any tuning: a 4-string bass has shells too", () => {
    const bass = tuning("bass4", "standard").strings;
    const shapes = progressionVoicing(["Dm7", "G7", "Cmaj7"], bass, "auto");
    expect(shapes.every((s) => s?.dots.length === 3)).toBe(true);
    expect(shapes.every((s) => (s?.high ?? 99) <= 12)).toBe(true);
  });

  it("names a shell's notes in the chord's own spelling", () => {
    const shapes = progressionVoicing(["Adim7"], GUITAR, "auto");
    const names = shapes[0]?.dots.map((d) => d.name).sort();
    const tones = chordTones("Adim7").map((t) => t.name);
    for (const n of names ?? []) expect(tones).toContain(n);
  });
});

describe("the bar schedule", () => {
  it("bars [2, 1, 1] show chords 0, 0, 1, 2, then loop to 0", () => {
    const { bars, chords } = progression.schedule;
    expect([0, 1, 2, 3, 4].map((b) => chordAtBar(bars, b))).toEqual(chords);
  });

  it("starts each chord on the bar after the ones before it", () => {
    expect(startBars([2, 1, 1])).toEqual([0, 2, 3]);
    expect(chordAtBar([], 3)).toBe(0);
  });
});
