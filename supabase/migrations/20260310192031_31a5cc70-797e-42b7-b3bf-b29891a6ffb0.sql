
-- 1. Track trial usage by email (prevents re-signup abuse)
CREATE TABLE public.trial_usage (
  email text PRIMARY KEY,
  first_signup_at timestamp with time zone NOT NULL DEFAULT now()
);

-- No RLS needed - only accessed by edge functions with service role key
ALTER TABLE public.trial_usage ENABLE ROW LEVEL SECURITY;

-- 2. Track active subscriptions (updated by check-subscription edge function)
CREATE TABLE public.subscriptions (
  user_id uuid PRIMARY KEY,
  active boolean NOT NULL DEFAULT false,
  is_trialing boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscription status
CREATE POLICY "Users can view own subscription"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Update handle_new_user to record trial usage
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  
  -- Record trial usage (ignore if email already used trial)
  IF NEW.email IS NOT NULL THEN
    INSERT INTO public.trial_usage (email, first_signup_at)
    VALUES (LOWER(NEW.email), now())
    ON CONFLICT (email) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Helper function to check subscription (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id AND active = true
  )
$$;

-- 5. Drop old permissive policies on memories and add subscription-gated ones
DROP POLICY IF EXISTS "Users can create their own memories" ON public.memories;
DROP POLICY IF EXISTS "Users can view their own memories" ON public.memories;
DROP POLICY IF EXISTS "Users can update their own memories" ON public.memories;
DROP POLICY IF EXISTS "Users can delete their own memories" ON public.memories;

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

-- 6. Backfill trial_usage for existing users
INSERT INTO public.trial_usage (email, first_signup_at)
SELECT LOWER(email), created_at FROM auth.users WHERE email IS NOT NULL
ON CONFLICT (email) DO NOTHING;
