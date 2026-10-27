import { useEffect, useRef } from "react";

/** Reveal URL-/validation-selected tabs without scrolling the page or panel. */
export function useTabStripVisibility(selection: string | number) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const strip = ref.current;
    if (!strip) return;
    const reveal = () => {
      const tab = strip.querySelector<HTMLElement>('[aria-selected="true"],[data-state="active"]');
      if (!tab) return;
      const parent = strip.getBoundingClientRect(), child = tab.getBoundingClientRect();
      if (child.left < parent.left + 3) strip.scrollLeft -= parent.left + 3 - child.left;
      else if (child.right > parent.right - 3) strip.scrollLeft += child.right - parent.right + 3;
    };
    reveal();
    const resize = new ResizeObserver(reveal);
    resize.observe(strip);
    return () => resize.disconnect();
  }, [selection]);
  return ref;
}
