-- Persist scan/capture history server-side so Profile stats (total photos,
-- daily rate, streak, waste breakdown, recent captures) survive refresh,
-- app restart, and logout/login — not just AsyncStorage on one device.
-- Safe to re-run.
--
-- Design:
--  - One row per capture, written at the same time as the existing
--    AsyncStorage record (src/lib/trashStats.ts's saveCaptureRecord).
--    AsyncStorage remains as an offline-write buffer and a guest-mode
--    fallback (guests have no auth.uid() to attach rows to); the DB is the
--    source of truth for any signed-in user.
--  - Unlike bins/bin_reports, this is private per-user data, not a shared
--    public map — RLS restricts SELECT to the caller's own rows.
--  - `photo_uri` is whatever local device URI the camera produced. It is
--    NOT uploaded to Supabase Storage (no such upload exists in this app),
--    so it will not resolve on a different device or after the OS clears
--    its cache — this only helps the same device keep showing its recent
--    thumbnails across logout/login and app restarts.

CREATE TABLE IF NOT EXISTS public.capture_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('cardboard', 'glass', 'metal', 'paper', 'plastic', 'trash')),
  confidence NUMERIC NOT NULL DEFAULT 0.75,
  points INTEGER NOT NULL DEFAULT 100,
  photo_uri TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capture_records_user_created ON public.capture_records (user_id, created_at DESC);

ALTER TABLE public.capture_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own capture_records" ON public.capture_records;
CREATE POLICY "Users can read their own capture_records" ON public.capture_records
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own capture_records" ON public.capture_records;
CREATE POLICY "Users can insert their own capture_records" ON public.capture_records
  FOR INSERT
  TO authenticated
  -- user_id is forced to auth.uid() server-side by the trigger below;
  -- nothing client-supplied here needs checking.
  WITH CHECK (TRUE);

-- No UPDATE/DELETE policy — capture history is append-only, same as
-- bin_reports; nothing in the app edits or removes a past capture today.

-- Server-assigned ownership: the client can never spoof another user's id.
CREATE OR REPLACE FUNCTION public.set_capture_record_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.user_id := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_capture_record_user_id ON public.capture_records;
CREATE TRIGGER trigger_set_capture_record_user_id
  BEFORE INSERT ON public.capture_records
  FOR EACH ROW
  EXECUTE FUNCTION public.set_capture_record_user_id();
