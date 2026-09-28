// Sound: muted until the header toggle turns it on; Tone.js and the
// samples load only then, and the bass samples only when a bass is chosen.
import type { Sampler } from "tone";
import { diatonicChords } from "../relations/index.ts";
import { appStore } from "../state/index.ts";
import { chordVoicing, type Target } from "../theory/index.ts";

export type Instrument = "guitar" | "bass";

// Self-hosted samples (CC0, see CREDITS.md), named by the pitch they sound.
const SAMPLES: Record<Instrument, string[]> = {
  guitar: [
    "Db2",
    "E2",
    "Gb2",
    "A2",
    "C3",
    "Eb3",
    "Gb3",
    "A3",
    "C4",
    "Eb4",
    "Gb4",
    "A4",
    "C5",
    "Eb5",
    "Gb5",
    "A5",
    "C6",
  ],
  bass: ["B0", "Eb1", "G1", "B1", "Eb2", "G2", "B2", "Eb3", "G3", "B3", "Eb4"],
};

let context: AudioContext | undefined;
let tone: Promise<typeof import("tone")> | undefined;
const samplers: Partial<Record<Instrument, Promise<Sampler>>> = {};

/**
 * Browsers only start sound inside a click or key press, so this runs first,
 * synchronously, in every handler that may play. Safe to call every time.
 */
export function unlockAudio(): void {
  context ??= new AudioContext({ latencyHint: "interactive" });
  if (context.state !== "running") void context.resume();
}

function loadTone() {
  tone ??= import("tone").then((T) => {
    if (context) T.setContext(context);
    return T;
  });
  return tone;
}

/** Loads an instrument's samples once; later calls share the same load. */
export function loadInstrument(kind: Instrument): Promise<Sampler> {
  samplers[kind] ??= loadTone().then(
    (T) =>
      new Promise<Sampler>((resolve, reject) => {
        const s = new T.Sampler({
          urls: Object.fromEntries(SAMPLES[kind].map((n) => [n, `${n}.mp3`])),
          baseUrl: `${import.meta.env.BASE_URL}samples/${kind}/`,
          release: 0.8,
          onload: () => {
            resolve(s);
          },
          onerror: (e) => {
            reject(e);
          },
        }).toDestination();
      }),
  );
  return samplers[kind];
}

/** The fretboard's instrument decides which samples its notes use. */
export function boardInstrument(): Instrument {
  return appStore.getState().fretboard.instrument === "guitar"
    ? "guitar"
    : "bass";
}

export type Part = {
  notes: string[];
  /** "note": one pitch; "chord": arpeggiated upward, then together; "block": together only. */
  style: "note" | "chord" | "block";
};

// Timers for notes still to come, so a new click replaces what is playing.
let pending: number[] = [];
const STEP = 0.16;

/** Plays parts one after another (a key, then its compare). Does nothing while muted. */
export function play(kind: Instrument, parts: Part[]): void {
  if (!appStore.getState().audioEnabled) return;
  const notes = parts.filter((p) => p.notes.length > 0);
  if (notes.length === 0) return;
  unlockAudio();
  loadInstrument(kind)
    .then((s) => {
      for (const t of pending) window.clearTimeout(t);
      pending = [];
      s.releaseAll();
      let at = 0;
      const later = (delay: number, fn: () => void) => {
        pending.push(window.setTimeout(fn, delay * 1000));
      };
      for (const part of notes) {
        if (part.style === "note") {
          later(at, () => s.triggerAttackRelease(part.notes, 1.6));
          at += 0.9;
          continue;
        }
        if (part.style === "chord") {
          part.notes.forEach((n, i) => {
            later(at + i * STEP, () => s.triggerAttackRelease(n, 1.1));
          });
          at += part.notes.length * STEP + 0.2;
        }
        later(at, () => s.triggerAttackRelease(part.notes, 1.8));
        at += 1.3;
      }
    })
    .catch((e: unknown) => {
      console.warn("Could not play sound", e);
    });
}

/** A chord in the middle octave, arpeggiated then held. */
export function chordPart(symbol: string): Part {
  return { notes: chordVoicing(symbol, 3), style: "chord" };
}

/** A key sounds as its tonic chord; with a compare set, the compare key follows. */
export function playKeys(primary: Target, compare?: Target): void {
  const tonic = (t: Target) =>
    chordPart(diatonicChords(t, { sevenths: false })[0]?.symbol ?? t.tonic);
  play("guitar", compare ? [tonic(primary), tonic(compare)] : [tonic(primary)]);
}
