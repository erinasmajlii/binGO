-- Adds a "clean" report type: someone confirming a Full/Damaged bin has
-- been emptied/fixed. Unlike 'full'/'damaged', a 'clean' report does NOT
-- set bins.current_status to a literal 'clean' value — it clears it back
-- to NULL (the bin's normal/green state), and marks any still-open
-- full/damaged reports for that bin as resolved (the exact use the
-- resolved/resolved_at columns from 0007_bin_reports.sql were added for).
-- Safe to re-run.

ALTER TABLE public.bin_reports DROP CONSTRAINT IF EXISTS bin_reports_status_check;
ALTER TABLE public.bin_reports ADD CONSTRAINT bin_reports_status_check
  CHECK (status IN ('full', 'damaged', 'clean'));

CREATE OR REPLACE FUNCTION public.apply_bin_report_to_bin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'clean' THEN
    UPDATE public.bins
    SET current_status = NULL,
        status_updated_at = NEW.created_at,
        status_reported_by = NEW.reported_by
    WHERE id = NEW.bin_id;

    -- Close out whatever was open before this clean report — this is the
    -- "was this issue addressed" signal a future municipality/Pastrimi
    -- dashboard needs.
    UPDATE public.bin_reports
    SET resolved = TRUE,
        resolved_at = NEW.created_at
    WHERE bin_id = NEW.bin_id
      AND resolved = FALSE
      AND status IN ('full', 'damaged')
      AND id != NEW.id;
  ELSE
    UPDATE public.bins
    SET current_status = NEW.status,
        status_updated_at = NEW.created_at,
        status_reported_by = NEW.reported_by
    WHERE id = NEW.bin_id;
  END IF;

  RETURN NEW;
END;
$$;
