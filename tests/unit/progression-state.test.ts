import { describe, expect, it } from "vitest";
import {
  createAppStore,
  DEFAULT_PROGRESSION,
  DEFAULT_SHAPES,
  encodeProgressionChord,
  formatHash,
  parseProgressionHash,
  parseShapes,
  STOPPED,
  type ProgressionState,
} from "../../src/state/index.ts";
import { tuning } from "../../src/theory/index.ts";
import { boardModel } from "../../src/views/fretboard/shapeModel.ts";
import { progression as owner } from "../fixtures/course.ts";

const GUITAR = tuning("guitar", "standard").strings;
const E_MAJOR = { primary: { tonic: "E", kind: "major" } } as const;
const PROGRESSION = { ...DEFAULT_SHAPES, mode: "progression" } as const;
const prog = (p: Partial<ProgressionState>): ProgressionState => ({
  ...DEFAULT_PROGRESSION,
  ...p,
});

describe("the progression in the URL hash", () => {
  it("writes the chords, and leaves the defaults out", () => {
    expect(
      formatHash(E_MAJOR, "fretboard", PROGRESSION, prog({ text: owner.text })),
    ).toBe(
      "p=E-major&view=fretboard&show=progression&chords=A-maj7,A-dim7,Gs-m7,Cs-m7,Fs-m7,F-maj7,E-maj7",
    );
  });

  it("writes bars, tempo, time, drums and root string when set", () => {
    const hash = formatHash(
      { primary: { tonic: "C", kind: "major" } },
      "fretboard",
      PROGRESSION,
      prog({
        text: "Dm7 G7 Cmaj7",
        bars: [2, 2, 2],
        tempo: 120,
        sig: "3/4",
        drums: "waltz",
        root: "5th",
      }),
    );
    expect(hash).toBe(
      "p=C-major&view=fretboard&show=progression&chords=D-m7,G-7,C-maj7&bars=2,2,2&bpm=120&time=3-4&drums=waltz&root=5",
    );
    expect(parseProgressionHash(`#${hash}`)).toEqual({
      text: "Dm7 G7 Cmaj7",
      bars: [2, 2, 2],
      tempo: 120,
      sig: "3/4",
      drums: "waltz",
      root: "5th",
    });
    expect(parseShapes(`#${hash}`).mode).toBe("progression");
  });

  it("leaves out a symbol that is not a chord", () => {
    const hash = formatHash(
      E_MAJOR,
      "fretboard",
      PROGRESSION,
      prog({ text: "Amaj7 Adim7 Xm7 Emaj7" }),
    );
    expect(hash).toContain("chords=A-maj7,A-dim7,E-maj7");
  });

  it("carries any chord exactly, escaping what a link cannot hold", () => {
    for (const chord of ["Cmaj7#5", "C/E", "Bbm7b5", "F#7b9", "C"]) {
      const text = encodeProgressionChord(chord);
      const back = parseProgressionHash(`#chords=${text}`).text;
      expect(back, `${chord} as ${text}`).toBe(chord);
    }
    expect(encodeProgressionChord("G#m7")).toBe("Gs-m7");
  });

  it("ignores what it cannot read", () => {
    expect(
      parseProgressionHash("#chords=Q-m7&bpm=x&time=5-4&drums=polka&root=4"),
    ).toEqual({});
    expect(parseProgressionHash("#bpm=400").tempo).toBe(240);
  });

  it("is only written in Progression mode on the fretboard", () => {
    const p = prog({ text: owner.text });
    expect(formatHash(E_MAJOR, "fretboard", DEFAULT_SHAPES, p)).not.toContain(
      "chords",
    );
    expect(formatHash(E_MAJOR, "circle", PROGRESSION, p)).not.toContain(
      "chords",
    );
  });
});

describe("progression settings in the store", () => {
  it("keeps tempo within 40 to 240 and bar counts within 1 to 8", () => {
    const store = createAppStore();
    store.getState().setProgression({ tempo: 20, bars: [0, 9, 3] });
    expect(store.getState().progression.tempo).toBe(40);
    expect(store.getState().progression.bars).toEqual([1, 8, 3]);
  });

  it("falls back to the click when the drums do not fit the time signature", () => {
    const store = createAppStore();
    store.getState().setProgression({ drums: "swing" });
    store.getState().setProgression({ sig: "3/4" });
    expect(store.getState().progression.drums).toBe("off");
  });
});

describe("the board in Progression mode", () => {
  const model = (p: Partial<ProgressionState>, label = "degree" as const) =>
    boardModel(PROGRESSION, E_MAJOR, GUITAR, 24, label, false, true, {
      state: prog(p),
      playback: STOPPED,
    });
  const shown = (m: ReturnType<typeof model>) =>
    m.notes
      .filter((n) => n.shown)
      .map((n) => [n.name, n.string, n.fret, n.ring ? "ring" : "lit"]);

  it("lights Amaj7's shell, rings A°7's voices and marks A as held", () => {
    const m = model({ text: owner.text });
    expect(shown(m)).toEqual([
      ["A", 0, 5, "lit"],
      ["Gb", 2, 4, "ring"],
      ["G#", 2, 6, "lit"],
      ["C", 3, 5, "ring"],
      ["C#", 3, 6, "lit"],
    ]);
    expect(m.held).toEqual([{ string: 0, fret: 5 }]);
    expect(m.reference).toBe(
      "Colours and numbers: roles in Amaj7. Rings: A°7, the next chord.",
    );
    expect(m.title).toBe("Amaj7 shell · R 7 3, root on E · A G# C#");
  });

  it("labels the rings by their role in the next chord", () => {
    const m = model({ text: owner.text });
    const ring = m.notes.find((n) => n.shown && n.ring && n.name === "Gb");
    expect(ring?.role).toBe("seventh");
    expect(ring?.label).toBe("bb7");
  });

  it("follows the chord shown, and its next chord round the loop", () => {
    const last = model({ text: owner.text, current: 6 });
    expect(last.chord).toBe("Emaj7");
    expect(last.next).toBe("Amaj7");
  });

  it("follows the bar while playing", () => {
    const m = boardModel(
      PROGRESSION,
      E_MAJOR,
      GUITAR,
      24,
      "degree",
      false,
      true,
      {
        state: prog({ text: owner.text }),
        playback: { running: true, countIn: false, bar: 2, beat: 1 },
      },
    );
    expect(m.chord).toBe("G#m7");
    expect(m.held).toEqual([{ string: 3, fret: 4 }]);
  });

  it("shows other notes dimmed only with notes outside set to Dimmed", () => {
    const hidden = model({ text: owner.text });
    expect(hidden.notes.filter((n) => n.shown)).toHaveLength(5);
    const dimmed = boardModel(
      PROGRESSION,
      E_MAJOR,
      GUITAR,
      24,
      "degree",
      true,
      true,
      {
        state: prog({ text: owner.text }),
        playback: STOPPED,
      },
    );
    expect(dimmed.notes.filter((n) => n.shown).length).toBe(6 * 25);
    expect(
      dimmed.notes.filter((n) => n.shown && n.membership === "none").length,
    ).toBe(6 * 25 - 5);
  });

  it("shows no rings with a single chord, and nothing with none", () => {
    expect(model({ text: "Cmaj7" }).next).toBeUndefined();
    expect(model({ text: "" }).notes.some((n) => n.shown)).toBe(false);
    expect(model({ text: "" }).title).toBe(
      "Type chord symbols, separated by spaces",
    );
  });
});
