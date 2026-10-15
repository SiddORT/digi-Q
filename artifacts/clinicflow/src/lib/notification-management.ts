import * as api from "@workspace/api-client-react";
import type { QueryClient } from "@tanstack/react-query";

/** Both existing write paths affect these views. Never reset a wording form. */
export function refreshNotificationManagement(qc: QueryClient) {
  return Promise.all([
    api.getGetMyNotificationSettingsQueryKey()[0],
    api.getGetManagedNotificationSettingsQueryKey()[0],
    api.getGetEventControlsQueryKey()[0],
    api.getGetNotificationTemplatesQueryKey()[0],
    api.getListNotificationsQueryKey()[0],
  ].map(key => qc.invalidateQueries({ queryKey: [key] })));
}
