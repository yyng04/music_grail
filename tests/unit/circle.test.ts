import { describe, expect, it } from "vitest";
import {
  cellStates,
  columns,
  compareSummary,
  focusCell,
  keyForCell,
  keyMeta,
  noteArcs,
  noteRing,
  noteRow,
  stepKey,
  turn,
  windowAngle,
  type CellState,
} from "../../src/relations/index.ts";
import type { Selection, Target } from "../../src/theory/index.ts";

const words = (s: string) => s.split(" ");
const major = (tonic: string): Target => ({ tonic, kind: "major" });
const sel = (primary: Target, compare?: Target): Selection =>
  compare ? { primary, compare } : { primary };

describe("circle columns (§5.1)", () => {
  const cols = columns(sel(major("C")));

  it("lays out majors, relative minors and vii° chords in fifths order", () => {
    expect(cols.map((c) => c.cells.outer)).toEqual(
      words("C G D A E B F# Db Ab Eb Bb F"),
    );
    expect(cols.map((c) => c.cells.middle)).toEqual(
      words("Am Em Bm F#m C#m G#m D#m Bbm Fm Cm Gm Dm"),
    );
    expect(cols.map((c) => c.cells.inner)).toEqual(
      words(
        "Bdim F#dim C#dim G#dim D#dim A#dim E#dim Cdim Gdim Ddim Adim Edim",
      ),
    );
  });

  it("offers the other spelling on the three bottom columns only", () => {
    expect(
      cols
        .filter((c) => c.alternate)
        .map((c) => `${c.major}/${c.alternate ?? ""}`),
    ).toEqual(["B/Cb", "F#/Gb", "Db/C#"]);
  });

  it.each([
    ["Gb", 6, "Gb Ebm Fdim"],
    ["Cb", 5, "Cb Abm Bbdim"],
    ["C#", 7, "C# A#m B#dim"],
  ])(
    "follows a selected %s: its whole column is respelled",
    (tonic, i, cells) => {
      const col = columns(sel(major(tonic)))[i];
      expect(
        [col?.cells.outer, col?.cells.middle, col?.cells.inner].join(" "),
      ).toBe(cells);
    },
  );

  it("follows a minor key in a toggled column (Eb minor → Gb column)", () => {
    expect(columns(sel({ tonic: "Eb", kind: "minor" }))[6]?.cells.middle).toBe(
      "Ebm",
    );
  });

  it("uses the toggle choice when no selected key is in the column", () => {
    expect(columns(sel(major("C")), { 6: "Gb" })[6]?.major).toBe("Gb");
    expect(columns(sel(major("F#")), { 6: "Gb" })[6]?.major).toBe("F#");
  });
});

function lit(states: Partial<Record<string, CellState>>, field: "p" | "c") {
  return Object.entries(states)
    .filter(([, s]) => s?.[field])
    .map(([id, s]) => `${id}:${s?.[field] ?? ""}`)
    .sort();
}

