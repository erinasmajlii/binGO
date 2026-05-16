-- Bins table for global map markers (safe to re-run in SQL Editor)

CREATE TABLE IF NOT EXISTS bins (
  id TEXT PRIMARY KEY,
  latitude FLOAT8 NOT NULL,
  longitude FLOAT8 NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('current', 'manual')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bins_created_at ON bins (created_at DESC);

ALTER TABLE bins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on bins" ON bins;
CREATE POLICY "Allow public read access on bins" ON bins
  FOR SELECT
  TO public
  USING (TRUE);

DROP POLICY IF EXISTS "Allow public insert on bins" ON bins;
CREATE POLICY "Allow public insert on bins" ON bins
  FOR INSERT
  TO public
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Allow public delete on bins" ON bins;
CREATE POLICY "Allow public delete on bins" ON bins
  FOR DELETE
  TO public
  USING (TRUE);

DROP POLICY IF EXISTS "Allow public update on bins" ON bins;
CREATE POLICY "Allow public update on bins" ON bins
  FOR UPDATE
  TO public
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE OR REPLACE FUNCTION update_bins_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_bins_updated_at ON bins;
CREATE TRIGGER trigger_update_bins_updated_at
  BEFORE UPDATE ON bins
  FOR EACH ROW
  EXECUTE FUNCTION update_bins_updated_at();

INSERT INTO bins (id, latitude, longitude, source) VALUES
  ('bin-demo-1', 41.3275, 19.8187, 'current'),
  ('bin-demo-2', 41.3278, 19.8190, 'manual'),
  ('bin-demo-3', 41.3272, 19.8184, 'current')
ON CONFLICT (id) DO NOTHING;
