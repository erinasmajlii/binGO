-- Add tables to Supabase Realtime (safe to re-run)

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bins;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leaderboard_scores;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;
