-- RLS + signup trigger smoke test. Runs in a transaction and ROLLS BACK, so it
-- leaves no data behind. Paste into the Supabase SQL Editor or run
-- `node scripts/run-sql.mjs scripts/test-rls.sql`. Any failure raises an exception.
BEGIN;

-- Fixtures (as postgres): two members and one admin, created through auth.users
-- so the signup trigger is exercised.
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'alice@test.local', 'authenticated', 'authenticated',
   '{"first_name":"Alice","last_name":"A","phone":"+905550000001","role":"admin"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@test.local', 'authenticated', 'authenticated',
   '{"first_name":"Bob","last_name":"B"}'),
  ('00000000-0000-0000-0000-00000000000c', 'admin@test.local', 'authenticated', 'authenticated',
   '{"first_name":"Ada","last_name":"Admin"}');

DO $$
BEGIN
  IF (SELECT count(*) FROM public.users WHERE id IN (
        '00000000-0000-0000-0000-00000000000a',
        '00000000-0000-0000-0000-00000000000b',
        '00000000-0000-0000-0000-00000000000c')) <> 3 THEN
    RAISE EXCEPTION 'trigger: profile rows were not created';
  END IF;
  IF (SELECT first_name || '|' || phone || '|' || role FROM public.users
      WHERE id = '00000000-0000-0000-0000-00000000000a') <> 'Alice|+905550000001|member' THEN
    RAISE EXCEPTION 'trigger: metadata mapping wrong, or role taken from metadata';
  END IF;
END $$;

UPDATE public.users SET role = 'admin' WHERE id = '00000000-0000-0000-0000-00000000000c';

INSERT INTO public.subscriptions (user_id, stripe_subscription_id, plan_id, current_period_start, current_period_end) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'sub_test_a', 'plan_basic', now(), now() + interval '1 month'),
  ('00000000-0000-0000-0000-00000000000b', 'sub_test_b', 'plan_basic', now(), now() + interval '1 month');

INSERT INTO public.access_logs (user_id, granted, reason) VALUES
  ('00000000-0000-0000-0000-00000000000a', true, null),
  ('00000000-0000-0000-0000-00000000000b', false, 'no_subscription');

-- Simulate a future over-broad grant: the role guard trigger must still refuse.
-- (Rolled back with everything else.)
GRANT UPDATE (role) ON public.users TO authenticated;

-- ---- As Alice (member) ----
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

DO $$
DECLARE n int;
BEGIN
  IF (SELECT count(*) FROM public.users) <> 1 THEN
    RAISE EXCEPTION 'member sees other users';
  END IF;
  IF (SELECT count(*) FROM public.subscriptions) <> 1 THEN
    RAISE EXCEPTION 'member sees other subscriptions';
  END IF;

  UPDATE public.users SET first_name = 'Alicia' WHERE id = '00000000-0000-0000-0000-00000000000a';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'member cannot update own profile'; END IF;

  UPDATE public.users SET first_name = 'hacked' WHERE id = '00000000-0000-0000-0000-00000000000b';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'member updated another user'; END IF;

  BEGIN
    UPDATE public.users SET role = 'admin' WHERE id = '00000000-0000-0000-0000-00000000000a';
    RAISE EXCEPTION 'member escalated own role (role guard trigger missing?)';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  IF (SELECT public.is_admin()) THEN
    RAISE EXCEPTION 'is_admin() true for a member';
  END IF;
  IF (SELECT count(*) FROM public.access_logs) <> 1 THEN
    RAISE EXCEPTION 'member sees other access logs';
  END IF;

  BEGIN
    PERFORM * FROM public.admin_access_daily(7);
    RAISE EXCEPTION 'member can call admin_access_daily';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM * FROM public.admin_live_plan_counts();
    RAISE EXCEPTION 'member can call admin_live_plan_counts';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    UPDATE public.subscriptions SET status = 'active', current_period_end = now() + interval '10 years';
    RAISE EXCEPTION 'member modified a subscription';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    PERFORM 1 FROM public.webhook_events;
    RAISE EXCEPTION 'member can read webhook_events';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- ---- As admin ----
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);

DO $$
BEGIN
  IF (SELECT count(*) FROM public.users WHERE id::text LIKE '00000000-0000-0000-0000-00000000000_') <> 3 THEN
    RAISE EXCEPTION 'admin cannot see all users';
  END IF;
  IF (SELECT count(*) FROM public.subscriptions WHERE user_id::text LIKE '00000000-0000-0000-0000-00000000000_') <> 2 THEN
    RAISE EXCEPTION 'admin cannot see all subscriptions';
  END IF;
  IF NOT (SELECT public.is_admin()) THEN
    RAISE EXCEPTION 'is_admin() false for an admin';
  END IF;
  IF (SELECT count(*) FROM public.access_logs WHERE user_id::text LIKE '00000000-0000-0000-0000-00000000000_') <> 2 THEN
    RAISE EXCEPTION 'admin cannot see all access logs';
  END IF;

  -- Fixture logs were written "now", so they land on the last (today's) row;
  -- real data may add to the counts, hence >=.
  IF (SELECT count(*) FROM public.admin_access_daily(7)) <> 7 THEN
    RAISE EXCEPTION 'admin_access_daily must return one row per day';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_access_daily(7) d
    WHERE d.day = (now() AT TIME ZONE 'Europe/Istanbul')::date AND d.granted >= 1 AND d.denied >= 1
  ) THEN
    RAISE EXCEPTION 'admin_access_daily missed today''s scans';
  END IF;
  IF (SELECT active FROM public.admin_live_plan_counts() WHERE plan_id = 'plan_basic') <> 2 THEN
    RAISE EXCEPTION 'admin_live_plan_counts wrong for plan_basic';
  END IF;
END $$;

-- ---- As anon ----
RESET ROLE;
SET LOCAL ROLE anon;

DO $$
BEGIN
  BEGIN
    PERFORM 1 FROM public.users;
    RAISE EXCEPTION 'anon can read users';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

RESET ROLE;
SELECT 'ALL RLS CHECKS PASSED' AS result;
ROLLBACK;
