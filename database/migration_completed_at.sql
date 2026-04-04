-- Add completed_at column to cases table
ALTER TABLE cases ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT NULL;

-- Backfill completed_at for already-finished cases using created_at as approximation
UPDATE cases 
SET completed_at = created_at 
WHERE status IN ('done', 'delivered', 'cancelled', 'error') 
  AND completed_at IS NULL;
