-- Predictions table for storing LSTM flood predictions
CREATE TABLE IF NOT EXISTS predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id TEXT NOT NULL DEFAULT 'MANGGARAI_01',
    prediction_cm FLOAT NOT NULL,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('AMAN', 'WASPADA', 'BAHAYA', 'CRITICAL', 'UNKNOWN')),
    rainfall_bogor FLOAT DEFAULT 0,
    rainfall_jakarta FLOAT DEFAULT 0,
    water_level_cm FLOAT DEFAULT 0,
    alert_message TEXT,
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'auto', 'scenario')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying latest predictions
CREATE INDEX idx_predictions_created_at ON predictions (created_at DESC);
CREATE INDEX idx_predictions_region ON predictions (region_id);

-- Detections table for YOLO visual flood detection results
CREATE TABLE IF NOT EXISTS detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_name TEXT NOT NULL DEFAULT 'upload',
    is_flooded BOOLEAN,
    flood_probability FLOAT,
    objects_detected JSONB DEFAULT '[]',
    snapshot_url TEXT,
    location_lat FLOAT,
    location_lon FLOAT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_detections_created_at ON detections (created_at DESC);

-- Enable RLS
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE detections ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for dashboard/map)
CREATE POLICY "Allow public read predictions" ON predictions FOR SELECT USING (true);
CREATE POLICY "Allow public read detections" ON detections FOR SELECT USING (true);

-- Allow insert from service role (API routes)
CREATE POLICY "Allow service insert predictions" ON predictions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service insert detections" ON detections FOR INSERT WITH CHECK (true);
