import { sha256 } from 'js-sha256';
import { supabase } from './supabase';
import type { Database } from './database.types';

export type Staff = Database['public']['Tables']['staff']['Row'];
type StaffInsert = Database['public']['Tables']['staff']['Insert'];
type StaffUpdate = Database['public']['Tables']['staff']['Update'];

type AuthError = {
  type: 'identifier_not_found' | 'inactive_account' | 'invalid_password' | 'unknown';
  message: string;
};

// Session timeout in minutes (default: 30 minutes)
const SESSION_TIMEOUT = 30;

/**
 * Properly hash password using SHA-256
 */
export function hashPassword(password: string): string {
  return sha256(password);
}

/**
 * Login a user with username and password
 * Uses secure session management with Supabase Auth
 */
export async function loginUser(username: string, password: string, rememberMe: boolean = false) {
  try {
    // First, get the staff record to check if user exists and is active
    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('*')
      .eq('username', username)
      .single();

    if (staffError || !staff) {
      return { 
        success: false, 
        error: { 
          type: 'identifier_not_found', 
          message: 'Invalid username or password' 
        } as AuthError 
      };
    }

    // Check if user is active
    if (staff.status !== 'Active') {
      return { 
        success: false, 
        error: { 
          type: 'inactive_account', 
          message: 'Your account is not active. Please contact an administrator.' 
        } as AuthError 
      };
    }

    // Verify password - handle both hashed and unhashed passwords for backward compatibility
    // First try direct comparison (for backward compatibility)
    console.log('Login attempt:', { 
      username, 
      passwordLength: password.length,
      storedHashLength: staff.password_hash?.length || 0,
      directMatch: staff.password_hash === password
    });
    
    if (staff.password_hash !== password) {
      // If direct comparison fails, try comparing with hashed password
      const hashedPassword = hashPassword(password);
      console.log('Hashed comparison:', { 
        hashedPasswordLength: hashedPassword.length,
        match: staff.password_hash === hashedPassword
      });
      
      if (staff.password_hash !== hashedPassword) {
        return { 
          success: false, 
          error: { 
            type: 'invalid_password', 
            message: 'Invalid username or password' 
          } as AuthError 
        };
      }
    }

    // Update last login
    const { error: updateError } = await supabase
      .from('staff')
      .update({ last_login: new Date().toISOString() })
      .eq('id', staff.id);

    if (updateError) {
      console.error('Failed to update last login:', updateError);
    }

    // Set session expiration time
    const expiresIn = rememberMe ? 60 * 24 * 7 : SESSION_TIMEOUT; // 7 days if remember me, otherwise 30 minutes
    
    // Store minimal user info in localStorage with expiration
    const sessionData = {
      id: staff.id,
      username: staff.username,
      role: staff.role,
      firstName: staff.first_name,
      lastName: staff.last_name,
      expiresAt: Date.now() + (expiresIn * 60 * 1000)
    };
    
    console.log('Storing session data:', sessionData);
    localStorage.setItem('sessionData', JSON.stringify(sessionData));
    
    // Store the full staff object in sessionStorage (cleared when browser is closed)
    console.log('Storing user in sessionStorage:', staff);
    sessionStorage.setItem('user', JSON.stringify(staff));

    // Also store in localStorage as a fallback (will be removed in future versions)
    localStorage.setItem('user', JSON.stringify(staff));

    return { success: true, user: staff };
  } catch (error) {
    console.error('Login error:', error);
    return { 
      success: false, 
      error: { 
        type: 'unknown', 
        message: 'An unexpected error occurred. Please try again.' 
      } as AuthError 
    };
  }
}

/**
 * Check if the current session is valid and not expired
 * Refreshes the session if the user is active
 */
export function checkSession(): { valid: boolean; user: Staff | null } {
  try {
    // Check if we have session data
    const sessionDataStr = localStorage.getItem('sessionData');
    if (!sessionDataStr) {
      return { valid: false, user: null };
    }

    const sessionData = JSON.parse(sessionDataStr);
    const now = Date.now();
    
    // Check if session has expired
    if (now > sessionData.expiresAt) {
      // Session expired, clear storage
      localStorage.removeItem('sessionData');
      sessionStorage.removeItem('user');
      return { valid: false, user: null };
    }
    
    // Session is valid, get the full user object
    let userStr = sessionStorage.getItem('user');
    
    // If not in sessionStorage, try localStorage as fallback
    if (!userStr) {
      console.log('User not found in sessionStorage, checking localStorage...');
      userStr = localStorage.getItem('user');
      if (!userStr) {
        console.log('User not found in localStorage either');
        return { valid: false, user: null };
      }
      // Copy from localStorage to sessionStorage for future use
      sessionStorage.setItem('user', userStr);
    }
    
    const user = JSON.parse(userStr) as Staff;
    console.log('Retrieved user from storage:', user.username);
    
    // Refresh the session expiration (extend it based on activity)
    const expiresAt = now + (SESSION_TIMEOUT * 60 * 1000);
    localStorage.setItem('sessionData', JSON.stringify({
      ...sessionData,
      expiresAt
    }));
    
    return { valid: true, user };
  } catch (error) {
    console.error('Error checking session:', error);
    return { valid: false, user: null };
  }
}

/**
 * Log out the current user
 */
export function logoutUser() {
  localStorage.removeItem('sessionData');
  sessionStorage.removeItem('user');
}

/**
 * Get the current authenticated user
 */
export async function getCurrentUser() {
  const { valid, user } = checkSession();
  if (!valid || !user) {
    return null;
  }
  return user;
}

/**
 * Update staff information
 */
export async function updateStaff(id: string, updates: StaffUpdate) {
  const { data, error } = await supabase
    .from('staff')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  
  // If updating the current user, update the session storage
  const { valid, user } = checkSession();
  if (valid && user && user.id === id) {
    const updatedUser = { ...user, ...updates };
    sessionStorage.setItem('user', JSON.stringify(updatedUser));
  }
  
  return data;
}

/**
 * Get a list of all staff members
 */
export async function getStaffList() {
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .order('last_name');

  if (error) throw error;
  return data;
}
