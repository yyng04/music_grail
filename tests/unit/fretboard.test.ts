import { describe, expect, it } from "vitest";
import {
  fretboardNotes,
  halfStepLinks,
  labelReference,
} from "../../src/relations/index.ts";
import {
  checkFretboard,
  createAppStore,
  DEFAULT_FRETBOARD,
  formatHash,
  parseView,
  startHashSync,
} from "../../src/state/index.ts";
import { boardGeometry } from "../../src/views/fretboard/geometry.ts";
import {
  fretPitch,
  INSTRUMENTS,
  respell,
  tuning,
  type Selection,
} from "../../src/theory/index.ts";

const GUITAR = tuning("guitar", "standard").strings;
const at = (
  notes: ReturnType<typeof fretboardNotes>,
  string: number,
  fret: number,
) => notes.find((n) => n.string === string && n.fret === fret);

describe("tunings", () => {
  it("lists strings lowest first, with octaves", () => {
    expect(GUITAR).toEqual(["E2", "A2", "D3", "G3", "B3", "E4"]);
    expect(tuning("guitar", "drop-d").strings[0]).toBe("D2");
    expect(tuning("bass4", "standard").strings).toEqual([
      "E1",
      "A1",
      "D2",
      "G2",
    ]);
    expect(tuning("bass5", "standard").strings).toEqual([
      "B0",
      "E1",
      "A1",
      "D2",
      "G2",
    ]);
  });

  it("offers 22 or 24 frets on guitar and 20 or 24 on bass", () => {
    const frets = Object.fromEntries(
      INSTRUMENTS.map((i) => [i.id, [...i.frets].sort((a, b) => a - b)]),
    );
    expect(frets).toEqual({
      guitar: [22, 24],
      bass4: [20, 24],
      bass5: [20, 24],
    });
  });

  it("names the pitch at a fret, with its octave", () => {
    expect(fretPitch("E2", 0)).toBe("E2");
    expect(fretPitch("E2", 3)).toBe("G2");
    expect(fretPitch("B3", 1)).toBe("C4");
    expect(fretPitch("E4", 12)).toBe("E5");
    expect(fretPitch("B0", 24)).toBe("B2");
  });

  it("keeps the octave right when respelling across B and C", () => {
    expect(respell("C4", "B#")).toBe("B#3");
    expect(respell("F4", "E#")).toBe("E#4");
    expect(respell("B3", "Cb")).toBe("Cb4");
  });
});

