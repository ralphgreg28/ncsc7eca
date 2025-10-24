import { supabase } from './supabase';

export interface AuditLogEntry {
  action: string;
  details?: any;
  table_name?: string;
  record_id?: string;
  staff_id?: string;
  ip_address?: string;
}

export interface AuditLog {
  id: string;
  created_at: string;
  staff_id: string | null;
  action: string;
  details?: any;
  ip_address?: string;
  table_name?: string;
  record_id?: string;
  staff?: {
    first_name: string;
    last_name: string;
    middle_name: string | null;
  } | null;
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

export async function getLatestAuditLog(tableName: string, recordId: string): Promise<AuditLog | null> {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select(`
        id,
        created_at,
        staff_id,
        action,
        details,
        ip_address,
        table_name,
        record_id,
        staff:staff_id (
          first_name,
          last_name,
          middle_name
        )
      `)
      .eq('table_name', tableName)
      .eq('record_id', recordId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // If no audit log exists, return null instead of throwing
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data as AuditLog;
  } catch (error) {
    console.error('Error fetching audit log:', error);
    return null;
  }
}
