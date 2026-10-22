import { useState } from "react";
import { useDebouncedValue } from "./use-debounced-value";

/** A new actor/parent scope must start unsearched, even during debounce. */
export function useLookupSearch(scope: string) {
  const [state, setState] = useState({ scope, term: "" });
  const delayed = useDebouncedValue(state);
  return {
    search: state.scope === scope ? state.term : "",
    debounced: delayed.scope === scope ? delayed.term : "",
    setSearch: (term: string) => setState({ scope, term }),
  };
}
