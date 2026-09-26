import { useEffect } from "react";

/** Background motion stops when the tab is hidden and under reduced motion (§4.3). */
export function useAmbientPause() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      document.documentElement.classList.toggle(
        "ambient-paused",
        document.hidden || reduced.matches,
      );
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync);
    };
  }, []);
}
