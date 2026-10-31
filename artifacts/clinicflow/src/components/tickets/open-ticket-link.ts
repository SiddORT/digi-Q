import * as api from "@workspace/api-client-react";
import { branchDirectionsUrl } from "@workspace/api-zod/ticket-directions";

/** Keep the popup handle so blocked popups are distinguishable from network errors. */
export function openTicketTab() {
  if (!navigator.onLine) throw new Error("You’re offline. Reconnect before opening this link.");
  const tab = window.open("", "_blank");
  if (!tab) throw new Error("Allow pop-ups for this site, then try again.");
  tab.opener = null;
  tab.document.querySelector("head")?.insertAdjacentHTML("beforeend", '<meta name="referrer" content="no-referrer">');
  tab.document.body.textContent = "Opening ticket link…";
  return tab;
}

export function openDirections(address?: string | null) {
  const url = branchDirectionsUrl(address);
  if (!url) throw new Error("The booked location has no saved address. Contact the clinic for directions.");
  const tab = openTicketTab();
  tab.location.replace(url);
}

/** Direct, uncached issuance: never put a share capability in a query or mutation cache. */
export async function openLiveTicket(input: { appointmentId?: string; receiptSecret?: string }, signal?: AbortSignal) {
  const tab = openTicketTab();
  const close = () => tab.close();
  signal?.addEventListener("abort", close, {once:true});
  try {
    if(signal?.aborted)throw new Error("This ticket view has closed.");
    const link = await api.issueLiveTicketLink(input, {signal});
    if(signal?.aborted)throw new Error("This ticket view has closed.");
    if (tab.closed) throw new Error("The ticket tab was closed. Try again.");
    tab.location.replace(link.url);
  } catch (error) { tab.close(); throw error; }
  finally { signal?.removeEventListener("abort",close); }
}
