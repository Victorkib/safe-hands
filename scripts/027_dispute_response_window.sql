-- Dispute response window: accused must be heard before bulk suggestions apply.
-- Run in Supabase SQL Editor after 026 (or standalone — idempotent).

ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS response_due_at TIMESTAMPTZ;

ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS accused_responded_at TIMESTAMPTZ;

ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS accused_response_text TEXT;

ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS no_response_ruling BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_disputes_awaiting_response
  ON public.disputes (status, response_due_at)
  WHERE status IN ('awaiting_response', 'in_review', 'open');

COMMENT ON COLUMN public.disputes.response_due_at IS
  'Deadline for raised_against party to submit a defense before no-response ruling';
COMMENT ON COLUMN public.disputes.accused_responded_at IS
  'When raised_against first submitted defense (text and/or evidence)';
COMMENT ON COLUMN public.disputes.accused_response_text IS
  'Written defense from raised_against party';
COMMENT ON COLUMN public.disputes.no_response_ruling IS
  'Admin confirmed accused did not respond — verdict favors accuser';

-- Open disputes without a window get a default 72h from now (one-time backfill).
UPDATE public.disputes d
SET
  response_due_at = COALESCE(
    d.response_due_at,
    d.created_at + INTERVAL '72 hours'
  ),
  status = CASE
    WHEN d.status = 'open'
      AND d.accused_responded_at IS NULL
      AND d.resolved_at IS NULL
    THEN 'awaiting_response'
    ELSE d.status
  END,
  updated_at = now()
WHERE d.status IN ('open', 'awaiting_response', 'in_review')
  AND d.resolved_at IS NULL
  AND d.response_due_at IS NULL;
