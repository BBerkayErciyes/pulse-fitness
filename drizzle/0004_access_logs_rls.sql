-- Custom SQL migration file, put your code below! --
-- Phase 4: access_logs follows the Phase 2 model — members read their own
-- entries, admins read all, only the server (postgres / service_role) writes.
REVOKE ALL ON public.access_logs FROM anon, authenticated;
--> statement-breakpoint
GRANT SELECT ON public.access_logs TO authenticated;
--> statement-breakpoint
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY access_logs_select_own_or_admin ON public.access_logs
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));
