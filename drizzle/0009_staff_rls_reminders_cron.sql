-- Custom SQL migration file, put your code below! --
-- Phase 12: staff role in RLS, consent/reminder table security, and the
-- daily reminder job (pg_cron -> pg_net -> /api/cron/reminders).
--
-- 'staff' is added to user_role in 0008, and drizzle-kit applies pending
-- migrations in one transaction, where a freshly added enum value cannot be
-- used yet. Hence role::text comparisons below instead of 'staff'::user_role.

-- ---------------------------------------------------------------------------
-- 1. Staff check (admin or staff)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (SELECT auth.uid()) AND role::text IN ('admin', 'staff')
  );
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.is_staff() FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2. Staff can read members, subscription status and gate logs. Writes stay
--    server-only; finance stays admin-only (admin_live_plan_counts).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS users_select_own_or_admin ON public.users;
--> statement-breakpoint
CREATE POLICY users_select_own_or_staff ON public.users
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR (SELECT public.is_staff()));
--> statement-breakpoint
DROP POLICY IF EXISTS subscriptions_select_own_or_admin ON public.subscriptions;
--> statement-breakpoint
CREATE POLICY subscriptions_select_own_or_staff ON public.subscriptions
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_staff()));
--> statement-breakpoint
DROP POLICY IF EXISTS access_logs_select_own_or_admin ON public.access_logs;
--> statement-breakpoint
CREATE POLICY access_logs_select_own_or_staff ON public.access_logs
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_staff()));
--> statement-breakpoint

-- Gate traffic is operational data, so staff may see the daily chart.
CREATE OR REPLACE FUNCTION public.admin_access_daily(p_days integer DEFAULT 7)
RETURNS TABLE (day date, granted bigint, denied bigint, unique_members bigint)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  tz constant text := 'Europe/Istanbul';
  first_day date;
BEGIN
  IF NOT (SELECT public.is_staff()) THEN
    RAISE EXCEPTION 'staff only' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_days IS NULL OR p_days < 1 OR p_days > 90 THEN
    RAISE EXCEPTION 'p_days must be between 1 and 90' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  first_day := (now() AT TIME ZONE tz)::date - (p_days - 1);

  RETURN QUERY
  WITH logs AS (
    SELECT (l.created_at AT TIME ZONE tz)::date AS d, l.granted, l.user_id
    FROM public.access_logs l
    WHERE l.created_at >= (first_day::timestamp AT TIME ZONE tz)
  )
  SELECT
    g.d::date,
    count(*) FILTER (WHERE logs.granted),
    count(*) FILTER (WHERE NOT logs.granted),
    count(DISTINCT logs.user_id) FILTER (WHERE logs.granted)
  FROM generate_series(first_day, (now() AT TIME ZONE tz)::date, interval '1 day') AS g(d)
  LEFT JOIN logs ON logs.d = g.d::date
  GROUP BY g.d
  ORDER BY g.d;
END;
$$;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 3. Consents: members read their own proof, staff read all; only the server
--    writes (signup / consent page). Reminder ledger: server only.
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.user_consents, public.subscription_reminders FROM anon, authenticated;
--> statement-breakpoint
GRANT SELECT ON public.user_consents TO authenticated;
--> statement-breakpoint
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.subscription_reminders ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_consents_select_own_or_staff ON public.user_consents
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_staff()));
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 4. Daily reminder job. The URL and shared secret are per environment, so
--    they live in Supabase Vault (set with `npm run reminders:setup`), not
--    here. Until both are set the job is a logged no-op.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.run_subscription_reminders()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  app_url text;
  cron_secret text;
BEGIN
  SELECT decrypted_secret INTO app_url FROM vault.decrypted_secrets WHERE name = 'pulse_app_url';
  SELECT decrypted_secret INTO cron_secret FROM vault.decrypted_secrets WHERE name = 'pulse_cron_secret';
  IF app_url IS NULL OR cron_secret IS NULL THEN
    RAISE NOTICE 'subscription reminders skipped: pulse_app_url / pulse_cron_secret not set in Vault';
    RETURN NULL;
  END IF;

  -- Asynchronous; the response lands in net._http_response.
  RETURN net.http_post(
    url := rtrim(app_url, '/') || '/api/cron/reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || cron_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
END;
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.run_subscription_reminders() FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
-- 06:00 UTC = 09:00 Europe/Istanbul. Re-running cron.schedule with the same
-- name updates the job instead of duplicating it.
SELECT cron.schedule('pulse-subscription-reminders', '0 6 * * *', 'SELECT public.run_subscription_reminders()');
