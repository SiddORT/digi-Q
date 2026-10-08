import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { authRequest } from "../lib/auth-request";
export { authRequest } from "../lib/auth-request";

type NativeAuth = {
  isLoaded: boolean;
  isSignedIn: boolean;
  error: string;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};
type Status = { authenticated?: boolean; isSignedIn?: boolean; role?: string | null; csrfToken?: string };
const Context = createContext<NativeAuth | null>(null);

type SessionState = { isLoaded: boolean; isSignedIn: boolean; error: string };
type SessionSignal = "signed-out" | "session-changed";

/** One boundary for transport 401s, polling, logout and other tabs. Exported for
 * isolated lifecycle tests; no credentials or identity data enter tab messages.
 */
export function createSessionLifecycle(options: {
  queryClient: QueryClient;
  state: (state: SessionState) => void;
  publish: (signal: SessionSignal) => void;
}) {
  let signed = false, epoch = 0, boundaryAt = 0;
  let pending: Promise<void> | undefined;
  const clear = () => {
    void options.queryClient.cancelQueries().catch(() => undefined);
    options.queryClient.clear();
  };
  const invalidate = (broadcast = true) => {
    const wasSigned = signed;
    epoch++; boundaryAt = performance.now(); signed = false;
    clear();
    options.state({ isLoaded: true, isSignedIn: false, error: "" });
    if (wasSigned && broadcast) options.publish("signed-out");
  };
  const refresh = (background = false): Promise<void> => {
    if (background && pending) return pending;
    if (!background) {
      epoch++; boundaryAt = performance.now();
      clear();
      options.state({ isLoaded: false, isSignedIn: signed, error: "" });
    }
    const requestEpoch = epoch;
    const work = (async () => {
    try {
      const response = await fetch("/api/auth/status", { credentials: "same-origin", cache: "no-store" });
      if (requestEpoch !== epoch) return;
      if (response.status === 401) {
        invalidate();
        return;
      }
      if (!response.ok) throw new Error("Unable to verify your session. Please retry.");
      const status = await response.json() as Status;
      if (requestEpoch !== epoch) return;
      const authenticated = status.authenticated === true || status.isSignedIn === true || !!status.role;
      if (!authenticated) { invalidate(); return; }
      // AuthAccess observes this response instead of independently checking the
      // same session. Epoch checks above prevent old-account cache hydration.
      options.queryClient.setQueryData(["/api/auth/status"], status);
      signed = true;
      options.state({ isLoaded: true, isSignedIn: true, error: "" });
      if (!background) options.publish("session-changed");
    } catch {
      if (requestEpoch !== epoch) return;
      options.state({ isLoaded: true, isSignedIn: signed, error: "Unable to verify your session. Please retry." });
      throw new Error("Unable to verify your session. Please retry.");
    }
    })();
    pending = work;
    void work.finally(() => { if (pending === work) pending = undefined; }).catch(() => undefined);
    return work;
  };
  const logout = async () => {
    await authRequest("logout", {});
    invalidate();
  };
  return {
    refresh, logout,
    unauthorized(startedAt: number) {
      if (signed && Number.isFinite(startedAt) && startedAt >= boundaryAt) invalidate();
    },
    receive(signal: unknown) {
      if (signal === "signed-out") invalidate(false);
      else if (signal === "session-changed") {
        // Never rebroadcast received messages; do not reuse same-role caches.
        epoch++; boundaryAt = performance.now(); clear();
        options.state({ isLoaded: false, isSignedIn: signed, error: "" });
        pending = undefined;
        void refresh(true).catch(() => undefined);
      }
    },
    check(periodic = false) {
      const checkedAt = options.queryClient.getQueryState(["/api/auth/status"])?.dataUpdatedAt || 0;
      if (signed && (periodic || Date.now() - checkedAt >= 60_000)) void refresh(true).catch(() => undefined);
    },
    stop() { epoch++; pending = undefined; },
  };
}

export function NativeAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ isLoaded: false, isSignedIn: false, error: "" });
  const queryClient = useQueryClient();
  const publish = useRef<(signal: SessionSignal) => void>(() => undefined);
  const lifecycle = useMemo(() => createSessionLifecycle({
    queryClient, state: setState, publish: signal => publish.current(signal),
  }), [queryClient]);
  const refresh = useMemo(() => () => lifecycle.refresh(), [lifecycle]);
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try { if (typeof BroadcastChannel !== "undefined") channel = new BroadcastChannel("digiq-session"); }
    catch { /* Restricted browser contexts use the non-credential storage signal. */ }
    const storageKey = "digiq-session-signal";
    publish.current = signal => {
      try {
        if (channel) channel.postMessage(signal);
        else {
          // Fallback contains only an event + nonce, never credentials or user data.
          localStorage.setItem(storageKey, JSON.stringify({ signal, nonce: crypto.randomUUID() }));
          localStorage.removeItem(storageKey);
        }
      } catch { /* Storage/channel may be disabled; periodic status checks remain. */ }
    };
    if (channel) channel.onmessage = event => lifecycle.receive(event.data);
    const storage = (event: StorageEvent) => {
      if (event.key !== storageKey || !event.newValue) return;
      try { lifecycle.receive(JSON.parse(event.newValue).signal); } catch { /* Ignore malformed signals. */ }
    };
    const unauthorized = (event: Event) => lifecycle.unauthorized((event as CustomEvent).detail?.startedAt);
    const visible = () => { if (document.visibilityState === "visible") lifecycle.check(); };
    window.addEventListener("digiq:session-unauthorized", unauthorized);
    window.addEventListener("storage", storage);
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    // Status checks do not renew the fixed 12-hour session.
    const timer = window.setInterval(() => lifecycle.check(true), 60_000);
    void lifecycle.refresh().catch(() => undefined);
    return () => {
      lifecycle.stop(); publish.current = () => undefined;
      channel?.close(); window.clearInterval(timer);
      window.removeEventListener("digiq:session-unauthorized", unauthorized);
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [lifecycle]);
  return <Context.Provider value={{ ...state, refresh, logout: lifecycle.logout }}>{children}</Context.Provider>;
}
export function useNativeAuth(): NativeAuth {
  const context = useContext(Context);
  if (!context) throw new Error("Authentication provider is missing.");
  return context;
}