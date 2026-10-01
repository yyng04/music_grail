import {
  formatHash,
  parseHash,
  parseProgressionHash,
  parseShapes,
  parseView,
} from "./hash.ts";
import type { AppStore } from "./store.ts";

type HashWindow = Pick<
  Window,
  "location" | "history" | "addEventListener" | "removeEventListener"
>;

/**
 * Keeps the selection and the URL hash in step. The hash is rewritten in
 * canonical form (e.g. A-aeolian → A-minor) without adding history entries.
 */
export function startHashSync(
  store: AppStore,
  win: HashWindow = window,
): () => void {
  const write = () => {
    const { selection, view, shapes, progression } = store.getState();
    const hash = `#${formatHash(selection, view, shapes, progression)}`;
    if (win.location.hash !== hash) win.history.replaceState(null, "", hash);
  };

  const read = () => {
    const { value, warnings } = parseHash(win.location.hash);
    for (const w of warnings) console.warn(w);
    const state = store.getState();
    state.setSelection(value);
    const view = parseView(win.location.hash);
    if (view !== state.view) state.setView(view);
    state.setShapes(parseShapes(win.location.hash));
    state.setProgression(parseProgressionHash(win.location.hash));
    write();
  };

  read();
  const unsubscribe = store.subscribe((state, previous) => {
    if (
      state.selection !== previous.selection ||
      state.view !== previous.view ||
      state.shapes !== previous.shapes ||
      state.progression !== previous.progression
    )
      write();
  });
  win.addEventListener("hashchange", read);

  return () => {
    unsubscribe();
    win.removeEventListener("hashchange", read);
  };
}
