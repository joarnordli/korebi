
-- 1. Fix memories policies: drop RESTRICTIVE ones, recreate as PERMISSIVE
DROP POLICY IF EXISTS "Subscribed users can insert memories" ON public.memories;
DROP POLICY IF EXISTS "Subscribed users can view memories" ON public.memories;
DROP POLICY IF EXISTS "Subscribed users can update memories" ON public.memories;
DROP POLICY IF EXISTS "Subscribed users can delete memories" ON public.memories;

CREATE POLICY "Subscribed users can insert memories"
  ON public.memories FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND public.has_active_subscription(auth.uid())
  );

CREATE POLICY "Subscribed users can view memories"
  ON public.memories FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id AND public.has_active_subscription(auth.uid())
  );

CREATE POLICY "Subscribed users can update memories"
  ON public.memories FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id AND public.has_active_subscription(auth.uid())
  );

CREATE POLICY "Subscribed users can delete memories"
  ON public.memories FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id AND public.has_active_subscription(auth.uid())
  );

-- 2. Add explicit deny-all policy on trial_usage (service role bypasses RLS)
CREATE POLICY "Deny all client access to trial_usage"
  ON public.trial_usage FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);
