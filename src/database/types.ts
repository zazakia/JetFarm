export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      app_action_logs: {
        Row: {
          action: string
          created_at: string | null
          deleted_at: string | null
          entity_id: string
          entity_type: string
          id: string
          new_data: string | null
          old_data: string | null
          performed_by: string
          timestamp: string
          updated_at: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          deleted_at?: string | null
          entity_id: string
          entity_type: string
          id: string
          new_data?: string | null
          old_data?: string | null
          performed_by: string
          timestamp: string
          updated_at?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          deleted_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          new_data?: string | null
          old_data?: string | null
          performed_by?: string
          timestamp?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      app_bank_accounts: {
        Row: {
          account_name: string
          account_number: string
          bank_name: string
          created_at: string | null
          deleted_at: string | null
          id: string
          starting_balance: number
          updated_at: string | null
        }
        Insert: {
          account_name: string
          account_number: string
          bank_name: string
          created_at?: string | null
          deleted_at?: string | null
          id: string
          starting_balance: number
          updated_at?: string | null
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_name?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          starting_balance?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      app_bank_transactions: {
        Row: {
          amount: number
          bank_account_id: string
          created_at: string | null
          deleted_at: string | null
          id: string
          particulars: string
          remarks: string | null
          transaction_date: string
          type: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          bank_account_id: string
          created_at?: string | null
          deleted_at?: string | null
          id: string
          particulars: string
          remarks?: string | null
          transaction_date: string
          type: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          bank_account_id?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          particulars?: string
          remarks?: string | null
          transaction_date?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      app_borrowers: {
        Row: {
          address: string | null
          area: string | null
          auth_id: string | null
          business: string | null
          co_maker_name: string | null
          collector_id: string | null
          created_at: string | null
          created_by: string | null
          date_of_birth: string | null
          deleted_at: string | null
          first_name: string | null
          full_name: string
          gender: string | null
          group: string | null
          id: string
          last_name: string | null
          latitude: number | null
          longitude: number | null
          notes: string | null
          phone: string | null
          route_index: number | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          area?: string | null
          auth_id?: string | null
          business?: string | null
          co_maker_name?: string | null
          collector_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          first_name?: string | null
          full_name: string
          gender?: string | null
          group?: string | null
          id?: string
          last_name?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          phone?: string | null
          route_index?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          area?: string | null
          auth_id?: string | null
          business?: string | null
          co_maker_name?: string | null
          collector_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          first_name?: string | null
          full_name?: string
          gender?: string | null
          group?: string | null
          id?: string
          last_name?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          phone?: string | null
          route_index?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      app_cash_transactions: {
        Row: {
          amount: number
          created_at: string | null
          deleted_at: string | null
          id: string
          particulars: string
          recorded_by: string | null
          remarks: string | null
          transaction_date: string
          type: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          deleted_at?: string | null
          id: string
          particulars: string
          recorded_by?: string | null
          remarks?: string | null
          transaction_date: string
          type: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          particulars?: string
          recorded_by?: string | null
          remarks?: string | null
          transaction_date?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      app_collection_logs: {
        Row: {
          cash_on_hand_end: number
          cash_on_hand_start: number
          collector_id: string
          created_at: string | null
          deleted_at: string | null
          id: string
          log_date: string
          notes: string | null
          total_collected: number
          updated_at: string | null
        }
        Insert: {
          cash_on_hand_end: number
          cash_on_hand_start: number
          collector_id: string
          created_at?: string | null
          deleted_at?: string | null
          id: string
          log_date: string
          notes?: string | null
          total_collected: number
          updated_at?: string | null
        }
        Update: {
          cash_on_hand_end?: number
          cash_on_hand_start?: number
          collector_id?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          log_date?: string
          notes?: string | null
          total_collected?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      app_collectors: {
        Row: {
          auth_id: string | null
          commission_rate: number | null
          created_at: string | null
          deleted_at: string | null
          full_name: string
          id: string
          is_active: boolean | null
          member_id: string | null
          updated_at: string | null
        }
        Insert: {
          auth_id?: string | null
          commission_rate?: number | null
          created_at?: string | null
          deleted_at?: string | null
          full_name: string
          id: string
          is_active?: boolean | null
          member_id?: string | null
          updated_at?: string | null
        }
        Update: {
          auth_id?: string | null
          commission_rate?: number | null
          created_at?: string | null
          deleted_at?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          member_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      app_expense_categories: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      app_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          deleted_at: string | null
          description: string | null
          encoded_by: string | null
          expense_date: string
          frequency: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          encoded_by?: string | null
          expense_date: string
          frequency?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          encoded_by?: string | null
          expense_date?: string
          frequency?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      app_financial_snapshots: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          financial_costs: number
          id: string
          inflation_adjustment: number | null
          loan_loss_reserve: number
          operating_revenue: number
          risk_weighted_assets: number | null
          snapshot_date: string
          subsidy_adjustment: number | null
          total_assets: number
          total_equity: number
          total_liabilities: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          financial_costs: number
          id: string
          inflation_adjustment?: number | null
          loan_loss_reserve: number
          operating_revenue: number
          risk_weighted_assets?: number | null
          snapshot_date: string
          subsidy_adjustment?: number | null
          total_assets: number
          total_equity: number
          total_liabilities: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          financial_costs?: number
          id?: string
          inflation_adjustment?: number | null
          loan_loss_reserve?: number
          operating_revenue?: number
          risk_weighted_assets?: number | null
          snapshot_date?: string
          subsidy_adjustment?: number | null
          total_assets?: number
          total_equity?: number
          total_liabilities?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      app_loan_penalties: {
        Row: {
          amount: number
          created_at: string
          deleted_at: string | null
          id: string
          loan_id: string | null
          penalty_date: number
          reason: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at: string
          deleted_at?: string | null
          id?: string
          loan_id?: string | null
          penalty_date: number
          reason?: string | null
          updated_at: string
        }
        Update: {
          amount?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          loan_id?: string | null
          penalty_date?: number
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_loan_penalties_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "app_loans"
            referencedColumns: ["id"]
          },
        ]
      }
      app_loans: {
        Row: {
          batch: number | null
          borrower_id: string
          collection_fee: number | null
          collector_id: string | null
          created_at: string | null
          cycle: number | null
          deducted_amount: number | null
          deleted_at: string | null
          deposit_amount: number | null
          dst_fee: number | null
          encoded_by: string | null
          first_payment_date: string | null
          frequency: string | null
          id: string
          installment_amount: number | null
          insurance_amount: number | null
          interest_amount: number | null
          interest_rate: number | null
          interest_type: string | null
          is_reloan: boolean | null
          loan_type: string | null
          lto_fee: number | null
          loan_number: string | null
          maturity_date: string | null
          notarial_fee: number | null
          notes: string | null
          previous_loan_id: string | null
          processing_fee: number | null
          principal_amount: number | null
          rebate_amount: number | null
          release_date: string | null
          rod_fee: number | null
          savings_per_payment: number | null
          status: string | null
          term: number | null
          term_unit: string | null
          total_amount: number | null
          udi_rebatable_fee: number | null
          updated_at: string | null
          vat_on_charges: number | null
          vat_on_interest: number | null
        }
        Insert: {
          batch?: number | null
          borrower_id: string
          collection_fee?: number | null
          collector_id?: string | null
          created_at?: string | null
          cycle?: number | null
          deducted_amount?: number | null
          deleted_at?: string | null
          deposit_amount?: number | null
          dst_fee?: number | null
          encoded_by?: string | null
          first_payment_date?: string | null
          frequency?: string | null
          id: string
          installment_amount?: number | null
          insurance_amount?: number | null
          interest_amount?: number | null
          interest_rate?: number | null
          interest_type?: string | null
          is_reloan?: boolean | null
          loan_type?: string | null
          lto_fee?: number | null
          loan_number?: string | null
          maturity_date?: string | null
          notarial_fee?: number | null
          notes?: string | null
          previous_loan_id?: string | null
          processing_fee?: number | null
          principal_amount?: number | null
          rebate_amount?: number | null
          release_date?: string | null
          rod_fee?: number | null
          savings_per_payment?: number | null
          status?: string | null
          term?: number | null
          term_unit?: string | null
          total_amount?: number | null
          udi_rebatable_fee?: number | null
          updated_at?: string | null
          vat_on_charges?: number | null
          vat_on_interest?: number | null
        }
        Update: {
          batch?: number | null
          borrower_id?: string
          collection_fee?: number | null
          collector_id?: string | null
          created_at?: string | null
          cycle?: number | null
          deducted_amount?: number | null
          deleted_at?: string | null
          deposit_amount?: number | null
          dst_fee?: number | null
          encoded_by?: string | null
          first_payment_date?: string | null
          frequency?: string | null
          id?: string
          installment_amount?: number | null
          insurance_amount?: number | null
          interest_amount?: number | null
          interest_rate?: number | null
          interest_type?: string | null
          is_reloan?: boolean | null
          loan_type?: string | null
          lto_fee?: number | null
          loan_number?: string | null
          maturity_date?: string | null
          notarial_fee?: number | null
          notes?: string | null
          previous_loan_id?: string | null
          processing_fee?: number | null
          principal_amount?: number | null
          rebate_amount?: number | null
          release_date?: string | null
          rod_fee?: number | null
          savings_per_payment?: number | null
          status?: string | null
          term?: number | null
          term_unit?: string | null
          total_amount?: number | null
          udi_rebatable_fee?: number | null
          updated_at?: string | null
          vat_on_charges?: number | null
          vat_on_interest?: number | null
        }
        Relationships: []
      }
      app_payment_schedules: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          due_date: string
          fees_amount: number
          id: string
          interest_amount: number | null
          loan_id: string
          principal_amount: number | null
          scheduled_amount: number
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          due_date: string
          fees_amount?: number
          id: string
          interest_amount?: number | null
          loan_id: string
          principal_amount?: number | null
          scheduled_amount: number
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          due_date?: string
          fees_amount?: number
          id?: string
          interest_amount?: number | null
          loan_id?: string
          principal_amount?: number | null
          scheduled_amount?: number
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      app_payments: {
        Row: {
          amount: number
          borrower_id: string | null
          collector_id: string | null
          created_at: string | null
          deleted_at: string | null
          encoded_at: string | null
          id: string
          loan_id: string
          notes: string | null
          payment_date: string
          receipt_number: string | null
          schedule_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          borrower_id?: string | null
          collector_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          encoded_at?: string | null
          id: string
          loan_id: string
          notes?: string | null
          payment_date: string
          receipt_number?: string | null
          schedule_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          borrower_id?: string | null
          collector_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          encoded_at?: string | null
          id?: string
          loan_id?: string
          notes?: string | null
          payment_date?: string
          receipt_number?: string | null
          schedule_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      app_remittances: {
        Row: {
          amount: number
          approved_by: string | null
          collector_id: string
          created_at: string | null
          deleted_at: string | null
          id: string
          notes: string | null
          remittance_date: string
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          approved_by?: string | null
          collector_id: string
          created_at?: string | null
          deleted_at?: string | null
          id: string
          notes?: string | null
          remittance_date: string
          status: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          approved_by?: string | null
          collector_id?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          remittance_date?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      app_savings_transactions: {
        Row: {
          amount: number
          borrower_id: string
          created_at: string | null
          date: string
          deleted_at: string | null
          id: string
          notes: string | null
          reference_id: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          borrower_id: string
          created_at?: string | null
          date: string
          deleted_at?: string | null
          id: string
          notes?: string | null
          reference_id?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          borrower_id?: string
          created_at?: string | null
          date?: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          reference_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      collection_groups: {
        Row: {
          collection_day: number
          collector_id: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          collection_day?: number
          collector_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          collection_day?: number
          collector_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean | null
          role: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean | null
          role: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_current_collector_id: { Args: never; Returns: string }
      get_current_role: { Args: never; Returns: string }
      get_next_serial: { Args: { prefix: string }; Returns: string }
      get_server_time: { Args: never; Returns: string }
      is_global_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
