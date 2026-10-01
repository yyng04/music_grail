import { describe, expect, it } from "vitest";
import {
  beatsOf,
  clickAt,
  drumHits,
  GRID,
  patternLengths,
  SIGS,
  stepAt,
  stylesFor,
  tapTempo,
  type Sig,
} from "../../src/audio/rhythm.ts";

/** Every click in one bar after the count-in, as [beat, step, level]. */
function clicks(sig: Sig) {
  const perBar = beatsOf(sig).count * GRID;
  return Array.from({ length: perBar }, (_, i) => stepAt(perBar + i, sig))
    .map((s) => [s.beat, s.sub, clickAt(s, sig)] as const)
    .filter(([, , c]) => c !== undefined);
}

describe("counting", () => {
  it("counts one bar in before bar 0", () => {
    expect(stepAt(0, "4/4")).toEqual({
      countIn: true,
      bar: 0,
      beat: 0,
      sub: 0,
    });
    expect(stepAt(4 * GRID - 1, "4/4")).toMatchObject({
      countIn: true,
      beat: 3,
    });
    expect(stepAt(4 * GRID, "4/4")).toEqual({
      countIn: false,
      bar: 0,
      beat: 0,
      sub: 0,
    });
    expect(stepAt(4 * GRID * 3 + GRID, "4/4")).toMatchObject({
      bar: 2,
      beat: 1,
    });
  });

  it("counts dotted quarters in 6/8 and 12/8", () => {
    expect(beatsOf("6/8")).toEqual({ count: 2, eighths: 3 });
    expect(beatsOf("12/8")).toEqual({ count: 4, eighths: 3 });
    expect(beatsOf("3/4")).toEqual({ count: 3, eighths: 1 });
  });
});

describe("the click", () => {
  it("in 4/4: loudest on beat 1, then each beat, nothing between", () => {
    expect(clicks("4/4")).toEqual([
      [0, 0, "accent"],
      [1, 0, "beat"],
      [2, 0, "beat"],
      [3, 0, "beat"],
    ]);
  });

  it("in 6/8: every eighth, louder on each dotted quarter, loudest on beat 1", () => {
    expect(clicks("6/8")).toEqual([
      [0, 0, "accent"],
      [0, 2, "eighth"],
      [0, 4, "eighth"],
      [1, 0, "beat"],
      [1, 2, "eighth"],
      [1, 4, "eighth"],
    ]);
    expect(clicks("12/8")).toHaveLength(12);
  });

  it("clicks in the count-in too", () => {
    expect(clickAt(stepAt(0, "3/4"), "3/4")).toBe("accent");
  });
});

describe("drum styles", () => {
  it("offer only the styles written for the time signature", () => {
    const names = (sig: Sig) => stylesFor(sig).map((s) => s.value);
    expect(names("4/4")).toEqual(["off", "rock", "swing", "bossa"]);
    expect(names("3/4")).toEqual(["off", "waltz"]);
    expect(names("6/8")).toEqual(["off", "six"]);
    expect(names("12/8")).toEqual(["off", "six"]);
    expect(names("2/4")).toEqual(["off"]);
  });

  it("write every bar of every pattern one bar long", () => {
    for (const { style, sig, lengths } of patternLengths())
      for (const n of lengths)
        expect(n, `${style} in ${sig}`).toBe(beatsOf(sig).count * GRID);
  });

  it("stay silent in the count-in and when the style does not fit", () => {
    expect(drumHits("rock", "4/4", stepAt(0, "4/4"))).toEqual([]);
    expect(drumHits("swing", "3/4", stepAt(3 * GRID, "3/4"))).toEqual([]);
    expect(drumHits("off", "4/4", stepAt(4 * GRID, "4/4"))).toEqual([]);
  });

  it("rock: kick and hi-hat on 1, snare and hi-hat on 2", () => {
    const at = (beat: number) =>
      drumHits("rock", "4/4", stepAt(4 * GRID + beat * GRID, "4/4")).map(
        (h) => h.sound,
      );
    expect(at(0)).toEqual(["kick", "hat"]);
    expect(at(1)).toEqual(["snare", "hat"]);
  });

  it("swing: the ride's skip note falls on the last triplet of beat 2", () => {
    const step = stepAt(4 * GRID + GRID + 4, "4/4");
    expect(drumHits("swing", "4/4", step)).toEqual([
      { sound: "ride", level: "soft" },
    ]);
  });

  it("bossa: the cross-stick pattern takes two bars", () => {
    const beat2 = (bar: number) =>
      drumHits("bossa", "4/4", stepAt((bar + 1) * 4 * GRID + GRID, "4/4")).some(
        (h) => h.sound === "cross",
      );
    expect([beat2(0), beat2(1), beat2(2)]).toEqual([false, true, false]);
  });

  it("every style plays something on beat 1", () => {
    for (const sig of SIGS)
      for (const s of stylesFor(sig).filter((x) => x.value !== "off")) {
        const first = stepAt(beatsOf(sig).count * GRID, sig);
        expect(drumHits(s.value, sig, first).length, s.value).toBeGreaterThan(
          0,
        );
      }
  });
});

describe("tap tempo", () => {
  it("reads the tempo from the gaps between taps", () => {
    expect(tapTempo([0, 500, 1000, 1500])).toBe(120);
    expect(tapTempo([0, 1000])).toBe(60);
  });

  it("needs two taps, forgets a pause over 2 s, and stays within 40 to 240", () => {
    expect(tapTempo([0])).toBeUndefined();
    expect(tapTempo([0, 5000, 5500])).toBe(120);
    expect(tapTempo([0, 100, 200])).toBe(240);
  });
});