describe("fretboard notes", () => {
  const cMajor: Selection = { primary: { tonic: "C", kind: "major" } };

  it("covers every string from the open string to the last fret", () => {
    const notes = fretboardNotes(cMajor, GUITAR, 24);
    expect(notes).toHaveLength(6 * 25);
  });

  it("marks notes in the key and leaves the rest outside", () => {
    const notes = fretboardNotes(cMajor, GUITAR, 15);
    expect(at(notes, 1, 3)).toMatchObject({
      pitch: "C3",
      name: "C",
      membership: "primary",
      role: "root",
      degree: "1",
      interval: "P1",
    });
    expect(at(notes, 1, 4)).toMatchObject({
      name: "Db",
      membership: "none",
      role: "outside",
    });
  });

  it("spells notes the way the key does (E# in F# major, B# in C# major)", () => {
    const fSharp = fretboardNotes(
      { primary: { tonic: "F#", kind: "major" } },
      GUITAR,
      15,
    );
    expect(at(fSharp, 5, 1)).toMatchObject({ pitch: "E#4", role: "seventh" });
    expect(at(fSharp, 4, 6)).toMatchObject({ pitch: "E#4", degree: "7" });
    const cSharp = fretboardNotes(
      { primary: { tonic: "C#", kind: "major" } },
      GUITAR,
      15,
    );
    // G string, fret 5 sounds C4; C# major spells it B#, an octave number lower.
    expect(at(cSharp, 3, 5)).toMatchObject({ pitch: "B#3", name: "B#" });
  });

  it("colours by the focus chord: in Bb with Gm7, G is the root and Bb the 3rd", () => {
    const notes = fretboardNotes(
      { primary: { tonic: "Bb", kind: "major", chord: "Gm7" } },
      GUITAR,
      15,
    );
    const role = (name: string) => notes.find((n) => n.name === name)?.role;
    expect(role("G")).toBe("root");
    expect(role("Bb")).toBe("third");
    expect(role("D")).toBe("fifth");
    expect(role("F")).toBe("seventh");
    expect(role("C")).toBe("other");
    // Degrees and intervals count from the chord's root.
    expect(notes.find((n) => n.name === "Bb")).toMatchObject({
      degree: "b3",
      interval: "m3",
    });
  });

  it("follows Bbmaj7 with the tonic as the root", () => {
    const notes = fretboardNotes(
      { primary: { tonic: "Bb", kind: "major", chord: "Bbmaj7" } },
      GUITAR,
      15,
    );
    const role = (name: string) => notes.find((n) => n.name === name)?.role;
    expect([role("Bb"), role("D"), role("F"), role("A")]).toEqual([
      "root",
      "third",
      "fifth",
      "seventh",
    ]);
  });

  it("measures labels from the chord root, or the tonic with no chord", () => {
    expect(labelReference({ primary: { tonic: "G", kind: "major" } })).toBe(
      "G",
    );
    expect(
      labelReference({ primary: { tonic: "G", kind: "major", chord: "Em7" } }),
    ).toBe("E");
  });

  it("applies the compare rule: G major vs D major", () => {
    const selection: Selection = {
      primary: { tonic: "G", kind: "major" },
      compare: { tonic: "D", kind: "major" },
    };
    const notes = fretboardNotes(selection, GUITAR, 15);
    const of = (name: string) => notes.find((n) => n.name === name);
    expect(of("G")?.membership).toBe("both");
    expect(of("C")?.membership).toBe("primary");
    expect(of("C#")).toMatchObject({
      membership: "compare",
      role: "outside",
      degree: "#4",
    });
    expect(of("Eb")?.membership).toBe("none");
  });

  it("uses the compare key's spelling for its own notes (C# major vs Db major)", () => {
    const notes = fretboardNotes(
      {
        primary: { tonic: "C#", kind: "major" },
        compare: { tonic: "Db", kind: "major" },
      },
      GUITAR,
      12,
    );
    // Every pitch is shared, so every note is in both keys, in C# major's spelling.
    const inKeys = notes.filter((n) => n.membership !== "none");
    expect(inKeys.every((n) => n.membership === "both")).toBe(true);
    expect(new Set(inKeys.map((n) => n.name))).toEqual(
      new Set(["C#", "D#", "E#", "F#", "G#", "A#", "B#"]),
    );
  });
});

describe("half-step links", () => {
  it("joins each C to the C# a fret above it (G major → D major)", () => {
    const links = halfStepLinks(
      {
        primary: { tonic: "G", kind: "major" },
        compare: { tonic: "D", kind: "major" },
      },
      GUITAR,
      15,
    );
    // Low E string: C at fret 8 → C# at 9. B string: C at 1 → C# at 2, and 13 → 14.
    expect(links).toContainEqual({ string: 0, from: 8, to: 9 });
    expect(links).toContainEqual({ string: 4, from: 1, to: 2 });
    expect(links).toContainEqual({ string: 4, from: 13, to: 14 });
    expect(links.every((l) => l.to === l.from + 1)).toBe(true);
  });

  it("points down the neck when the note falls (F major → Bb major: E → Eb)", () => {
    const links = halfStepLinks(
      {
        primary: { tonic: "F", kind: "major" },
        compare: { tonic: "Bb", kind: "major" },
      },
      GUITAR,
      15,
    );
    // Low E string: E at fret 12 → Eb at 11; the open E has no fret below it.
    expect(links).toContainEqual({ string: 0, from: 12, to: 11 });
    expect(links.some((l) => l.from === 0)).toBe(false);
    expect(links.every((l) => l.to === l.from - 1)).toBe(true);
    expect(links).toContainEqual({ string: 1, from: 7, to: 6 });
  });

  it("draws nothing without a compare", () => {
    expect(
      halfStepLinks({ primary: { tonic: "G", kind: "major" } }, GUITAR, 15),
    ).toEqual([]);
  });
});

