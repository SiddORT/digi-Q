import type { ReactNode } from "react";
import * as api from "../lib/api";
import { useNativeAuth } from "../auth/native-auth";
import { PageSizePreferenceProvider } from "../lib/page-size-preference";

export function PageSizeAccountBoundary({ children }: { children: ReactNode }) {
  const auth = useNativeAuth();
  const me = api.useGetMe({ query: { queryKey: api.getGetMeQueryKey(), enabled: auth.isLoaded && auth.isSignedIn } });
  const actor = auth.isLoaded && auth.isSignedIn ? me.data?.user?.id : undefined;
  // Remount local listing state on account transitions, never carry another actor's chosen size.
  return <PageSizePreferenceProvider key={actor || "guest"} actor={actor}>{children}</PageSizePreferenceProvider>;
}
