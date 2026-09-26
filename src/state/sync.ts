import { formatHash, parseHash, parseView } from "./hash.ts";
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
    const { selection, view } = store.getState();
    const hash = `#${formatHash(selection, view)}`;
    if (win.location.hash !== hash) win.history.replaceState(null, "", hash);
  };

  const read = () => {
    const { value, warnings } = parseHash(win.location.hash);
    for (const w of warnings) console.warn(w);
    const state = store.getState();
    state.setSelection(value);
    const view = parseView(win.location.hash);
    if (view !== state.view) state.setView(view);
    write();
  };

  read();
  const unsubscribe = store.subscribe((state, previous) => {
    if (state.selection !== previous.selection || state.view !== previous.view)
      write();
  });
  win.addEventListener("hashchange", read);

  return () => {
    unsubscribe();
    win.removeEventListener("hashchange", read);
  };
}
