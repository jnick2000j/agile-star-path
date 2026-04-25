-- 1. Add org-level setting to restrict time logging to assigned tasks only
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS restrict_time_logging_to_assigned_tasks BOOLEAN NOT NULL DEFAULT false;

-- 2. Helper function: can a given user log time on a given task?
CREATE OR REPLACE FUNCTION public.can_user_log_time_on_task(_user_id UUID, _task_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id UUID;
  _restrict BOOLEAN;
  _assigned_to UUID;
  _is_org_manager BOOLEAN;
  _has_assignment BOOLEAN;
BEGIN
  IF _task_id IS NULL THEN
    RETURN TRUE;
  END IF;

  SELECT t.organization_id, t.assigned_to
    INTO _org_id, _assigned_to
    FROM public.tasks t
   WHERE t.id = _task_id;

  IF _org_id IS NULL THEN
    RETURN TRUE; -- task gone or unscoped, allow
  END IF;

  SELECT o.restrict_time_logging_to_assigned_tasks
    INTO _restrict
    FROM public.organizations o
   WHERE o.id = _org_id;

  IF NOT COALESCE(_restrict, FALSE) THEN
    RETURN TRUE;
  END IF;

  -- Platform admins always allowed
  IF public.is_admin(_user_id) THEN
    RETURN TRUE;
  END IF;

  -- Org admins/managers always allowed
  SELECT EXISTS (
    SELECT 1 FROM public.user_organization_access
     WHERE user_id = _user_id
       AND organization_id = _org_id
       AND access_level IN ('admin','manager')
  ) INTO _is_org_manager;

  IF _is_org_manager THEN
    RETURN TRUE;
  END IF;

  -- Direct assignee on the task row
  IF _assigned_to = _user_id THEN
    RETURN TRUE;
  END IF;

  -- Has an entry in task_assignments
  SELECT EXISTS (
    SELECT 1 FROM public.task_assignments ta
     WHERE ta.task_id = _task_id
       AND ta.user_id = _user_id
  ) INTO _has_assignment;

  RETURN COALESCE(_has_assignment, FALSE);
END;
$$;

-- 3. Trigger on timesheet_entries to enforce the rule on insert/update
CREATE OR REPLACE FUNCTION public.enforce_task_logging_permission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID;
BEGIN
  IF NEW.task_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT t.user_id INTO _user_id
    FROM public.timesheets t
   WHERE t.id = NEW.timesheet_id;

  IF _user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT public.can_user_log_time_on_task(_user_id, NEW.task_id) THEN
    RAISE EXCEPTION 'You are not allowed to log time on this task. Ask an admin to assign it to you.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_timesheet_entries_enforce_task_perm ON public.timesheet_entries;
CREATE TRIGGER trg_timesheet_entries_enforce_task_perm
BEFORE INSERT OR UPDATE OF task_id ON public.timesheet_entries
FOR EACH ROW
EXECUTE FUNCTION public.enforce_task_logging_permission();