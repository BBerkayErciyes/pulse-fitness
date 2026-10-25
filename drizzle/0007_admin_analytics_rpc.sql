-- Custom SQL migration file, put your code below! --
-- Phase 10: admin analytics RPCs, called with the admin's own JWT via
-- supabase.rpc(). SECURITY INVOKER keeps RLS in force; the explicit
-- is_admin() check turns a member's call into an error instead of a quietly
-- filtered (own rows only) answer.

-- Daily gate traffic for the last p_days days (today included), in the gym's
-- timezone. Days without scans are returned as zeros so charts have no gaps.
-- The range scan uses access_logs_created_at_idx.
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
  IF NOT (SELECT public.is_admin()) THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = 'insufficient_privilege';
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
REVOKE EXECUTE ON FUNCTION public.admin_access_daily(integer) FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.admin_access_daily(integer) TO authenticated;
--> statement-breakpoint

-- Live subscriptions (those that grant gate access) per Stripe price, for the
-- active-subscriber KPI and the monthly revenue estimate. Prices live in
-- Stripe, so the app multiplies these counts by each price's amount.
-- Uses subscriptions_status_period_end_idx.
CREATE OR REPLACE FUNCTION public.admin_live_plan_counts()
RETURNS TABLE (plan_id text, active bigint, past_due bigint, ending bigint)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT (SELECT public.is_admin()) THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    s.plan_id,
    count(*) FILTER (WHERE s.status = 'active'),
    count(*) FILTER (WHERE s.status = 'past_due'),
    -- Still live, but will not renew.
    count(*) FILTER (WHERE s.cancel_at_period_end)
  FROM public.subscriptions s
  WHERE s.status IN ('active', 'past_due')
  GROUP BY s.plan_id
  ORDER BY s.plan_id;
END;
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.admin_live_plan_counts() FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.admin_live_plan_counts() TO authenticated;
