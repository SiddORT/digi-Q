import { sql } from "drizzle-orm";
import { configurationDigest, inspectRegistrationSms } from "./approved-registration-sms";

/** Read-only, non-sending evidence. Never return URLs, credentials, contacts or message values. */
export async function registrationSmsDiagnostics(conn: any, environment: string, connectionString: string) {
  const url = new URL(connectionString);
  const targetFingerprint = configurationDigest([url.hostname, url.port || "5432", url.pathname]);
  const identity = await conn.execute(sql`select current_database() as database,
    current_schema() as schema, inet_server_addr()::text as address, inet_server_port() as port`);
  const storageFingerprint = configurationDigest(identity.rows);
  const result = await inspectRegistrationSms(conn, environment, targetFingerprint);
  const evidence = await conn.execute(sql`select
    exists(select 1 from settings where id='configuration-install:approved-registration-sms') as "receiptPresent",
    count(*)::int as "auditCount", max(created_at) as "latestAuditAt"
    from audit_logs where entity_type='notification_templates'
    and entity_id in ('sms-template:platform:registration_mobile_otp',
      'sms-template:platform:registration_mobile_otp:clinicAdmin')`);
  return { environment, targetFingerprint, storageFingerprint, ...result, evidence: evidence.rows[0], sends: 0 };
}