describe("fretboard settings", () => {
  it("default to guitar, 24 frets, degree labels and the diagram view", () => {
    expect(checkFretboard(undefined)).toEqual(DEFAULT_FRETBOARD);
    expect(DEFAULT_FRETBOARD).toMatchObject({
      instrument: "guitar",
      tuning: "standard",
      frets: 24,
      label: "degree",
      lowOnTop: false,
      leftHanded: false,
      showOutside: false,
    });
  });

  it("drop invalid values", () => {
    expect(
      checkFretboard({
        instrument: "banjo",
        frets: 99,
        label: "colour",
        leftHanded: "yes",
      }),
    ).toEqual(DEFAULT_FRETBOARD);
  });

  it("switch a guitar tuning back to standard on bass", () => {
    const store = createAppStore({ ...DEFAULT_FRETBOARD, tuning: "drop-d" });
    store.getState().setFretboard({ instrument: "bass4" });
    expect(store.getState().fretboard).toMatchObject({
      instrument: "bass4",
      tuning: "standard",
      frets: 24,
    });
    store.getState().setFretboard({ frets: 22 });
    expect(store.getState().fretboard.frets).toBe(24);
    store.getState().setFretboard({ frets: 20 });
    expect(store.getState().fretboard.frets).toBe(20);
  });
});

describe("views", () => {
  it("names the fretboard in the hash and leaves the circle out", () => {
    const selection: Selection = { primary: { tonic: "G", kind: "major" } };
    expect(formatHash(selection, "fretboard")).toBe("p=G-major&view=fretboard");
    expect(formatHash(selection, "circle")).toBe("p=G-major");
    expect(parseView("#p=G-major&view=fretboard")).toBe("fretboard");
    expect(parseView("#p=G-major&view=tonnetz")).toBe("circle");
    expect(parseView("")).toBe("circle");
  });

  it("syncs the view with the hash both ways", () => {
    const listeners = new Set<() => void>();
    const win = {
      location: { hash: "#p=D-major&view=fretboard" },
      history: {
        replaceState: (_d: unknown, _u: string, url: string) => {
          win.location.hash = url;
        },
      },
      addEventListener: (_t: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_t: string, fn: () => void) => listeners.delete(fn),
    };
    const store = createAppStore();
    startHashSync(store, win as unknown as Window);
    expect(store.getState().view).toBe("fretboard");
    store.getState().setView("circle");
    expect(win.location.hash).toBe("#p=D-major");
  });

  it("keeps compare armed across a view change", () => {
    const store = createAppStore();
    const s = () => store.getState();
    s().setView("fretboard");
    s().armCompare(true);
    s().setView("circle");
    expect(s()).toMatchObject({ view: "circle", compareArmed: true });
    s().setCompare({ tonic: "F", kind: "major" });
    expect(s()).toMatchObject({ view: "circle", compareArmed: false });
  });
});

describe("board geometry", () => {
  const geometry = (upright: boolean) =>
    boardGeometry({
      viewWidth: upright ? 358 : 1344,
      strings: 6,
      frets: 24,
      compact: upright,
      upright,
      leftHanded: false,
    });
  const lengths = (g: ReturnType<typeof geometry>) =>
    Array.from({ length: 24 }, (_, i) => g.fret(i + 1) - g.fret(i));

  it("keeps real proportions lying down: each fret 2^(-1/12) of the one before", () => {
    const l = lengths(geometry(false));
    for (let i = 1; i < l.length; i++)
      expect((l[i] ?? 0) / (l[i - 1] ?? 1)).toBeCloseTo(
        Math.pow(2, -1 / 12),
        6,
      );
  });

  it("never makes an upright fret shorter than a dot plus a gap", () => {
    const g = geometry(true);
    expect(Math.min(...lengths(g))).toBeGreaterThanOrEqual(
      g.dotSize(24) + 6 - 1e-9,
    );
    expect(g.dotSize(24)).toBe(30);
  });
});
