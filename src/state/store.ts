import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { columnOf, columns, type ColumnSpellings } from "../relations/index.ts";
import { enharmonicKey, type Selection, type Target } from "../theory/index.ts";
import type { HashView } from "./hash.ts";
import {
  checkFretboard,
  DEFAULT_FRETBOARD,
  DEFAULT_SHAPES,
  type ShapeState,
  loadFretboard,
  saveFretboard,
  type FretboardSettings,
} from "./fretboard.ts";
import {
  checkSelection,
  checkTarget,
  DEFAULT_SELECTION,
  respellTarget,
} from "./selection.ts";

export type Slot = "primary" | "compare";
export type View = HashView;

export type AppState = {
  selection: Selection;
  /** Panel chord chips show 7th chords (default) or triads. */
  sevenths: boolean;
  /** Audio is muted until the header toggle turns it on. */
  audioEnabled: boolean;
  /** The Compare control is armed: the next key picked becomes the compare. */
  compareArmed: boolean;
  /** Spelling chosen with the enharmonic toggle for columns no selected key is in. */
  columnSpellings: ColumnSpellings;
  view: View;
  fretboard: FretboardSettings;
  shapes: ShapeState;

  setPrimary: (target: Target) => void;
  setCompare: (target: Target) => void;
  clearCompare: () => void;
  /** Sets or clears a slot's focus chord. A non-diatonic chord is ignored with a warning. */
  setFocusChord: (slot: Slot, chord: string | undefined) => void;
  /** Replaces the whole selection, e.g. from the URL hash. */
  setSelection: (selection: Selection) => void;
  setSevenths: (sevenths: boolean) => void;
  setAudioEnabled: (enabled: boolean) => void;
  armCompare: (armed: boolean) => void;
  /**
   * The enharmonic toggle on a bottom column (§5.1): switches the column's
   * spelling and respells the selected keys in that column with it.
   */
  toggleColumnSpelling: (column: number) => void;
  setView: (view: View) => void;
  setFretboard: (settings: Partial<FretboardSettings>) => void;
  setShapes: (patch: Partial<ShapeState>) => void;
};

function warnAll(warnings: readonly string[]) {
  for (const w of warnings) console.warn(w);
}

function checked(target: Target): Target {
  const result = checkTarget(target);
  if (!result) throw new Error(`Invalid tonic: ${target.tonic}`);
  warnAll(result.warnings);
  return result.value;
}

export function createAppStore(
  fretboard: FretboardSettings = DEFAULT_FRETBOARD,
) {
  return createStore<AppState>()((set, get) => ({
    selection: DEFAULT_SELECTION,
    sevenths: true,
    audioEnabled: false,
    compareArmed: false,
    columnSpellings: {},
    view: "circle",
    fretboard,
    shapes: DEFAULT_SHAPES,

    setPrimary: (target) => {
      set({ selection: { ...get().selection, primary: checked(target) } });
    },
    setCompare: (target) => {
      const { primary } = get().selection;
      const compare = checked(target);
      const same =
        compare.tonic === primary.tonic && compare.kind === primary.kind;
      set({
        selection: same ? { primary } : { primary, compare },
        compareArmed: false,
      });
    },
    clearCompare: () => {
      set({
        selection: { primary: get().selection.primary },
        compareArmed: false,
      });
    },
    setFocusChord: (slot, chord) => {
      const { selection } = get();
      const current = selection[slot];
      if (!current) return;
      const key = { tonic: current.tonic, kind: current.kind };
      const next = chord === undefined ? key : checked({ ...key, chord });
      set({ selection: { ...selection, [slot]: next } });
    },
    setSelection: (selection) => {
      const result = checkSelection(selection);
      warnAll(result.warnings);
      set({ selection: result.value });
    },
    setSevenths: (sevenths) => {
      set({ sevenths });
    },
    setAudioEnabled: (audioEnabled) => {
      set({ audioEnabled });
    },
    armCompare: (compareArmed) => {
      set({ compareArmed });
    },
    toggleColumnSpelling: (column) => {
      const { selection, columnSpellings } = get();
      const col = columns(selection, columnSpellings)[column];
      if (!col?.alternate) return;
      const respell = (t: Target | undefined) => {
        if (!t || columnOf(t) !== column) return t;
        const key = enharmonicKey(t);
        return key ? respellTarget(t, key) : t;
      };
      const primary = respell(selection.primary) ?? selection.primary;
      const compare = respell(selection.compare);
      set({
        columnSpellings: { ...columnSpellings, [column]: col.alternate },
        selection: compare ? { primary, compare } : { primary },
      });
    },
    setView: (view) => {
      set({ view });
    },
    setShapes: (patch) => {
      set({ shapes: { ...get().shapes, ...patch } });
    },
    // A new key or chord starts the shape stepping again from the lowest shape.
    setFretboard: (settings) => {
      set({ fretboard: checkFretboard({ ...get().fretboard, ...settings }) });
    },
  }));
}

export type AppStore = ReturnType<typeof createAppStore>;

export const appStore = createAppStore(loadFretboard());
appStore.subscribe((state, previous) => {
  if (state.fretboard !== previous.fretboard) saveFretboard(state.fretboard);
});

export function useAppStore<T>(selector: (state: AppState) => T): T {
  return useStore(appStore, selector);
}
