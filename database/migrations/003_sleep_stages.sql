-- Migration: Add sleep stage columns
-- Adds core_sleep_hours and awake_sleep_hours for detailed sleep breakdown

-- Add missing sleep stage columns
ALTER TABLE health_metrics
ADD COLUMN IF NOT EXISTS core_sleep_hours DECIMAL(4,2),
ADD COLUMN IF NOT EXISTS awake_sleep_hours DECIMAL(4,2);

-- Add comment for clarity
COMMENT ON COLUMN health_metrics.deep_sleep_hours IS 'Deep/slow wave sleep hours - most restorative';
COMMENT ON COLUMN health_metrics.rem_sleep_hours IS 'REM sleep hours - memory consolidation, dreams';
COMMENT ON COLUMN health_metrics.core_sleep_hours IS 'Core/light sleep hours - basic sleep stage';
COMMENT ON COLUMN health_metrics.awake_sleep_hours IS 'Awake time during sleep period';
