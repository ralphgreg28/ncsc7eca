-- Update the function to delete old audit logs, keeping only the most recent 500 (increased from 50)
CREATE OR REPLACE FUNCTION delete_old_audit_logs()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete old audit logs, keeping only the most recent 500
  DELETE FROM audit_logs
  WHERE id IN (
    SELECT id
    FROM audit_logs
    ORDER BY created_at DESC
    OFFSET 500
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Clean up existing audit logs to keep only the most recent 500
DELETE FROM audit_logs
WHERE id IN (
  SELECT id
  FROM audit_logs
  ORDER BY created_at DESC
  OFFSET 500
);

-- Update the comment on the audit_logs table
COMMENT ON TABLE audit_logs IS 'Stores the most recent 500 audit log entries to save space';
