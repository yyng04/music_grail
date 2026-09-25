import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAppStore,
  decodeChord,
  decodeKey,
  decodeNote,
  encodeChord,
  encodeKey,
  encodeNote,
  formatHash,
  parseHash,
  startHashSync,
} from "../../src/state/index.ts";
import { chordInfo } from "../../src/theory/index.ts";
import { urlChordRoundTrip, urlRoundTrip } from "../fixtures/course.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("URL hash", () => {
  it.each([
    ["F#", "Fs"],
    ["Bb", "Bb"],
    ["F##", "Fx"],
    ["Bbb", "Bbb"],
    ["C", "C"],
  ])("writes %s as %s", (note, text) => {
    expect(encodeNote(note)).toBe(text);
    expect(decodeNote(text)).toBe(note);
  });

  it("rejects unknown note text", () => {
    expect(decodeNote("H")).toBeUndefined();
    expect(decodeNote("Css")).toBeUndefined();
    expect(decodeNote("C#")).toBeUndefined();
  });

  it.each(urlRoundTrip)(
    "$text ↔ $key.tonic $key.kind",
    ({ text, key, canonical }) => {
      expect(decodeKey(text)).toEqual(key);
      expect(encodeKey(key)).toBe(canonical);
    },
  );

  it.each(urlChordRoundTrip)(
    "$text ↔ root $root, type $type",
    ({ text, root, type, symbol }) => {
      const decoded = decodeChord(text);
      expect(decoded).toBe(symbol);
      expect(chordInfo(symbol)).toMatchObject({ root, suffix: type });
      expect(encodeChord(symbol)).toBe(text);
    },
  );

  it("writes a major triad's type as maj", () => {
    expect(encodeChord("C")).toBe("C-maj");
    expect(decodeChord("C-maj")).toBe("C");
  });

  it("round-trips the spec example", () => {
    const hash = "#p=Fs-major&pchord=Fs-maj7&c=D-major&cchord=B-m7";
    const { value, warnings } = parseHash(hash);
    expect(warnings).toEqual([]);
    expect(value).toEqual({
      primary: { tonic: "F#", kind: "major", chord: "F#maj7" },
      compare: { tonic: "D", kind: "major", chord: "Bm7" },
    });
    expect(`#${formatHash(value)}`).toBe(hash);
  });

  it("defaults to C major with no hash", () => {
    expect(parseHash("")).toEqual({
      value: { primary: { tonic: "C", kind: "major" } },
      warnings: [],
    });
  });

  it("drops a non-diatonic chord with a warning", () => {
    const { value, warnings } = parseHash("p=C-major&pchord=D-7");
    expect(value.primary).toEqual({ tonic: "C", kind: "major" });
    expect(warnings).toHaveLength(1);
  });

  it("drops an unreadable key with a warning", () => {
    const { value, warnings } = parseHash("p=H-major&c=G-lydianish");
    expect(value).toEqual({ primary: { tonic: "C", kind: "major" } });
    expect(warnings).toHaveLength(2);
  });
});

describe("theoretical keys in the URL", () => {
  it("rewrites D# major as Eb major with a warning", () => {
    expect(parseHash("p=Ds-major")).toEqual({
      value: { primary: { tonic: "Eb", kind: "major" } },
      warnings: ["Rewriting D# major as Eb major: not a standard key"],
    });
  });

  it("respells the focus chord with the key", () => {
    const { value, warnings } = parseHash("p=Gs-major&pchord=Gs-maj7");
    expect(value.primary).toEqual({
      tonic: "Ab",
      kind: "major",
      chord: "Abmaj7",
    });
    expect(warnings).toHaveLength(1);
  });

  it("rewrites the compare key too", () => {
    const { value } = parseHash("p=C-major&c=Fb-major");
    expect(value.compare).toEqual({ tonic: "E", kind: "major" });
  });

  it("keeps a standard key with sharps, such as D# minor", () => {
    expect(parseHash("p=Ds-minor")).toEqual({
      value: { primary: { tonic: "D#", kind: "minor" } },
      warnings: [],
    });
  });
});

