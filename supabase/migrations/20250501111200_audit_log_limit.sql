-- Create a function to delete old audit logs, keeping only the most recent 50
CREATE OR REPLACE FUNCTION delete_old_audit_logs()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete old audit logs, keeping only the most recent 50
  DELETE FROM audit_logs
  WHERE id IN (
    SELECT id
    FROM audit_logs
    ORDER BY created_at DESC
    OFFSET 50
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it already exists
DROP TRIGGER IF EXISTS limit_audit_logs_trigger ON audit_logs;

-- Create a trigger to run the function after each insert
CREATE TRIGGER limit_audit_logs_trigger
AFTER INSERT ON audit_logs
FOR EACH STATEMENT
EXECUTE FUNCTION delete_old_audit_logs();

-- Clean up existing audit logs to keep only the most recent 50
DELETE FROM audit_logs
WHERE id IN (
  SELECT id
  FROM audit_logs
  ORDER BY created_at DESC
  OFFSET 50
);

-- Add a comment to the audit_logs table
COMMENT ON TABLE audit_logs IS 'Stores the most recent 50 audit log entries to save space';
