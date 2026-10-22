/** Cached cardinality is display data, not proof while a refresh is unresolved. */
export function assignmentDisplay(scope: {
  isPending: boolean; isFetching: boolean; isError: boolean; isSuccess: boolean;
  data?: { total: number };
}) {
  if (scope.isPending || scope.isFetching) return "checking";
  if (scope.isError) return "error";
  if (scope.isSuccess && scope.data?.total === 0) return "empty";
  return "ready";
}
