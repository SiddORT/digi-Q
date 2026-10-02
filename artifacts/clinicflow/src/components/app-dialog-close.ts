export type CloseDecision = "block" | "confirm" | "close" | "ignore";

/** Decides what a close request (X, Escape, backdrop) should do. */
export function decideCloseRequest(state: { busy: boolean; dirty: boolean; confirming: boolean }): CloseDecision {
  if (state.busy) return "block";
  if (state.confirming) return "ignore";
  if (state.dirty) return "confirm";
  return "close";
}
