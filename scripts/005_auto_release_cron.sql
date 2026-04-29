-- Auto-Release Funds Function and Schedule
-- This script sets up pg_cron to automatically release funds after 3 days
-- when buyer confirms delivery and no dispute is raised

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Function to auto-release funds
CREATE OR REPLACE FUNCTION auto_release_funds()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    released_count INTEGER;
BEGIN
    -- Update transactions where:
    -- - Status is 'delivered' (buyer confirmed delivery or seller shipped)
    -- - Auto-release date has passed
    -- - No dispute is raised
    UPDATE transactions
    SET 
        status = 'released',
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE 
        status = 'delivered'
        AND auto_release_date <= CURRENT_TIMESTAMP
        AND is_disputed = false
        AND id NOT IN (
            SELECT transaction_id FROM disputes WHERE status IN ('open', 'in_review', 'awaiting_response')
        );

    GET DIAGNOSTICS released_count = ROW_COUNT;

    -- Log the auto-release action
    IF released_count > 0 THEN
        INSERT INTO audit_logs (action, resource_type, details)
        VALUES (
            'auto_release_funds', 
            'transaction', 
            jsonb_build_object(
                'timestamp', CURRENT_TIMESTAMP,
                'auto_released_count', released_count
            )
        );
    END IF;
END;
$$;

-- Schedule the job to run every hour
-- Format: cron.schedule(job_name, schedule, command)
SELECT cron.schedule(
    'auto-release-funds',
    '0 * * * *',  -- Every hour at minute 0
    'SELECT auto_release_funds();'
);

-- Verify the schedule
SELECT * FROM cron.job WHERE jobname = 'auto-release-funds';

-- Note: To remove the schedule later, run:
-- SELECT cron.unschedule('auto-release-funds');

-- To check job run history:
-- SELECT * FROM cron.job_run_details WHERE jobname = 'auto-release-funds' ORDER BY start_time DESC LIMIT 10;
