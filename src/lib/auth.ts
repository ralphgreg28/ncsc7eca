import { createClient } from '@supabase/supabase-js';
import { sha256 } from 'js-sha256';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

export type Staff = Database['public']['Tables']['staff']['Row'];
type StaffInsert = Database['public']['Tables']['staff']['Insert'];
type StaffUpdate = Database['public']['Tables']['staff']['Update'];

type AuthError = {
  type: 'identifier_not_found' | 'inactive_account' | 'invalid_password' | 'unknown';
  message: string;
};

function hashPassword(password: string): string {
  return sha256(password);
}

async function getCurrentUser() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return null;

    const { data: staff, error } = await supabase
      .from('staff')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching staff:', error);
      return null;
    }

    return staff;
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
    return null;
  }
}

async function updateStaff(id: string, updates: StaffUpdate) {
  const { data, error } = await supabase
    .from('staff')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function getStaffList() {
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .order('last_name');

  if (error) throw error;
  return data;
}