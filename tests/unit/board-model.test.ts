import { describe, expect, it } from "vitest";
import { createAppStore, DEFAULT_SHAPES } from "../../src/state/index.ts";
import { tuning, type Selection } from "../../src/theory/index.ts";
import { boardModel, pairsOf } from "../../src/views/fretboard/shapeModel.ts";

const GUITAR = tuning("guitar", "standard").strings;
const G_MAJOR = { tonic: "G", kind: "major" } as const;
const model = (
  shapes: Partial<typeof DEFAULT_SHAPES>,
  sel: Selection,
  sevenths = true,
) =>
  boardModel(
    { ...DEFAULT_SHAPES, ...shapes },
    sel,
    GUITAR,
    24,
    "degree",
    false,
    sevenths,
  );

describe("the chord type setting", () => {
  it("moves the focus chord to the same degree in the other size", () => {
    const store = createAppStore();
    const s = () => store.getState();
    s().setPrimary(G_MAJOR);
    s().setFocusChord("primary", "Gmaj7");
    s().setSevenths(false);
    expect(s().selection.primary.chord).toBe("G");
    s().setFocusChord("primary", "Em");
    s().setSevenths(true);
    expect(s().selection.primary.chord).toBe("Em7");
  });
});

describe("what each mode shows", () => {
  it("a triad offers three pairs, a 7th chord six", () => {
    expect(pairsOf("G").map((p) => p.text)).toEqual([
      "Root + 5th",
      "Root + 3rd",
      "3rd + 5th",
    ]);
    expect(pairsOf("G7")).toHaveLength(6);
  });

  it("two-note chords use the focus chord as it is, falling back to a pair it has", () => {
    const m = model(
      { mode: "two", two: "pairs", pair: ["third", "seventh"] },
      { primary: { ...G_MAJOR, chord: "G" } },
    );
    expect(m.chord).toBe("G");
    expect(m.pair?.text).toBe("Root + 5th");
  });

  it("Triad shapes name the 7th chord their triad comes from", () => {
    const m = model(
      { mode: "chords" },
      { primary: { ...G_MAJOR, chord: "Am7" } },
    );
    expect(m.chord).toBe("Am");
    expect(m.title).toContain("A minor triad (the triad of Am7)");
  });

  it("guide tones say when a triad is shown as its 7th chord", () => {
    const m = model({ mode: "guide" }, { primary: { ...G_MAJOR, chord: "G" } });
    expect(m.chord).toBe("Gmaj7");
    expect(m.caption).toContain("G is shown as Gmaj7");
  });

  it("a position applies in Scale mode only", () => {
    const scale = model({ mode: "scale", position: "E" }, { primary: G_MAJOR });
    expect(scale.position?.name).toBe("E");
    expect(scale.title).toBe("G major · E form, frets 2 to 5");
    const triads = model(
      { mode: "chords", position: "E" },
      { primary: G_MAJOR },
    );
    expect(triads.position).toBeUndefined();
    expect(triads.shapes.some((s) => s.low > 5)).toBe(true);
  });
});

describe("the reference line", () => {
  it("names the key, or the focus chord, and says colours only without numbers", () => {
    expect(model({}, { primary: G_MAJOR }).reference).toBe(
      "Colours and numbers: roles in G major",
    );
    expect(model({}, { primary: { ...G_MAJOR, chord: "Em7" } }).reference).toBe(
      "Colours and numbers: roles in Em7",
    );
    const notes = boardModel(
      DEFAULT_SHAPES,
      { primary: G_MAJOR },
      GUITAR,
      24,
      "note",
      false,
    );
    expect(notes.reference).toBe("Colours: roles in G major");
  });

  it("harmony through the key always colours by the key", () => {
    const m = model(
      { mode: "two", two: "harmony" },
      { primary: { ...G_MAJOR, chord: "Em7" } },
    );
    expect(m.reference).toBe("Colours and numbers: roles in G major");
  });

  it("guide tones name the 7th chord they draw", () => {
    const m = model({ mode: "guide" }, { primary: { ...G_MAJOR, chord: "G" } });
    expect(m.reference).toBe("Colours: roles in Gmaj7");
  });
});

describe("shells in the Chord shapes mode", () => {
  it("title the form and its notes", () => {
    const m = model(
      { mode: "chords", family: "shells" },
      { primary: { ...G_MAJOR, chord: "Gmaj7" } },
    );
    expect(m.title).toBe("Gmaj7 shell · R 3 7, root on E · G B F#");
    expect(m.caption).toBe(
      "Root, 3rd and 7th: the notes that name a 7th chord, with the 5th left out. The standard jazz and blues comping shapes.",
    );
    expect(m.sets).toEqual([]);
    expect(m.sound).toEqual(["G2", "B2", "F#3"]);
  });

  it("use the chord's 7th form when a triad is focused, and say so", () => {
    const m = model(
      { mode: "chords", family: "shells" },
      { primary: { ...G_MAJOR, chord: "G" } },
      false,
    );
    expect(m.chord).toBe("Gmaj7");
    expect(m.title).toContain("Gmaj7 shell (the 7th form of G)");
    expect(m.caption).toContain("Shells need a 7th, so G is shown as Gmaj7.");
    expect(m.reference).toBe("Colours and numbers: roles in Gmaj7");
  });
});
