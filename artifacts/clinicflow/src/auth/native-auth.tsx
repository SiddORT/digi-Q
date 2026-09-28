import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { csrfToken } from "../lib/csrf";

type NativeAuth = {
  isLoaded: boolean;
  isSignedIn: boolean;
  error: string;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};
type Status = { authenticated?: boolean; isSignedIn?: boolean; role?: string | null; csrfToken?: string };
const Context = createContext<NativeAuth | null>(null);

export async function authRequest<T>(path: string, data?: unknown, method = "POST"): Promise<T> {
  const response = await fetch(`/api/auth/${path}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      ...(method !== "GET" ? { "X-CSRF-Token": await csrfToken() } : {}),
      ...(data !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
  const body = await response.json().catch(() => ({})) as T & { error?: string; message?: string };
  if (!response.ok) throw new Error(body.message || body.error || "The request could not be completed. Please try again.");
  return body;
}

export function NativeAuthProvider({ children }: { children: ReactNode }) {
  const [isLoaded, setLoaded] = useState(false);
  const [isSignedIn, setSignedIn] = useState(false);
  const [error, setError] = useState("");
  const previous = useRef<boolean | null>(null);
  const queryClient = useQueryClient();
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/status", { credentials: "same-origin", cache: "no-store" });
      if (response.status === 401) {
        if (previous.current === true) queryClient.clear();
        previous.current = false;
        setSignedIn(false);
        setError("");
        return;
      }
      if (!response.ok) throw new Error("Unable to verify your session. Please retry.");
      const status = await response.json() as Status;
      const signed = status.authenticated === true || status.isSignedIn === true || !!status.role;
      // A fresh session may belong to a different user with the same role.
      // Never reuse data cached under the previous account after auth refresh.
      queryClient.clear();
      previous.current = signed;
      setSignedIn(signed);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to verify your session.");
      throw caught;
    } finally {
      setLoaded(true);
    }
  }, [queryClient]);
  useEffect(() => { void refresh().catch(() => undefined); }, [refresh]);
  const logout = useCallback(async () => {
    await authRequest("logout", {});
    queryClient.clear();
    previous.current = false;
    setSignedIn(false);
    setError("");
  }, [queryClient]);
  return <Context.Provider value={{ isLoaded, isSignedIn, error, refresh, logout }}>{children}</Context.Provider>;
}
export function useNativeAuth(): NativeAuth {
  const context = useContext(Context);
  if (!context) throw new Error("Authentication provider is missing.");
  return context;
}