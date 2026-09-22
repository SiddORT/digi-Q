CREATE OR REPLACE FUNCTION clinicflow_staff_manager_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'doctors' THEN
    PERFORM clinicflow_assert_staff_owner(NEW.user_id);
  ELSIF TG_TABLE_NAME = 'users' THEN
    PERFORM clinicflow_assert_staff_owner(NEW.id);
  ELSE
    RAISE EXCEPTION 'clinicflow_staff_manager_guard attached to unsupported table %', TG_TABLE_NAME
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;