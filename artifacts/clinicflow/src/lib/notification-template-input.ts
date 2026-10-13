import type { NotificationTemplateContent } from "@workspace/api-client-react";

/** Only send fields owned by the selected editor. Sender/Entity IDs come from configuration. */
export function templateContentForSave(content: NotificationTemplateContent, channel: "email" | "sms", title: string): NotificationTemplateContent {
  const common = {
    enabled: content.enabled, subject: content.subject, body: content.body,
    prefix: content.prefix, footer: content.footer, logoUrl: content.logoUrl,
  };
  return channel === "sms"
    ? { ...common, subject: content.subject.trim() || title, prefix: "", footer: "", logoUrl: "",
      dltTemplateId: (content.dltTemplateId ?? "").trim() }
    : common;
}
