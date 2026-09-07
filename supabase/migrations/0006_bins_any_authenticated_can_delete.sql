-- Relax bins DELETE/UPDATE from "owner only" to "any authenticated user."
-- Safe to re-run.
--
-- Product decision (see ROADMAP.md "User-Reported Issues" item A): the
-- owner-only restriction from the original S2 security fix was stricter
-- than wanted — any signed-in user should be able to clean up/remove any
-- bin on the shared map, not just ones they personally added. This keeps
-- the actual fix from S2 (anonymous/unauthenticated users still cannot
-- write at all) while dropping the "must be the original owner" part.
--
-- INSERT stays as-is: created_by is still recorded (via the trigger in
-- 0001_schema.sql) for provenance/auditing, it just no longer gates who
-- can delete a row.

DROP POLICY IF EXISTS "Owners can delete their own bins" ON public.bins;
CREATE POLICY "Any authenticated user can delete bins" ON public.bins
  FOR DELETE
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Owners can update their own bins" ON public.bins;
CREATE POLICY "Any authenticated user can update bins" ON public.bins
  FOR UPDATE
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);
