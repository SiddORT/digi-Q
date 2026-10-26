import { useEffect, useSyncExternalStore } from "react";
import * as api from "@workspace/api-client-react";
import { useRegisterUnsaved } from "../WorkspaceBranch";
import { bindDraftActor, bookingDraftVersion, hasDirtyBookingDrafts, subscribeBookingDrafts } from "./booking-drafts";

/** Mount in any long-lived host (rows, details). Binds drafts to the signed-in actor and keeps the unsaved-navigation
 *  guard registered even after an editor unmounts, because drafts outlive the editor. */
export function useBookingDraftGuard() {
  const me = api.useGetMe({ query: { queryKey: api.getGetMeQueryKey(), staleTime: 60000 } });
  const status = (me.error as { status?: number } | null)?.status;
  if (status === 401 || status === 403 || me.isSuccess && !me.data?.user) bindDraftActor("");
  else if (me.data?.user?.id) bindDraftActor(me.data.user.id);
  useSyncExternalStore(subscribeBookingDrafts, bookingDraftVersion, bookingDraftVersion);
  const dirty = hasDirtyBookingDrafts();
  useRegisterUnsaved(dirty);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}
