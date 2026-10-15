/** Full-value reveals and explanatory help share one visible overlay at a time. */
export const DISMISS_TOOLTIPS = "dq:dismiss-tooltips";
export const dismissTooltips = () => window.dispatchEvent(new Event(DISMISS_TOOLTIPS));
