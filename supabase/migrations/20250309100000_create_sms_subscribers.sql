-- SMS Alert System Tables
-- Supports rural community flood warning via SMS

-- Table: sms_subscribers
-- Stores phone numbers registered for flood alerts
CREATE TABLE IF NOT EXISTS sms_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'Warga',
    region_id TEXT NOT NULL DEFAULT 'MANGGARAI_01',
    language TEXT NOT NULL DEFAULT 'id' CHECK (language IN ('id', 'en')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(phone_number, region_id)
);

-- Table: sms_logs
-- Audit trail for every SMS sent (accountability for hackathon)
CREATE TABLE IF NOT EXISTS sms_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_id UUID REFERENCES sms_subscribers(id) ON DELETE SET NULL,
    phone_number TEXT NOT NULL,
    message TEXT NOT NULL,
    alert_level TEXT NOT NULL,
    region_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
    twilio_sid TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_sms_subscribers_region ON sms_subscribers(region_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sms_subscribers_phone ON sms_subscribers(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created ON sms_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_logs_region ON sms_logs(region_id);

-- Row Level Security
ALTER TABLE sms_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

-- Public can subscribe (insert)
CREATE POLICY "Anyone can subscribe" ON sms_subscribers
    FOR INSERT TO anon WITH CHECK (true);

-- Public can check their own subscription by phone
CREATE POLICY "Anyone can view own subscription" ON sms_subscribers
    FOR SELECT TO anon USING (true);

-- Service role can do everything
CREATE POLICY "Service can manage subscribers" ON sms_subscribers
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Only service role can insert/read logs
CREATE POLICY "Service can manage logs" ON sms_logs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Public can view logs (for transparency)
CREATE POLICY "Public can view logs" ON sms_logs
    FOR SELECT TO anon USING (true);
