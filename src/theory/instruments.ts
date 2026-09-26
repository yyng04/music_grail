import { Note } from "tonal";

/**
 * A tuning is data (§5.2): the open-string notes with octave, lowest string
 * first. Every instrument and tuning goes through the same rendering code.
 */
export type Tuning = {
  id: string;
  name: string;
  /** In a sentence: "standard tuning", "drop D tuning". */
  phrase: string;
  strings: readonly string[];
};

export type Instrument = {
  id: "guitar" | "bass4" | "bass5";
  name: string;
  tunings: readonly Tuning[];
  /** Fret counts on offer; the first is the default. */
  frets: readonly number[];
};

export const INSTRUMENTS: readonly Instrument[] = [
  {
    id: "guitar",
    name: "Guitar",
    tunings: [
      {
        id: "standard",
        name: "Standard",
        phrase: "standard tuning",
        strings: ["E2", "A2", "D3", "G3", "B3", "E4"],
      },
      {
        id: "drop-d",
        name: "Drop D",
        phrase: "drop D tuning",
        strings: ["D2", "A2", "D3", "G3", "B3", "E4"],
      },
    ],
    frets: [24, 22],
  },
  {
    id: "bass4",
    name: "Bass, 4-string",
    tunings: [
      {
        id: "standard",
        name: "Standard",
        phrase: "standard tuning",
        strings: ["E1", "A1", "D2", "G2"],
      },
    ],
    frets: [24, 20],
  },
  {
    id: "bass5",
    name: "Bass, 5-string",
    tunings: [
      {
        id: "standard",
        name: "Standard",
        phrase: "standard tuning",
        strings: ["B0", "E1", "A1", "D2", "G2"],
      },
    ],
    frets: [24, 20],
  },
];

export type InstrumentId = Instrument["id"];

export function instrument(id: InstrumentId): Instrument {
  return INSTRUMENTS.find((i) => i.id === id) ?? (INSTRUMENTS[0] as Instrument);
}

export function tuning(id: InstrumentId, tuningId: string): Tuning {
  const tunings = instrument(id).tunings;
  return tunings.find((t) => t.id === tuningId) ?? (tunings[0] as Tuning);
}

/** MIDI number of a note with octave, e.g. "E2" → 40. */
export function midi(note: string): number {
  const m = Note.midi(note);
  if (m === null) throw new Error(`Not a note with octave: ${note}`);
  return m;
}

/**
 * The pitch at a fret, spelled with sharps and an octave ("E2", 6 → "A#2").
 * Views respell it in the key's spelling with `respell`.
 */
export function fretPitch(open: string, fret: number): string {
  return Note.fromMidiSharps(midi(open) + fret);
}

/**
 * A pitch respelled with another pitch class of the same sound, keeping the
 * octave right across B/C: ("C4", "B#") → "B#3", ("F4", "E#") → "E#4".
 */
export function respell(pitch: string, pc: string): string {
  const out = Note.enharmonic(pitch, pc);
  if (!out) throw new Error(`Cannot spell ${pitch} as ${pc}`);
  return out;
}