describe("store", () => {
  it("starts on C major with 7th chords and audio off", () => {
    const state = createAppStore().getState();
    expect(state.selection).toEqual({ primary: { tonic: "C", kind: "major" } });
    expect(state.sevenths).toBe(true);
    expect(state.audioEnabled).toBe(false);
  });

  it("sets and clears compare", () => {
    const store = createAppStore();
    store.getState().setPrimary({ tonic: "G", kind: "major" });
    store.getState().setCompare({ tonic: "D", kind: "major" });
    expect(store.getState().selection.compare).toEqual({
      tonic: "D",
      kind: "major",
    });
    store.getState().clearCompare();
    expect(store.getState().selection).toEqual({
      primary: { tonic: "G", kind: "major" },
    });
  });

  it("sets and clears a focus chord", () => {
    const store = createAppStore();
    store.getState().setPrimary({ tonic: "Bb", kind: "major" });
    store.getState().setFocusChord("primary", "Gm7");
    expect(store.getState().selection.primary.chord).toBe("Gm7");
    store.getState().setFocusChord("primary", undefined);
    expect(store.getState().selection.primary.chord).toBeUndefined();
  });

  it("ignores a non-diatonic focus chord with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = createAppStore();
    store.getState().setFocusChord("primary", "D7");
    expect(store.getState().selection.primary.chord).toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
  });

  it("rewrites a theoretical key with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = createAppStore();
    store.getState().setPrimary({ tonic: "D#", kind: "major" });
    expect(store.getState().selection.primary).toEqual({
      tonic: "Eb",
      kind: "major",
    });
    expect(warn).toHaveBeenCalledOnce();
  });

  it("rejects an invalid tonic", () => {
    const store = createAppStore();
    expect(() => {
      store.getState().setPrimary({ tonic: "H", kind: "major" });
    }).toThrow();
  });
});

function fakeWindow(hash: string) {
  const listeners = new Set<() => void>();
  const win = {
    location: { hash },
    history: {
      replaceState: vi.fn((_data: unknown, _unused: string, url: string) => {
        win.location.hash = url;
      }),
    },
    addEventListener: (_type: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_type: string, fn: () => void) =>
      listeners.delete(fn),
    navigate: (next: string) => {
      win.location.hash = next;
      for (const fn of listeners) fn();
    },
  };
  return win;
}

describe("hash sync", () => {
  it("reads the hash on start and rewrites it in canonical form", () => {
    const win = fakeWindow("#p=A-aeolian&pchord=A-m7");
    const store = createAppStore();
    startHashSync(store, win as unknown as Window);
    expect(store.getState().selection.primary).toEqual({
      tonic: "A",
      kind: "minor",
      chord: "Am7",
    });
    expect(win.location.hash).toBe("#p=A-minor&pchord=A-m7");
  });

  it("writes the default selection when there is no hash", () => {
    const win = fakeWindow("");
    startHashSync(createAppStore(), win as unknown as Window);
    expect(win.location.hash).toBe("#p=C-major");
  });

  it("writes selection changes to the hash", () => {
    const win = fakeWindow("");
    const store = createAppStore();
    startHashSync(store, win as unknown as Window);
    store.getState().setPrimary({ tonic: "G", kind: "major" });
    store.getState().setCompare({ tonic: "D", kind: "major" });
    expect(win.location.hash).toBe("#p=G-major&c=D-major");
  });

  it("follows hash changes and stops when cleaned up", () => {
    const win = fakeWindow("");
    const store = createAppStore();
    const stop = startHashSync(store, win as unknown as Window);
    win.navigate("#p=Eb-dorian");
    expect(store.getState().selection.primary).toEqual({
      tonic: "Eb",
      kind: "dorian",
    });
    stop();
    win.navigate("#p=G-major");
    expect(store.getState().selection.primary.tonic).toBe("Eb");
  });
});
