import { describe, expect, it } from "vitest";
import {
  degreeOf,
  detectChord,
  diatonicChords,
  isDiatonic,
  keyOfDominant,
  membership,
  noteDiff,
  roleOf,
  sharedNotes,
} from "../../src/relations/index.ts";
import {
  chordInfo,
  keySignature,
  parentMajorTonic,
  scaleNotes,
  type Target,
} from "../../src/theory/index.ts";
import {
  chordsByDegree,
  diatonicSeventhsOfF,
  diatonicTriadsOfG,
  guideToneMotion,
  guideTones,
  harmonicMinor,
  keyDiffs,
  keyFromDominant,
  nameChords,
} from "../fixtures/course.ts";

const words = (s: string) => s.split(" ");
const major = (tonic: string): Target => ({ tonic, kind: "major" });
const QUALITY: Record<string, string> = {
  "": "major",
  m: "minor",
  dim: "diminished",
};

// Every major key on the circle, including the enharmonic pairs.
const MAJOR_KEYS = "C G D A E B F# C# Cb Gb Db Ab Eb Bb F".split(" ");

describe("diatonic chords", () => {
  it("builds the diatonic triads of G major", () => {
    const chords = diatonicChords(major("G"), { sevenths: false });
    expect(
      chords.map((c) => ({
        notes: c.notes.join(" "),
        quality: QUALITY[chordInfo(c.symbol)?.suffix ?? "?"],
      })),
    ).toEqual(diatonicTriadsOfG);
  });

  it("builds the diatonic 7ths of F major", () => {
    const chords = diatonicChords(major("F"), { sevenths: true });
    expect(chords.map((c) => c.symbol)).toEqual(diatonicSeventhsOfF);
  });

  it.each(chordsByDegree)(
    "$numeral in $key = $chord",
    ({ numeral, key, chord, notes }) => {
      const found = diatonicChords(major(key), { sevenths: true }).find(
        (c) => c.numeral === numeral,
      );
      expect(found?.symbol).toBe(chord);
      if (notes) expect(found?.notes).toEqual(words(notes));
    },
  );

  it("numbers a major key's chords", () => {
    expect(
      diatonicChords(major("C"), { sevenths: true }).map((c) => c.numeral),
    ).toEqual(words("Imaj7 ii7 iii7 IVmaj7 V7 vi7 viim7b5"));
    expect(
      diatonicChords(major("C"), { sevenths: false }).map((c) => c.numeral),
    ).toEqual(words("I ii iii IV V vi vii°"));
  });

  it("renumbers minor keys and modes from their own tonic", () => {
    const aMinor = diatonicChords(
      { tonic: "A", kind: "minor" },
      { sevenths: false },
    );
    expect(aMinor.map((c) => c.numeral)).toEqual(
      words("i ii° III iv v VI VII"),
    );
    expect(aMinor.map((c) => c.symbol)).toEqual(words("Am Bdim C Dm Em F G"));

    const dDorian = diatonicChords(
      { tonic: "D", kind: "dorian" },
      { sevenths: false },
    );
    expect(dDorian.map((c) => c.numeral)).toEqual(
      words("i ii III IV v vi° VII"),
    );
  });

  it("checks whether a chord is diatonic, by spelling", () => {
    const bb = major("Bb");
    expect(isDiatonic("Gm7", bb)).toBe(true);
    expect(isDiatonic("Gm", bb)).toBe(true);
    expect(isDiatonic("G7", bb)).toBe(false);
    expect(isDiatonic("A#maj7", bb)).toBe(false);
  });
});

describe("chord naming", () => {
  it.each(Object.entries(nameChords))("%s = %s", (notes, symbol) => {
    expect(detectChord(words(notes))).toBe(symbol);
  });

  it(`finds the key of ${keyFromDominant.chord}`, () => {
    const key = keyOfDominant(keyFromDominant.chord);
    expect(key).toEqual(major(keyFromDominant.key));
    expect(chordInfo(keyFromDominant.chord)?.notes).toEqual(
      words(keyFromDominant.notes),
    );
    const five = diatonicChords(major(keyFromDominant.key), { sevenths: true })[
      keyFromDominant.degree - 1
    ];
    expect(five?.symbol).toBe(keyFromDominant.chord);
  });

  it(`finds ${keyFromDominant.chord} in no other major key`, () => {
    const containing = MAJOR_KEYS.filter((k) =>
      diatonicChords(major(k), { sevenths: true }).some(
        (c) => c.symbol === keyFromDominant.chord,
      ),
    );
    expect(containing).toEqual([keyFromDominant.key]);
  });

  it("returns no key for a chord that is not a dominant 7th", () => {
    expect(keyOfDominant("Amaj7")).toBeUndefined();
    expect(keyOfDominant("Am7")).toBeUndefined();
  });
});

