export interface Database {
  public: {
    Tables: {
      citizens: {
        Row: {
          id: number
          created_at: string
          last_name: string
          first_name: string
          middle_name: string | null
          extension_name: string | null
          birth_date: string
          sex: 'Male' | 'Female'
          province_code: string
          lgu_code: string
          barangay_code: string
          remarks: string | null
          status: 'Encoded' | 'Validated' | 'Cleanlisted' | 'Paid' | 'Unpaid' | 'Liquidated' | 'Disqualified'
          payment_date: string | null
          osca_id: string
          rrn: string
          validator: string | null
          validation_date: string | null
          encoded_date: string
          encoded_by: string | null
        }
        Insert: {
          id?: number
          created_at?: string
          last_name: string
          first_name: string
          middle_name?: string | null
          extension_name?: string | null
          birth_date: string
          sex: 'Male' | 'Female'
          province_code: string
          lgu_code: string
          barangay_code: string
          remarks?: string | null
          status?: 'Encoded' | 'Validated' | 'Cleanlisted' | 'Paid' | 'Unpaid' | 'Liquidated' | 'Disqualified'
          payment_date?: string | null
          osca_id?: string
          rrn?: string
          validator?: string | null
          validation_date?: string | null
          encoded_date?: string
          encoded_by?: string | null
        }
        Update: {
          id?: number
          created_at?: string
          last_name?: string
          first_name?: string
          middle_name?: string | null
          extension_name?: string | null
          birth_date?: string
          sex?: 'Male' | 'Female'
          province_code?: string
          lgu_code?: string
          barangay_code?: string
          remarks?: string | null
          status?: 'Encoded' | 'Validated' | 'Cleanlisted' | 'Paid' | 'Unpaid' | 'Liquidated' | 'Disqualified'
          payment_date?: string | null
          osca_id?: string
          rrn?: string
          validator?: string | null
          validation_date?: string | null
          encoded_date?: string
          encoded_by?: string | null
        }
      }
      regions: {
        Row: {
          id: number
          code: string
          name: string
        }
        Insert: {
          id?: number
          code: string
          name: string
        }
        Update: {
          id?: number
          code?: string
          name?: string
        }
      }
      provinces: {
        Row: {
          id: number
          code: string
          name: string
          region_code: string
        }
        Insert: {
          id?: number
          code: string
          name: string
          region_code: string
        }
        Update: {
          id?: number
          code?: string
          name?: string
          region_code?: string
        }
      }
      barangays: {
        Row: {
          id: number
          code: string
          name: string
          province_code: string
          lgu_code: string
        }
        Insert: {
          id?: number
          code: string
          name: string
          province_code: string
          lgu_code: string
        }
        Update: {
          id?: number
          code?: string
          name?: string
          province_code?: string
          lgu_code?: string
        }
      }
      lgus: {
        Row: {
          id: number
          code: string
          name: string
          province_code: string
        }
        Insert: {
          id?: number
          code: string
          name: string
          province_code: string
        }
        Update: {
          id?: number
          code?: string
          name?: string
          province_code?: string
        }
      }
      stakeholder_positions: {
        Row: {
          id: number
          name: string
          level: 'province' | 'lgu' | 'barangay'
        }
        Insert: {
          id?: number
          name: string
          level: 'province' | 'lgu' | 'barangay'
        }
        Update: {
          id?: number
          name?: string
          level?: 'province' | 'lgu' | 'barangay'
        }
      }
      stakeholders: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          updated_by: string | null
          position_id: number
          province_code: string
          lgu_code: string | null
          barangay_code: string | null
          name: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          position_id: number
          province_code: string
          lgu_code?: string | null
          barangay_code?: string | null
          name: string
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          position_id?: number
          province_code?: string
          lgu_code?: string | null
          barangay_code?: string | null
          name?: string
        }
      }
      stakeholder_contacts: {
        Row: {
          id: string
          stakeholder_id: string
          type: 'phone' | 'email'
          value: string
          priority: number
        }
        Insert: {
          id?: string
          stakeholder_id: string
          type: 'phone' | 'email'
          value: string
          priority: number
        }
        Update: {
          id?: string
          stakeholder_id?: string
          type?: 'phone' | 'email'
          value?: string
          priority?: number
        }
      }
      staff: {
        Row: {
          id: string
          created_at: string
          username: string
          password_hash: string
          email: string
          first_name: string
          last_name: string
          middle_name: string | null
          extension_name: string | null
          birth_date: string
          sex: 'Male' | 'Female'
          position: 'Administrator' | 'PDO'
          status: 'Active' | 'Inactive'
          last_login: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          username: string
          password_hash: string
          email: string
          first_name: string
          last_name: string
          middle_name?: string | null
          extension_name?: string | null
          birth_date: string
          sex: 'Male' | 'Female'
          position: 'Administrator' | 'PDO'
          status?: 'Active' | 'Inactive'
          last_login?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          username?: string
          password_hash?: string
          email?: string
          first_name?: string
          last_name?: string
          middle_name?: string | null
          extension_name?: string | null
          birth_date?: string
          sex?: 'Male' | 'Female'
          position?: 'Administrator' | 'PDO'
          status?: 'Active' | 'Inactive'
          last_login?: string | null
        }
      }
      staff_assignments: {
        Row: {
          id: number
          staff_id: string
          province_code: string
          lgu_code: string | null
          created_at: string
        }
        Insert: {
          id?: number
          staff_id: string
          province_code: string
          lgu_code?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          staff_id?: string
          province_code?: string
          lgu_code?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
