
-- 1. Consent columns on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS consent_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_age_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_tos_version text;

-- Grandfather existing users
UPDATE public.profiles
SET consent_accepted_at = COALESCE(consent_accepted_at, created_at),
    consent_age_confirmed = true,
    consent_tos_version = COALESCE(consent_tos_version, '2026-06-09-grandfathered')
WHERE consent_accepted_at IS NULL;

-- 2. Abuse reports table
CREATE TABLE IF NOT EXISTS public.abuse_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_id uuid REFERENCES public.memories(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (category IN ('self_delete','dmca','other')),
  message text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.abuse_reports TO authenticated;
GRANT ALL ON public.abuse_reports TO service_role;

ALTER TABLE public.abuse_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own abuse reports"
  ON public.abuse_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_user_id);

CREATE POLICY "Users can view their own abuse reports"
  ON public.abuse_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can update abuse reports"
  ON public.abuse_reports FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER update_abuse_reports_updated_at
  BEFORE UPDATE ON public.abuse_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for admin queue
CREATE INDEX IF NOT EXISTS abuse_reports_status_created_idx
  ON public.abuse_reports(status, created_at DESC);
