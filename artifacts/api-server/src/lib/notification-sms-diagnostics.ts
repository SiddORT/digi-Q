// Never return a provider's raw text: it can echo credentials, contacts or message content.
const messages = {
  authentication_failed: "The provider denied authentication or access. Check the API key, Bearer token, Client ID and account permissions.",
  dlt_validation_failed: "The provider reports a DLT/template problem. Check this event's DLT Template ID and match the approved message wording exactly.",
  sender_validation_failed: "The provider reports a Sender ID/header problem. Check that the configured sender is approved for this account and template.",
  recipient_validation_failed: "The provider reports an invalid recipient or country code. Check the recipient and the configured country-code format.",
  insufficient_credit: "The provider reports insufficient SMS balance or credits.",
  rate_limited: "The provider rate-limited the request. Wait before starting another test.",
  account_or_route_blocked: "The provider reports a blocked, disabled or suspended account or SMS route.",
  message_validation_failed: "The provider reports invalid message content, length or characters. Check the approved template and provider message limits.",
  endpoint_not_found: "The provider endpoint was not found. Check the configured SMS API URL.",
  unspecified_rejection: "The provider rejected the message without a recognized reason. Check the provider portal for this attempt; no detailed response text is retained.",
} as const;
export type SmsDiagnostic = { code: keyof typeof messages; message: string; httpStatus?: number };

export function storedSmsDiagnostic(code: unknown, httpStatus?: unknown): SmsDiagnostic | undefined {
  if (typeof code !== "string" || !Object.hasOwn(messages, code)) return undefined;
  const key = code as keyof typeof messages;
  return { code: key, message: messages[key], ...(typeof httpStatus === "number" && Number.isInteger(httpStatus) &&
    httpStatus >= 100 && httpStatus <= 599 ? { httpStatus } : {}) };
}

/** Only call for an already classified, definite rejection. Categories are hints, not inferred acceptance. */
export function smsRejectionDiagnostic(httpStatus: number, body: string): SmsDiagnostic {
  let text = "";
  try {
    const result = JSON.parse(body);
    text = ["Message", "message", "Error", "error", "ErrorMessage", "error_description", "ErrorCode", "errorCode", "Code", "code"]
      .filter(key => result && Object.hasOwn(result, key) && typeof result[key] === "string")
      .map(key => result[key].slice(0, 500)).join(" ");
  } catch { /* Unknown response formats stay unspecified; never echo raw data. */ }
  let code: SmsDiagnostic["code"] = "unspecified_rejection";
  if (httpStatus === 401 || httpStatus === 403 || /unauthori[sz]ed|(?:invalid|expired|wrong).*(?:api.?key|token|credential|client.?id)|(?:api.?key|token|credential|client.?id).*(?:invalid|expired|wrong)|authentication.*(?:fail|error)|access denied/i.test(text)) code = "authentication_failed";
  else if (httpStatus === 429) code = "rate_limited";
  else if (httpStatus === 404) code = "endpoint_not_found";
  else if (/insufficient.*(?:balance|credit)|(?:balance|credit).*(?:insufficient|exhausted)|not enough.*credit/i.test(text)) code = "insufficient_credit";
  else if (/\bdlt\b|\btemplate(?:[ _-]?id)?\b|message.*(?:mismatch|not match)/i.test(text)) code = "dlt_validation_failed";
  else if (/\bsender(?:[ _-]?id)?\b|\bheader\b/i.test(text)) code = "sender_validation_failed";
  else if (/\brecipient\b|\bmobile\b|\bphone\b|country.?code/i.test(text)) code = "recipient_validation_failed";
  else if (/\bblocked\b|\bdisabled\b|\bsuspended\b|\bblacklist\b/i.test(text)) code = "account_or_route_blocked";
  else if (/message.*(?:invalid|length|character|too long|empty)|invalid.*message/i.test(text)) code = "message_validation_failed";
  return storedSmsDiagnostic(code, httpStatus)!;
}
