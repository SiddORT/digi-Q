export interface SearchSuggestion {
  id: string;
  label: string;
  description?: string;
  value: string;
}

export function visibleSearchMatches({
  value, settledQuery, loading, error, suggestions,
}: {
  value: string;
  settledQuery?: string;
  loading?: boolean;
  error?: string | null;
  suggestions?: SearchSuggestion[];
}) {
  const pending = !!loading || (settledQuery !== undefined && settledQuery !== value);
  const matches = pending || error || !value.trim() ? [] : (suggestions ?? []).slice(0, 8);
  return { pending, matches };
}