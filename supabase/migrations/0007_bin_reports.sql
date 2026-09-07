-- Bin condition reporting (Full / Damaged) + a denormalized current-status
-- read path on `bins` itself. Safe to re-run.
--
-- Design:
--  - `bin_reports` is the source of truth / audit history — every report
--    a user submits is a new row here. This is what a future
--    municipality/"Pastrimi" dashboard queries: how many reports, when,
--    which are resolved, etc. Nothing here is thrown away or overwritten.
--  - `bins.current_status`/`status_updated_at`/`status_reported_by` are a
--    denormalized read path: whatever the LATEST report says, so the map
--    can show every bin's status from the single existing `bins` query
--    (and get it via the EXISTING realtime subscription on `bins` — no new
--    realtime channel needed) instead of joining against report history on
--    every map load. Kept in sync by one trigger, so there's exactly one
--    place this can drift, not duplicated application logic.
--  - Repeated reports: always insert a new row (so the count is accurate
--    for the dashboard), but current_status is simply "whatever the most
--    recent report says" — reporting the same status again is a no-op for
--    the map, reporting a different status flips it.

ALTER TABLE public.bins ADD COLUMN IF NOT EXISTS current_status TEXT
  CHECK (current_status IN ('full', 'damaged'));
ALTER TABLE public.bins ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;
ALTER TABLE public.bins ADD COLUMN IF NOT EXISTS status_reported_by UUID
  REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.bin_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bin_id TEXT NOT NULL REFERENCES public.bins(id) ON DELETE CASCADE,
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('full', 'damaged')),
  -- Not surfaced in the app UI yet (no municipality dashboard in this
  -- phase), but the data model needs to support it going in so that
  -- dashboard can be built later without another migration.
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bin_reports_bin_id ON public.bin_reports (bin_id);
CREATE INDEX IF NOT EXISTS idx_bin_reports_created_at ON public.bin_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bin_reports_unresolved ON public.bin_reports (bin_id)
  WHERE resolved = FALSE;

ALTER TABLE public.bin_reports ENABLE ROW LEVEL SECURITY;

-- Reports are as public as the bins themselves (the whole map, including
-- who added/reported what, is already publicly readable — see 0002).
DROP POLICY IF EXISTS "Allow public read access on bin_reports" ON public.bin_reports;
CREATE POLICY "Allow public read access on bin_reports" ON public.bin_reports
  FOR SELECT
  TO public
  USING (TRUE);

DROP POLICY IF EXISTS "Authenticated users can insert bin_reports" ON public.bin_reports;
CREATE POLICY "Authenticated users can insert bin_reports" ON public.bin_reports
  FOR INSERT
  TO authenticated
  -- reported_by is forced to auth.uid() server-side by the trigger below;
  -- nothing client-supplied here needs checking.
  WITH CHECK (TRUE);

-- No UPDATE/DELETE policy for any role yet — resolving a report is a
-- municipality-dashboard-phase feature, not exposed to the app today.

-- Server-assigned reporter identity — the client can never spoof this,
-- same pattern as bins.set_bin_created_by.
CREATE OR REPLACE FUNCTION public.set_bin_report_reported_by()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.reported_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_bin_report_reported_by ON public.bin_reports;
CREATE TRIGGER trigger_set_bin_report_reported_by
  BEFORE INSERT ON public.bin_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_bin_report_reported_by();

-- Keeps bins.current_status in sync with the latest report — the one
-- place this denormalization is written.
CREATE OR REPLACE FUNCTION public.apply_bin_report_to_bin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.bins
  SET current_status = NEW.status,
      status_updated_at = NEW.created_at,
      status_reported_by = NEW.reported_by
  WHERE id = NEW.bin_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_apply_bin_report_to_bin ON public.bin_reports;
CREATE TRIGGER trigger_apply_bin_report_to_bin
  AFTER INSERT ON public.bin_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_bin_report_to_bin();

-- Include bin_reports in the same realtime publication as bins/leaderboard.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bin_reports;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;
