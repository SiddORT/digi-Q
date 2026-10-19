import { useQueryClient } from "@tanstack/react-query";
import { getGetSmtpTestReceiptQueryKey, useGetSmtpTestReceipt, useConfirmSmtpTestReceipt } from "@workspace/api-client-react";

/** A staff assertion, never an SMTP/provider delivery status. */
export function SmtpTestReceipt({ disabled = false }: { disabled?: boolean }) {
  const qc = useQueryClient();
  const query = useGetSmtpTestReceipt({ query: {
    queryKey: getGetSmtpTestReceiptQueryKey(), staleTime: 0, refetchInterval: 60000,
  } });
  const confirmation = useConfirmSmtpTestReceipt();
  const test = query.data?.test;
  return <section aria-label="Test email receipt" data-testid="section-smtp-test-receipt">
    <h3>Test email receipt</h3>
    <p className="muted">Your confirmation only. This does not automatically verify inbox delivery or guarantee future emails.</p>
    {query.isLoading && <p role="status">Loading receipt status…</p>}
    {query.isError && <p role="alert">Receipt status is unavailable. <button type="button" className="button secondary" onClick={() => void query.refetch()}>Retry</button></p>}
    {!query.isLoading && !query.isError && !test && <p>No tracked test email yet. After sending a test and checking your mailbox, you can confirm receipt here.</p>}
    {test && <>
      <p>Latest tracked test: <time dateTime={test.sentAt}>{new Date(test.sentAt).toLocaleString()}</time>.</p>
      {test.receivedAt
        ? <p role="status" data-testid="status-smtp-received">User-confirmed received: <time dateTime={test.receivedAt}>{new Date(test.receivedAt).toLocaleString()}</time>. Confirmed by you, not automatically verified.</p>
        : <p>Receipt not yet confirmed.</p>}
      {!test.currentConfiguration
        ? <p role="note">This test used an earlier or unavailable SMTP configuration. It does not confirm receipt for the current settings.</p>
        : !test.receivedAt && ["provider_accepted", "delivery_unknown"].includes(test.status) &&
          <button type="button" className="button secondary" data-testid="button-confirm-smtp-received"
            disabled={disabled || confirmation.isPending || query.isFetching}
            onClick={() => confirmation.mutate({ data: { requestId: test.requestId, received: true } }, {
              onSuccess: result => { qc.setQueryData(getGetSmtpTestReceiptQueryKey(), result); },
              onSettled: () => { void qc.invalidateQueries({ queryKey: getGetSmtpTestReceiptQueryKey() }); },
            })}>{confirmation.isPending ? "Saving confirmation…" : "I received the test email"}</button>}
      {test.status === "sending" ? <p>Test dispatch has not finished. Refresh the status before confirming receipt.</p>
        : !["provider_accepted", "delivery_unknown"].includes(test.status) && <p>This test was not accepted for dispatch; receipt cannot be confirmed.</p>}
    </>}
    {confirmation.isError && <p role="alert">Receipt could not be saved. Refresh the status and check whether the saved SMTP settings changed.</p>}
  </section>;
}
