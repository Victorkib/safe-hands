-- Auto-Release Funds Function and Schedule
-- This script sets up pg_cron to automatically release funds after 3 days
-- when buyer confirms delivery and no dispute is raised

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Function to send 24-hour warning notifications
CREATE OR REPLACE FUNCTION auto_release_warning_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    txn RECORD;
    warning_count INTEGER := 0;
BEGIN
    -- Find transactions where auto-release is within 24-25 hours (only send once)
    FOR txn IN
        SELECT t.id, t.buyer_id, t.seller_id, t.amount
        FROM transactions t
        WHERE t.status = 'delivered'
          AND t.is_disputed = false
          AND t.auto_release_date BETWEEN (CURRENT_TIMESTAMP + INTERVAL '23 hours') 
                                       AND (CURRENT_TIMESTAMP + INTERVAL '25 hours')
          AND NOT EXISTS (
              SELECT 1 FROM notifications n 
              WHERE n.related_transaction_id = t.id 
              AND n.type = 'auto_release_warning'
          )
    LOOP
        -- Notify buyer
        INSERT INTO notifications (user_id, title, message, type, related_transaction_id)
        VALUES (
            txn.buyer_id,
            'Auto-Release in 24 Hours',
            format('Funds of KES %s will be automatically released to the seller in 24 hours. Raise a dispute now if there are issues.', txn.amount),
            'auto_release_warning',
            txn.id
        );
        
        -- Notify seller
        INSERT INTO notifications (user_id, title, message, type, related_transaction_id)
        VALUES (
            txn.seller_id,
            'Funds Releasing Soon',
            format('Funds of KES %s will be auto-released to you in 24 hours if no dispute is raised.', txn.amount),
            'auto_release_warning',
            txn.id
        );
        
        warning_count := warning_count + 1;
    END LOOP;

    -- Log if any warnings were sent
    IF warning_count > 0 THEN
        INSERT INTO audit_logs (action, resource_type, details)
        VALUES (
            'auto_release_warning_sent',
            'notification',
            jsonb_build_object(
                'timestamp', CURRENT_TIMESTAMP,
                'warnings_sent', warning_count
            )
        );
    END IF;
END;
$$;

-- Function to auto-release funds
CREATE OR REPLACE FUNCTION auto_release_funds()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    txn RECORD;
    released_count INTEGER := 0;
BEGIN
    -- Process each transaction individually to create proper notifications
    FOR txn IN
        SELECT t.id, t.buyer_id, t.seller_id, t.amount, t.status
        FROM transactions t
        WHERE t.status = 'delivered'
          AND t.auto_release_date <= CURRENT_TIMESTAMP
          AND t.is_disputed = false
          AND NOT EXISTS (
              SELECT 1 FROM disputes d 
              WHERE d.transaction_id = t.id 
              AND d.status IN ('open', 'in_review', 'awaiting_response')
          )
    LOOP
        -- Update transaction
        UPDATE transactions
        SET 
            status = 'released',
            completed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = txn.id;

        -- Log to transaction history
        INSERT INTO transaction_history (transaction_id, old_status, new_status, changed_by, reason)
        VALUES (
            txn.id,
            txn.status,
            'released',
            NULL,
            'Automatic release after dispute window expired'
        );

        -- Notify buyer
        INSERT INTO notifications (user_id, title, message, type, related_transaction_id)
        VALUES (
            txn.buyer_id,
            'Funds Auto-Released',
            format('Funds of KES %s have been automatically released to the seller.', txn.amount),
            'auto_release_executed',
            txn.id
        );

        -- Notify seller
        INSERT INTO notifications (user_id, title, message, type, related_transaction_id)
        VALUES (
            txn.seller_id,
            'Funds Auto-Released',
            format('Funds of KES %s have been automatically released to you.', txn.amount),
            'auto_release_executed',
            txn.id
        );

        released_count := released_count + 1;
    END LOOP;

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

-- Schedule both jobs to run every hour
SELECT cron.unschedule('auto-release-funds') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'auto-release-funds'
);
SELECT cron.unschedule('auto-release-warnings') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'auto-release-warnings'
);

-- Schedule warning notifications (run first)
SELECT cron.schedule(
    'auto-release-warnings',
    '0 * * * *',  -- Every hour at minute 0
    'SELECT auto_release_warning_notifications();'
);

-- Schedule auto-release (run after warnings)
SELECT cron.schedule(
    'auto-release-funds',
    '5 * * * *',  -- Every hour at minute 5
    'SELECT auto_release_funds();'
);

-- Verify schedules
SELECT * FROM cron.job WHERE jobname IN ('auto-release-funds', 'auto-release-warnings');

-- Note: To remove schedules later, run:
-- SELECT cron.unschedule('auto-release-funds');
-- SELECT cron.unschedule('auto-release-warnings');

-- To check job run history:
-- SELECT * FROM cron.job_run_details WHERE jobname IN ('auto-release-funds', 'auto-release-warnings') ORDER BY start_time DESC LIMIT 10;
