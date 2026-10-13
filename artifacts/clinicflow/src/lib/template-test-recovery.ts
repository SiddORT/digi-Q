/** Only a definite no-dispatch result can offer a fresh request.
 * Unknown/accepted outcomes keep the original request's duplicate protection. */
export function canStartNewTemplateTest(status?: string) {
  return status === "pre_dispatch_failed";
}
