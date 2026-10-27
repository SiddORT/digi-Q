import { useLayoutEffect, useRef, type ReactNode, type CSSProperties } from "react";
import "./listing-region.css";

/** A panel-local list and footer. No fixed/sticky positioning and no invented rows.
 * The viewport supplies a minimum, never a maximum: expanded/long content grows
 * naturally. Each nested panel measures its own start, not its parent's footer. */
export function ListingRegion({ children, className = "", label }: {
  children: ReactNode; className?: string; label?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect();
        let available = window.innerHeight - (rect.top + window.scrollY) - 32;
        // A dialog/panel scrollport owns its available space; using the browser
        // bottom here would unnecessarily push its footer outside that panel.
        for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
          const style = getComputedStyle(parent);
          if (/auto|scroll/.test(style.overflowY) && parent.clientHeight) {
            available = parent.clientHeight - (rect.top - parent.getBoundingClientRect().top + parent.scrollTop) - parseFloat(style.paddingBottom || "0");
            break;
          }
        }
        element.style.setProperty("--listing-space", `${Math.max(280, available)}px`);
      });
    };
    // Headers, chips and tab strips may change size without a window resize.
    const observer = new ResizeObserver(measure);
    for (const sibling of element.parentElement?.children || []) {
      if (sibling !== element) observer.observe(sibling);
    }
    window.addEventListener("resize", measure);
    measure();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  return <section ref={ref} className={`listing-region ${className}`} aria-label={label}
    style={{ "--listing-space": "max(280px, 45dvh)" } as CSSProperties}>{children}</section>;
}
