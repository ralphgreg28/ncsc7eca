import { supabase } from './supabase';

export interface AuditLogEntry {
  action: string;
  details?: any;
  table_name?: string;
  record_id?: string;
  staff_id?: string;
  ip_address?: string;
}

export async function logAudit(entry: AuditLogEntry) {
  try {
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        staff_id: entry.staff_id,
        action: entry.action,
        details: entry.details,
        table_name: entry.table_name,
        record_id: entry.record_id,
        ip_address: entry.ip_address
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error logging audit entry:', error);
  }
}