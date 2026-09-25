import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { Selection, Target } from "../theory/index.ts";
import { checkSelection, checkTarget, DEFAULT_SELECTION } from "./selection.ts";

export type Slot = "primary" | "compare";

export type AppState = {
  selection: Selection;
  /** Panel chord chips show 7th chords (default) or triads. */
  sevenths: boolean;
  /** Audio is muted until the header toggle turns it on. */
  audioEnabled: boolean;

  setPrimary: (target: Target) => void;
  setCompare: (target: Target) => void;
  clearCompare: () => void;
  /** Sets or clears a slot's focus chord. A non-diatonic chord is ignored with a warning. */
  setFocusChord: (slot: Slot, chord: string | undefined) => void;
  /** Replaces the whole selection, e.g. from the URL hash. */
  setSelection: (selection: Selection) => void;
  setSevenths: (sevenths: boolean) => void;
  setAudioEnabled: (enabled: boolean) => void;
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

export function createAppStore() {
  return createStore<AppState>()((set, get) => ({
    selection: DEFAULT_SELECTION,
    sevenths: true,
    audioEnabled: false,

    setPrimary: (target) => {
      set({ selection: { ...get().selection, primary: checked(target) } });
    },
    setCompare: (target) => {
      set({ selection: { ...get().selection, compare: checked(target) } });
    },
    clearCompare: () => {
      set({ selection: { primary: get().selection.primary } });
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
  }));
}

export type AppStore = ReturnType<typeof createAppStore>;

export const appStore = createAppStore();

export function useAppStore<T>(selector: (state: AppState) => T): T {
  return useStore(appStore, selector);
}
