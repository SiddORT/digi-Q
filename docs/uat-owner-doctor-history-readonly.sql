-- Run in the same confirmed UAT database, not a development fixture.
-- No contacts, patient records, credentials, summaries or raw JSON are selected.
-- Missing history is not proof that consulting consent was absent.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';

SELECT id, created_at,
       data->'registrationReceipt'->>'mode' AS registration_mode,
       data->'registrationReceipt'->>'actorId' AS registration_actor_id
FROM public.clinics
WHERE id = '99174216-168e-469a-995f-60b527d362bf';

-- Exact account/clinic/location history and events for the owner's self-profile.
-- The workspace records attachOwnDoctorProfile under the owner, including when
-- a Super Admin initiated onboarding. Do not assume deployed code is identical.
SELECT created_at, actor_id, action, entity_type, entity_id,
       count(*) OVER () AS total_matching_events
FROM public.audit_logs
WHERE (entity_type = 'users'
       AND entity_id = '3586790b-226c-4f10-8f6b-503eec3f5338')
   OR (entity_type = 'clinics'
       AND entity_id = '99174216-168e-469a-995f-60b527d362bf')
   OR (entity_type = 'branches'
       AND entity_id = 'b3b18641-d053-4d92-9f1e-58cbbb9e22d5')
   OR (entity_type = 'doctors' AND entity_id IN (
       SELECT entity_id FROM public.audit_logs
       WHERE entity_type = 'doctors'
         AND action = 'attachOwnDoctorProfile'
         AND actor_id = '3586790b-226c-4f10-8f6b-503eec3f5338'
   ))
ORDER BY created_at, id
LIMIT 50;

-- Follow only doctor IDs retained by this owner's self-profile audit or this
-- location's linked schedule. This can reveal a retired/unlinked profile
-- without searching unrelated accounts or returning clinical records.
WITH references_to_check AS (
  SELECT DISTINCT entity_id AS doctor_id
  FROM public.audit_logs
  WHERE entity_type = 'doctors'
    AND action = 'attachOwnDoctorProfile'
    AND actor_id = '3586790b-226c-4f10-8f6b-503eec3f5338'
  UNION
  SELECT data->'linkedSchedule'->>'doctorId'
  FROM public.branches
  WHERE id = 'b3b18641-d053-4d92-9f1e-58cbbb9e22d5'
)
SELECT r.doctor_id AS referenced_doctor_id,
       d.id IS NOT NULL AS profile_exists,
       d.user_id, d.owner_admin_id, d.status,
       count(*) OVER () AS total_referenced_profiles
FROM references_to_check r
LEFT JOIN public.doctors d ON d.id = r.doctor_id
WHERE r.doctor_id IS NOT NULL AND r.doctor_id <> ''
ORDER BY r.doctor_id
LIMIT 20;

ROLLBACK;
