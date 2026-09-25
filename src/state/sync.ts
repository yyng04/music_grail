import { formatHash, parseHash } from "./hash.ts";
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
    const hash = `#${formatHash(store.getState().selection)}`;
    if (win.location.hash !== hash) win.history.replaceState(null, "", hash);
  };

  const read = () => {
    const { value, warnings } = parseHash(win.location.hash);
    for (const w of warnings) console.warn(w);
    store.getState().setSelection(value);
    write();
  };

  read();
  const unsubscribe = store.subscribe((state, previous) => {
    if (state.selection !== previous.selection) write();
  });
  win.addEventListener("hashchange", read);

  return () => {
    unsubscribe();
    win.removeEventListener("hashchange", read);
  };
}
