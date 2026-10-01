import { useEffect, type RefObject } from "react";

/**
 * Marks which ends of a sideways-scrolling row have more behind them
 * (data-fade: "start", "end", "both" or none), so only those ends fade.
 */
export function useRowFades(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const start = el.scrollLeft > 1;
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      el.dataset.fade =
        start && end ? "both" : start ? "start" : end ? "end" : "";
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      resize.disconnect();
    };
  }, [ref]);
}
