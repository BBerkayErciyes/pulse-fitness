-- Custom SQL migration file, put your code below! --
-- Phase 8: roles change only through trusted server-side roles.
-- The column grant in 0001 already keeps `role` out of reach of `authenticated`;
-- this trigger is a second wall, so a future broad GRANT (or a new
-- SECURITY INVOKER function) still cannot mint an admin.
CREATE OR REPLACE FUNCTION public.guard_user_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.role <> 'member')
     OR (TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role) THEN
    -- current_user (not session_user): inside a SECURITY DEFINER function it is
    -- the function owner, which is exactly the privilege that matters.
    IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
      RAISE EXCEPTION 'role changes are not allowed for %', current_user
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.guard_user_role() FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
DROP TRIGGER IF EXISTS users_guard_role ON public.users;
--> statement-breakpoint
CREATE TRIGGER users_guard_role
  BEFORE INSERT OR UPDATE OF role ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_role();
