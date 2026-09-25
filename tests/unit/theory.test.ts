import { describe, expect, it } from "vitest";
import {
  canonicalChord,
  chordInfo,
  degreeLabel,
  detectChords,
  fromTonalInterval,
  intervalBetween,
  keySignature,
  notesFromDegrees,
  relativeMinor,
  scaleNotes,
  toTonalInterval,
  transpose,
} from "../../src/theory/index.ts";
import {
  buildIntervals,
  degreeFormulas,
  intervalFormats,
  keySignatures,
  majorScales,
  modes,
  nameIntervals,
  relativeMinors,
  seventhChords,
  triads,
} from "../fixtures/course.ts";

const words = (s: string) => s.split(" ");

describe("intervals", () => {
  it.each(buildIntervals)(
    "$interval above $from is $note",
    ({ from, interval, note }) => {
      expect(transpose(from, interval)).toBe(note);
    },
  );

  it.each(nameIntervals)(
    "$from → $to is $interval",
    ({ from, to, interval }) => {
      expect(intervalBetween(from, to)).toBe(interval);
    },
  );

  it.each(intervalFormats)("Tonal $tonal ↔ $app", ({ tonal, app }) => {
    expect(fromTonalInterval(tonal)).toBe(app);
    expect(toTonalInterval(app)).toBe(tonal);
  });

  it("rejects malformed interval names", () => {
    expect(() => toTonalInterval("3M")).toThrow();
    expect(() => toTonalInterval("X3")).toThrow();
  });
});

describe("degree formulas", () => {
  it.each(degreeFormulas)(
    "$tonic $formula = $notes",
    ({ tonic, formula, notes }) => {
      expect(notesFromDegrees(tonic, words(formula))).toEqual(words(notes));
      expect(
        words(notes).map((n) => degreeLabel(intervalBetween(tonic, n))),
      ).toEqual(words(formula));
    },
  );

  it("labels altered degrees with accidentals", () => {
    expect(degreeLabel("A4")).toBe("#4");
    expect(degreeLabel("d5")).toBe("b5");
    expect(degreeLabel("P1")).toBe("1");
  });
});

describe("keys", () => {
  it.each(Object.entries(majorScales))("%s major: %s", (tonic, notes) => {
    expect(scaleNotes({ tonic, kind: "major" })).toEqual(words(notes));
  });

  it.each(Object.entries(keySignatures))("%s major has %s", (tonic, label) => {
    expect(keySignature({ tonic, kind: "major" }).label).toBe(label);
  });

  it("gives minor keys and modes their parent key's signature", () => {
    expect(keySignature({ tonic: "E", kind: "minor" }).label).toBe("1#");
    expect(keySignature({ tonic: "D", kind: "dorian" }).label).toBe("0");
    expect(keySignature({ tonic: "Gb", kind: "major" }).label).toBe("6b");
  });

  it.each(Object.entries(relativeMinors))(
    "relative minor of %s is %s",
    (tonic, minor) => {
      const target = relativeMinor(tonic);
      expect(`${target.tonic}m`).toBe(minor);
      expect(target.kind).toBe("minor");
    },
  );

  it.each(modes)("$tonic $kind: $notes", ({ tonic, kind, notes }) => {
    expect(scaleNotes({ tonic, kind })).toEqual(words(notes));
  });
});

describe("chords", () => {
  it.each(Object.entries(triads))("%s = %s", (symbol, notes) => {
    expect(chordInfo(symbol)?.notes).toEqual(words(notes));
  });

  it.each(Object.entries(seventhChords))("%s = %s", (symbol, notes) => {
    expect(chordInfo(symbol)?.notes).toEqual(words(notes));
  });

  it("writes every symbol in one canonical form", () => {
    // Tonal's Chord.detect names a major triad "CM" while Key names it "C".
    expect(detectChords(["C", "E", "G"])[0]).toBe("C");
    expect(canonicalChord("CM")).toBe("C");
    expect(canonicalChord("Cmaj")).toBe("C");
    expect(canonicalChord("CΔ")).toBe("Cmaj7");
    expect(canonicalChord("Cø")).toBe("Cm7b5");
    expect(canonicalChord("F#°")).toBe("F#dim");
  });

  it("gives chord intervals quality-first", () => {
    expect(chordInfo("Gm7")?.intervals).toEqual(["P1", "m3", "P5", "m7"]);
  });
});
