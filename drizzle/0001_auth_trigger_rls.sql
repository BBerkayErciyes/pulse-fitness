-- Custom SQL migration file, put your code below! --
-- Phase 2: auth.users -> public.users profile trigger, updated_at triggers, RLS.

-- ---------------------------------------------------------------------------
-- 1. Profile row on signup
-- ---------------------------------------------------------------------------
-- Role is always 'member': raw_user_meta_data is client-controlled at signup,
-- so it must never decide privileges.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, first_name, last_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
    COALESCE(NEW.phone, NEW.raw_user_meta_data ->> 'phone')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
--> statement-breakpoint
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2. updated_at maintained in the database (Drizzle's $onUpdate only covers
--    writes made through Drizzle, not Supabase client / PostgREST writes)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 3. Admin check
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so it reads public.users without re-entering the users
-- SELECT policy (which would recurse).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (SELECT auth.uid()) AND role = 'admin'
  );
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 4. Table privileges (defense in depth on top of RLS)
-- ---------------------------------------------------------------------------
-- Supabase grants ALL on public tables to anon/authenticated by default.
REVOKE ALL ON public.users, public.subscriptions, public.webhook_events FROM anon, authenticated;
--> statement-breakpoint
GRANT SELECT ON public.users, public.subscriptions TO authenticated;
--> statement-breakpoint
-- Column-level grant: members can edit their profile but never their role.
GRANT UPDATE (first_name, last_name, phone) ON public.users TO authenticated;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- No policies: only service_role / the postgres owner (server, webhooks) can touch it.
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY users_select_own_or_admin ON public.users
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR (SELECT public.is_admin()));
--> statement-breakpoint
CREATE POLICY users_update_own ON public.users
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));
--> statement-breakpoint

-- Subscriptions are read-only for clients: status/period changes come only from
-- verified payment webhooks via the server (service_role), through the state machine.
CREATE POLICY subscriptions_select_own_or_admin ON public.subscriptions
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));
