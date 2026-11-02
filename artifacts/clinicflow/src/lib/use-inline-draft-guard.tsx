import { useState } from "react";
import { useLocation } from "wouter";
import { useConfirm } from "../components/ConfirmDialog";
import { useRegisterUnsaved } from "../components/WorkspaceBranch";
import { useWorkspaceLeaveGuard } from "./use-workspace-leave-guard";

/** Inline editors use the same history/anchor protection as settings dialogs.
 * A failed save keeps the draft; only an acknowledged save or discard clears it. */
export function useInlineDraftGuard(busy: boolean) {
  const [dirty, setDirty] = useState(false);
  const [revision, setRevision] = useState(0);
  const [path] = useLocation();
  const confirmation = useConfirm();
  const discard = () => { setDirty(false); setRevision(value => value + 1); };
  useRegisterUnsaved(dirty, busy);
  useWorkspaceLeaveGuard(path, dirty || busy, options => busy ? Promise.resolve(false) : confirmation.ask(options), discard, true);
  // A successful response is published before this call. Remount the editor
  // against that response, so no stale dirty callback can re-arm the old draft.
  return { dirty, setDirty, revision, saved: discard, dialog: confirmation.dialog };
}
