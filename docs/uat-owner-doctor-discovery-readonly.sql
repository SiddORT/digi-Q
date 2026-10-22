-- Read-only incident evidence, not a migration or repair.
-- An authorized UAT maintainer must first confirm that this connection is to
-- the database used by the running uat.digi-q.in API, not a workspace fixture.
-- Run the whole script in one SQL session using a read-only database account.
-- If a table/column is missing, stop and report that error; do not alter schema.
-- Return only these result sets, never connection details or credentials.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';

SELECT 'owner_account' AS evidence, id, role, status
FROM public.users
WHERE id = '3586790b-226c-4f10-8f6b-503eec3f5338';

-- Bypass the API directory projection. No status/clinic/location exclusions.
-- An empty result does not identify why a profile is absent or whether a
-- historical retired profile (whose user_id was erased) previously existed.
SELECT 'owner_doctor_profile' AS evidence,
       id, user_id, owner_admin_id, status,
       data->'branchIds' AS saved_consulting_location_ids
FROM public.doctors
WHERE user_id = '3586790b-226c-4f10-8f6b-503eec3f5338'
ORDER BY id;

SELECT 'selected_clinic' AS evidence, id, admin_id, status
FROM public.clinics
WHERE id = '99174216-168e-469a-995f-60b527d362bf';

SELECT 'selected_location' AS evidence, id, clinic_id, status
FROM public.branches
WHERE id = 'b3b18641-d053-4d92-9f1e-58cbbb9e22d5';

SELECT 'owner_clinic_assignments' AS evidence,
       user_id, clinic_id, branch_id
FROM public.assignments
WHERE user_id = '3586790b-226c-4f10-8f6b-503eec3f5338'
  AND clinic_id = '99174216-168e-469a-995f-60b527d362bf'
ORDER BY branch_id NULLS FIRST;

ROLLBACK;