describe("key window (§5.1)", () => {
  it("lights exactly the 7 diatonic triads of C major with their numerals", () => {
    const s = sel(major("C"));
    expect(lit(cellStates(s, columns(s)), "p")).toEqual(
      [
        "outer-11:IV",
        "outer-0:I",
        "outer-1:V",
        "middle-11:ii",
        "middle-0:vi",
        "middle-1:iii",
        "inner-0:vii°",
      ].sort(),
    );
  });

  it("marks the tonic cell", () => {
    const s = sel({ tonic: "A", kind: "minor" });
    const states = cellStates(s, columns(s));
    expect(
      Object.entries(states)
        .filter(([, v]) => v?.tonic)
        .map(([k]) => k),
    ).toEqual(["middle-0"]);
  });

  it("relabels a minor key from its own tonic, in the relative major's window", () => {
    const s = sel({ tonic: "A", kind: "minor" });
    expect(lit(cellStates(s, columns(s)), "p")).toEqual(
      [
        "middle-0:i",
        "inner-0:ii°",
        "outer-0:III",
        "middle-11:iv",
        "middle-1:v",
        "outer-11:VI",
        "outer-1:VII",
      ].sort(),
    );
  });

  it("labels D Dorian i ii III IV v vi° VII in the C major window", () => {
    const s = sel({ tonic: "D", kind: "dorian" });
    expect(lit(cellStates(s, columns(s)), "p")).toEqual(
      [
        "middle-11:i",
        "middle-1:ii",
        "outer-11:III",
        "outer-0:VII",
        "middle-0:v",
        "inner-0:vi°",
        "outer-1:IV",
      ].sort(),
    );
    expect(windowAngle({ tonic: "D", kind: "dorian" })).toBe(0);
  });

  it("draws both windows with compare set", () => {
    const s = sel(major("G"), major("D"));
    const states = cellStates(s, columns(s));
    expect(states["outer-1"]).toMatchObject({ p: "I", c: "IV" });
    expect(states["outer-3"]).toMatchObject({ c: "V" });
    expect(states["outer-3"]?.p).toBeUndefined();
    expect(states["outer-0"]).toMatchObject({ p: "IV" });
    expect(states["outer-0"]?.c).toBeUndefined();
  });

  it("finds the compare window when the two keys spell the column differently", () => {
    const s = sel(major("C#"), major("Db"));
    expect(lit(cellStates(s, columns(s)), "c")).toHaveLength(7);
  });
});

describe("harmonic minor on the circle (§5.1)", () => {
  const s = sel({ tonic: "A", kind: "harmonic-minor" });
  const states = cellStates(s, columns(s));

  it("uses the natural minor's window, numbering the chords it keeps", () => {
    expect(states["middle-0"]).toMatchObject({ p: "i", tonic: true });
    expect(states["inner-0"]).toMatchObject({ p: "ii°" });
    expect(states["middle-11"]).toMatchObject({ p: "iv" });
    expect(states["outer-11"]).toMatchObject({ p: "VI" });
  });

  it("dims the window cells that are not harmonic-minor chords", () => {
    for (const id of ["outer-0", "outer-1", "middle-1"] as const)
      expect(states[id]).toEqual({ outOfKey: true });
  });

  it("marks V (E) and vii° (G#°) in their own cells; III+ has no cell", () => {
    expect(states["outer-4"]).toEqual({ p: "V", changed: true });
    expect(states["inner-3"]).toEqual({ p: "vii°", changed: true });
    expect(Object.values(states).filter((v) => v?.p === "III+")).toHaveLength(
      0,
    );
  });
});

describe("focus chord cell (§5.1)", () => {
  const bb = (chord: string): Target => ({ tonic: "Bb", kind: "major", chord });
  it.each([
    ["Gm7", "middle-10"],
    ["Bbmaj7", "outer-10"],
    ["Am7b5", "inner-10"],
    ["Gm", "middle-10"],
  ])("%s in Bb highlights %s", (chord, cell) => {
    expect(focusCell(bb(chord), columns(sel(bb(chord))))).toBe(cell);
  });
});

describe("turning and clicking", () => {
  it.each([
    [0, 30, 30],
    [0, 330, -30],
    [300, 30, 90],
    [0, 180, 180],
    [90, 270, 180],
  ])("from %i° to %i° turns %i° (a tritone turns clockwise)", (from, to, d) => {
    expect(turn(from, to)).toBe(d);
  });

  it("selects the column's major from the inner ring and the minor from the middle ring", () => {
    const cols = columns(sel(major("C")));
    const c = cols[0],
      g = cols[1];
    if (!c || !g) throw new Error("columns missing");
    expect(keyForCell("inner", c)).toEqual(major("C"));
    expect(keyForCell("middle", g)).toEqual({ tonic: "E", kind: "minor" });
    expect(keyForCell("outer", g)).toEqual(major("G"));
  });

  it("steps round the circle with the arrow keys, keeping the kind", () => {
    const cols = columns(sel(major("C")));
    expect(stepKey(major("C"), 1, cols)).toEqual(major("G"));
    expect(stepKey(major("C"), -1, cols)).toEqual(major("F"));
    expect(stepKey({ tonic: "A", kind: "minor" }, 1, cols)).toEqual({
      tonic: "E",
      kind: "minor",
    });
    expect(stepKey({ tonic: "D", kind: "dorian" }, 1, cols)).toEqual({
      tonic: "A",
      kind: "dorian",
    });
  });
});

