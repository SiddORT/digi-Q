-- Run only against the identified affected environment.
-- psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
--   -v account_email='the-reported-email' \
--   -f scripts/receptionist-visibility-readonly.sql
-- Uses the operator's existing private connection. Never share that connection,
-- credentials, cookies, password hashes or tokens with the diagnostic output.
-- No ownership repair or other write is performed.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '5s';
WITH target AS (
  SELECT id, role, status, managing_admin_id, created_at
  FROM users WHERE lower(email) = lower(:'account_email')
), links AS (
  SELECT a.user_id, a.clinic_id, a.branch_id,
    c.admin_id AS clinic_admin_id, c.status AS clinic_status,
    b.clinic_id AS branch_clinic_id, b.status AS branch_status
  FROM assignments a
  JOIN target t ON t.id = a.user_id
  LEFT JOIN clinics c ON c.id = a.clinic_id
  LEFT JOIN branches b ON b.id = a.branch_id
), related_admins AS (
  SELECT managing_admin_id AS id FROM target
  UNION SELECT clinic_admin_id FROM links
)
SELECT jsonb_pretty(jsonb_build_object(
  'accountMatchCount', (SELECT count(*) FROM target),
  'accounts', coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM target t), '[]'::jsonb),
  'assignments', coalesce((SELECT jsonb_agg(to_jsonb(l)) FROM links l), '[]'::jsonb),
  'relatedAdministrators', coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', u.id, 'role', u.role, 'status', u.status,
      'ownedClinicIds', (SELECT coalesce(jsonb_agg(c.id), '[]'::jsonb) FROM clinics c WHERE c.admin_id = u.id),
      'savedAssignments', (SELECT coalesce(jsonb_agg(jsonb_build_object('clinicId', a.clinic_id, 'branchId', a.branch_id)), '[]'::jsonb) FROM assignments a WHERE a.user_id = u.id),
      'selectedWorkspaceClinicId', (SELECT s.data->>'clinicId' FROM settings s WHERE s.id = 'workspace:' || u.id)
    )) FROM users u JOIN related_admins r ON r.id = u.id
  ), '[]'::jsonb),
  'recentAccountAuditEvents', coalesce((
    SELECT jsonb_agg(to_jsonb(e)) FROM (
      SELECT a.id, a.actor_id, a.action, a.entity_type, a.entity_id, a.created_at
      FROM audit_logs a JOIN target t ON t.id = a.entity_id
      WHERE a.entity_type = 'users'
      ORDER BY a.created_at DESC, a.id DESC LIMIT 20
    ) e
  ), '[]'::jsonb)
)) AS diagnostic;
ROLLBACK;
