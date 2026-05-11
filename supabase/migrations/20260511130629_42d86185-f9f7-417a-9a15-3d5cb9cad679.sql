
-- 1. Replace memories SELECT policy: owner-only, no subscription check
DROP POLICY IF EXISTS "Subscribed users can view memories" ON public.memories;

CREATE POLICY "Users can view their own memories"
ON public.memories
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 2. Add unique constraint for push_subscriptions upsert
ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_user_endpoint_unique UNIQUE (user_id, endpoint);

-- 3. Track last reminder send to avoid duplicates / missed days
ALTER TABLE public.push_subscriptions
  ADD COLUMN last_sent_date date;