describe("note ring (§5.1)", () => {
  it("lights G major as one arc of 7 positions in the key's spelling", () => {
    const ring = noteRing(sel(major("G")));
    expect(
      ring.filter((n) => n.membership !== "none").map((n) => n.name),
    ).toEqual(words("C G D A E B F#"));
    expect(
      ring.filter((n) => n.membership === "none").map((n) => n.name),
    ).toEqual(words("Db Ab Eb Bb F"));
    expect(ring[1]).toMatchObject({ name: "G", role: "root", degree: "1" });
    expect(noteArcs(ring, false)).toHaveLength(6);
  });

  it("spells lit notes the key's way (Bb in F major)", () => {
    expect(noteRing(sel(major("F")))[10]?.name).toBe("Bb");
    expect(noteRing(sel(major("Gb")))[5]?.name).toBe("Cb");
  });

  it("G vs D: C goes dark at one end, C# lights at the other", () => {
    const s = sel(major("G"), major("D"));
    const ring = noteRing(s);
    expect(ring[0]).toMatchObject({ name: "C", membership: "primary" });
    expect(ring[7]).toMatchObject({ name: "C#", membership: "compare" });
    expect(
      noteArcs(ring, true)
        .filter((a) => a.dashed)
        .map((a) => a.from),
    ).toEqual([6]);
  });

  it("A harmonic minor: G# lights by itself and breaks the arc; G stays dim", () => {
    const ring = noteRing(sel({ tonic: "A", kind: "harmonic-minor" }));
    expect(ring[8]).toMatchObject({ name: "G#", role: "seventh" });
    expect(ring[1]).toMatchObject({ name: "G", membership: "none" });
    expect(noteArcs(ring, false).map((a) => a.from)).toEqual([2, 3, 4, 11]);
  });
});

describe("panel", () => {
  it("lists G major's notes against D major, the changed note beside its replacement", () => {
    const row = noteRow(sel(major("G"), major("D")));
    expect(row.map((n) => `${n.name}:${n.membership}`)).toEqual(
      words("G:both A:both B:both C:primary C#:compare D:both E:both F#:both"),
    );
    expect(row[3]?.change).toEqual({ to: "C#", halfStep: true });
    expect(row[4]).toMatchObject({ role: "outside", degree: "#4" });
  });

  it("colours by the focus chord's roles (Bb major, Gm7: G root, Bb 3rd)", () => {
    const row = noteRow(sel({ tonic: "Bb", kind: "major", chord: "Gm7" }));
    expect(row.find((n) => n.name === "G")?.role).toBe("root");
    expect(row.find((n) => n.name === "Bb")?.role).toBe("third");
  });

  it("summarises G major to D major", () => {
    expect(compareSummary(major("G"), major("D"), true)).toEqual({
      changed: [{ from: "C", to: "C#", halfStep: true }],
      sharedNotes: 6,
      respelled: 0,
      sharedChords: words("Gmaj7 Bm7 Em7"),
    });
    expect(compareSummary(major("C#"), major("Db"), false)).toMatchObject({
      changed: [],
      sharedNotes: 7,
      respelled: 7,
    });
  });

  const metas: [Target, string][] = [
    [major("G"), "1 sharp · relative E minor"],
    [major("Bb"), "2 flats · relative G minor"],
    [major("C"), "No sharps or flats · relative A minor"],
    [{ tonic: "E", kind: "minor" }, "1 sharp · relative G major"],
    [
      { tonic: "A", kind: "harmonic-minor" },
      "A minor's key signature, with a raised 7th (G#)",
    ],
  ];
  it.each(metas)("describes %o", (target, text) => {
    expect(keyMeta(target)).toBe(text);
  });
});
