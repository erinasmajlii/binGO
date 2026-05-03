-- Create the bins table for storing global bin markers
CREATE TABLE IF NOT EXISTS bins (
  id TEXT PRIMARY KEY,
  latitude FLOAT8 NOT NULL,
  longitude FLOAT8 NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('current', 'manual')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create an index on created_at for efficient queries
CREATE INDEX IF NOT EXISTS idx_bins_created_at ON bins(created_at DESC);

-- Create a geospatial index for location-based queries (optional, for future features)
CREATE INDEX IF NOT EXISTS idx_bins_location ON bins USING GIST(
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
);

-- Enable Row Level Security
ALTER TABLE bins ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users (and authenticated users) to read all bins
CREATE POLICY "Allow public read access on bins" ON bins
  FOR SELECT
  TO public
  USING (TRUE);

-- Allow anonymous users to insert bins
CREATE POLICY "Allow public insert on bins" ON bins
  FOR INSERT
  TO public
  WITH CHECK (TRUE);

-- Allow anonymous users to delete bins
CREATE POLICY "Allow public delete on bins" ON bins
  FOR DELETE
  TO public
  USING (TRUE);

-- Allow anonymous users to update bins
CREATE POLICY "Allow public update on bins" ON bins
  FOR UPDATE
  TO public
  USING (TRUE);

-- Create a trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_bins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_bins_updated_at ON bins;
CREATE TRIGGER trigger_update_bins_updated_at
  BEFORE UPDATE ON bins
  FOR EACH ROW
  EXECUTE FUNCTION update_bins_updated_at();

-- Insert sample bins for testing (optional)
INSERT INTO bins (id, latitude, longitude, source) VALUES
  ('bin-demo-1', 41.3275, 19.8187, 'current'),
  ('bin-demo-2', 41.3278, 19.8190, 'manual'),
  ('bin-demo-3', 41.3272, 19.8184, 'current')
ON CONFLICT (id) DO NOTHING;
