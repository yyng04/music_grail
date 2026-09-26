import { useEffect, useState, type RefObject } from "react";

/** The rendered width of an element, updated on resize. */
export function useElementWidth(
  ref: RefObject<Element | null>,
  fallback: number,
): number {
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width || fallback);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [ref, fallback]);
  return width;
}
