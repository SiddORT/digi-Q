-- DEVELOPMENT ONLY: operator must select the approved development target.
-- Aggregate output only. No account identifiers, email addresses, hashes or tokens.
-- No credentials, environment discovery, provisioning, migration or SMTP.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';

SELECT
  (SELECT count(*) FROM public.users) AS users,
  (SELECT count(*) FROM public.clinics) AS clinics,
  (SELECT count(*) FROM public.branches) AS branches,
  (SELECT count(*) FROM public.doctors) AS doctors,
  (SELECT count(*) FROM public.appointments) AS appointments;

SELECT count(*) AS normalized_email_collision_groups,
  coalesce(sum(accounts), 0)::bigint AS accounts_affected
FROM (
  SELECT count(*) AS accounts FROM public.users
  GROUP BY lower(btrim(email)) HAVING count(*) > 1
) collisions;

SELECT
  count(*) FILTER (WHERE email <> lower(btrim(email))) AS emails_needing_normalization,
  count(*) FILTER (WHERE nullif(btrim(email), '') IS NULL) AS empty_emails,
  count(*) FILTER (WHERE nullif(btrim(clerk_id), '') IS NOT NULL) AS retained_provider_mappings,
  count(*) FILTER (WHERE role <> 'patient' AND status = 'active') AS active_staff,
  count(*) FILTER (WHERE role <> 'patient' AND status = 'active'
    AND nullif(password_hash, '') IS NULL) AS active_staff_needing_password_setup,
  count(*) FILTER (WHERE role <> 'patient' AND status = 'active'
    AND password_hash LIKE '$argon2id$%') AS active_staff_argon2id_format,
  count(*) FILTER (WHERE role <> 'patient' AND status = 'active'
    AND nullif(password_hash, '') IS NOT NULL
    AND password_hash NOT LIKE '$argon2id$%') AS active_staff_other_hash_format
FROM public.users;

SELECT role, status, count(*) AS accounts,
  count(*) FILTER (WHERE nullif(password_hash, '') IS NULL) AS without_password
FROM public.users GROUP BY role, status ORDER BY role, status;

SELECT
  (SELECT count(*) FROM public.clinics c JOIN public.users u ON u.id = c.admin_id
    WHERE u.role = 'clinicAdmin') AS clinics_mapped_to_clinic_admin,
  (SELECT count(*) FROM public.clinics c LEFT JOIN public.users u ON u.id = c.admin_id
    WHERE u.id IS NULL OR u.role <> 'clinicAdmin') AS invalid_clinic_admin_mappings,
  (SELECT count(*) FROM public.clinics c LEFT JOIN public.users u ON u.id = c.owner_id
    WHERE c.owner_id IS NOT NULL AND u.id IS NULL) AS orphan_clinic_owners,
  (SELECT count(*) FROM public.branches b LEFT JOIN public.clinics c ON c.id = b.clinic_id
    WHERE c.id IS NULL) AS orphan_branches,
  (SELECT count(*) FROM public.doctors d JOIN public.users u ON u.id = d.user_id
    WHERE u.role IN ('doctor', 'clinicAdmin')) AS doctors_mapped_to_consulting_identities,
  (SELECT count(*) FROM public.doctors d LEFT JOIN public.users u ON u.id = d.user_id
    LEFT JOIN public.users a ON a.id = d.owner_admin_id
    WHERE u.id IS NULL OR u.role NOT IN ('doctor', 'clinicAdmin')
      OR a.id IS NULL OR a.role <> 'clinicAdmin') AS invalid_doctor_mappings,
  (SELECT count(*) FROM public.assignments) AS assignments,
  (SELECT count(*) FROM public.assignments a LEFT JOIN public.users u ON u.id = a.user_id
    LEFT JOIN public.clinics c ON c.id = a.clinic_id
    LEFT JOIN public.branches b ON b.id = a.branch_id
    WHERE u.id IS NULL OR c.id IS NULL OR (a.branch_id IS NOT NULL
      AND (b.id IS NULL OR b.clinic_id <> a.clinic_id))) AS invalid_assignment_mappings,
  (SELECT count(*) FROM public.appointments a
    LEFT JOIN public.patients p ON p.id = a.patient_id
    LEFT JOIN public.doctors d ON d.id = a.doctor_id
    LEFT JOIN public.clinics c ON c.id = a.clinic_id
    LEFT JOIN public.branches b ON b.id = a.branch_id
    LEFT JOIN public.users u ON u.id = a.actor_id
    WHERE p.id IS NULL OR d.id IS NULL OR c.id IS NULL OR b.id IS NULL
      OR u.id IS NULL OR b.clinic_id <> a.clinic_id) AS invalid_appointment_mappings,
  (SELECT count(*) FROM public.staff_session_proofs) AS retained_legacy_session_proofs;

SELECT
  (SELECT count(*) FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS public_tables,
  (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name IN ('password_hash', 'email_verified_at', 'password_changed_at', 'clerk_id')) AS native_and_legacy_user_columns,
  (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public'
    AND indexname IN ('appointment_token_idx', 'appointment_request_idx',
      'appointment_reference_idx', 'appointment_active_patient_idx',
      'appointment_one_consult_idx', 'assignment_user_clinic_only_unique',
      'assignment_user_branch_unique')) AS source_unique_guards_present_of_seven,
  (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public'
    AND indexname IN ('appointment_token_idx', 'appointment_active_patient_idx',
      'appointment_one_consult_idx')) AS booking_concurrency_guards_present_of_three,
  (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public'
    AND indexname = 'users_email_normalized_unique') AS normalized_email_unique_index,
  (SELECT count(*) FROM pg_constraint WHERE connamespace = 'public'::regnamespace
    AND conname IN ('appointment_status_check', 'appointment_token_positive',
      'assignment_branch_clinic_fk')) AS expected_integrity_constraints,
  (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT t.tgisinternal AND t.tgenabled <> 'D') AS enabled_application_triggers;

ROLLBACK;