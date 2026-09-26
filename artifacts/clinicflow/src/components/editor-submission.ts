/** Reviews only stage local state: unlike a save, they never toggle mutation busy. */
export function beginEditorSubmission(latch: { current: boolean }, busy: boolean, reviewOnly: boolean): boolean {
  if (busy || latch.current) return false;
  latch.current = !reviewOnly;
  return true;
}