describe("key comparison", () => {
  it.each(keyDiffs)(
    "$primary major vs $compare major",
    ({ primary, compare, changed, shared, respelled }) => {
      const diff = noteDiff(major(primary), major(compare));
      expect(
        diff.changed.map(({ primary: p, compare: c }) => ({
          primary: p,
          compare: c,
        })),
      ).toEqual(changed);
      expect(sharedNotes(major(primary), major(compare))).toHaveLength(shared);
      expect(diff.respelled).toHaveLength(respelled);
    },
  );

  it("marks a one-letter change as a half step", () => {
    expect(noteDiff(major("G"), major("D")).changed).toEqual([
      { primary: "C", compare: "C#", halfStep: true },
    ]);
  });

  it("pairs respellings by pitch", () => {
    const diff = noteDiff(major("C#"), major("Db"));
    expect(diff.respelled[0]).toEqual({ primary: "C#", compare: "Db" });
    expect(diff.same).toEqual([]);
    expect(diff.onlyPrimary).toEqual([]);
  });

  it("pairs several changed notes by letter", () => {
    expect(
      noteDiff(major("C"), major("Eb")).changed.map(
        (c) => `${c.primary}→${c.compare}`,
      ),
    ).toEqual(["E→Eb", "A→Ab", "B→Bb"]);
  });

  it("classifies membership by pitch", () => {
    const selection = { primary: major("C"), compare: major("G") };
    expect(membership("C", selection)).toBe("both");
    expect(membership("F", selection)).toBe("primary");
    expect(membership("F#", selection)).toBe("compare");
    expect(membership("Gb", selection)).toBe("compare");
    expect(membership("C#", selection)).toBe("none");
    expect(membership("F", { primary: major("C") })).toBe("primary");
  });
});

describe("degrees and roles", () => {
  it("labels degrees from the target's tonic", () => {
    const dorian: Target = { tonic: "D", kind: "dorian" };
    expect(scaleNotes(dorian).map((n) => degreeOf(n, dorian))).toEqual(
      words("1 2 b3 4 5 6 b7"),
    );
  });

  it("labels a note by its pitch, using the key's spelling", () => {
    expect(degreeOf("A#", major("Bb"))).toBe("1");
    expect(degreeOf("F#", major("C"))).toBe("#4");
  });

  it("gives roles in the key when no chord is set", () => {
    const bb = major("Bb");
    expect(words("Bb C D Eb F G A E").map((n) => roleOf(n, bb))).toEqual([
      "root",
      "other",
      "third",
      "other",
      "fifth",
      "other",
      "seventh",
      "outside",
    ]);
  });

  it("gives roles in the focus chord: Bbmaj7 in Bb", () => {
    const target: Target = { ...major("Bb"), chord: "Bbmaj7" };
    expect(words("Bb D F A C").map((n) => roleOf(n, target))).toEqual([
      "root",
      "third",
      "fifth",
      "seventh",
      "other",
    ]);
  });

  it("gives roles in the focus chord: Gm7 in Bb (G is the root, Bb the 3rd)", () => {
    const target: Target = { ...major("Bb"), chord: "Gm7" };
    expect(words("G Bb D F C Eb A E").map((n) => roleOf(n, target))).toEqual([
      "root",
      "third",
      "fifth",
      "seventh",
      "other",
      "other",
      "other",
      "outside",
    ]);
  });
});

describe("guide tones (v2, Chords tab)", () => {
  it.todo(`guideTones: ${String(Object.keys(guideTones).length)} fixtures`);
  it.todo(`guideToneMotion: ${String(guideToneMotion.length)} fixtures`);
});

describe("harmonic minor", () => {
  const target: Target = { tonic: harmonicMinor.tonic, kind: "harmonic-minor" };

  it(`scale: ${harmonicMinor.notes}`, () => {
    expect(scaleNotes(target)).toEqual(words(harmonicMinor.notes));
  });

  it(`triads: ${harmonicMinor.triads}`, () => {
    expect(
      diatonicChords(target, { sevenths: false }).map((c) => c.symbol),
    ).toEqual(words(harmonicMinor.triads));
  });

  it(`sevenths: ${harmonicMinor.sevenths}`, () => {
    expect(
      diatonicChords(target, { sevenths: true }).map((c) => c.symbol),
    ).toEqual(words(harmonicMinor.sevenths));
  });

  it("numbers its chords from the minor tonic", () => {
    expect(
      diatonicChords(target, { sevenths: false }).map((c) => c.numeral),
    ).toEqual(words("i ii° III+ iv V VI vii°"));
  });

  it("gives the raised 7th its own degree and role", () => {
    expect(degreeOf("G#", target)).toBe("7");
    expect(roleOf("G#", target)).toBe("seventh");
    expect(roleOf("G", target)).toBe("outside");
  });

  it("shares A minor's key signature and window", () => {
    expect(keySignature(target).label).toBe("0");
    expect(parentMajorTonic(target)).toBe("C");
  });
});
