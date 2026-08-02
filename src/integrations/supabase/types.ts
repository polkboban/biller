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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      bills: {
        Row: {
          bill_date: string | null
          bill_number: string | null
          cgst_amount: number | null
          created_at: string
          currency: string | null
          discount: number | null
          grand_total: number | null
          id: string
          igst_amount: number | null
          image_path: string
          is_reviewed: boolean
          line_items: Json
          notes: string | null
          original_filename: string | null
          other_charges: number | null
          payment_mode: string | null
          sgst_amount: number | null
          status: string
          subtotal: number | null
          updated_at: string
          user_id: string
          vendor_gstin: string | null
          vendor_name: string | null
          zoho_error: string | null
          zoho_expense_id: string | null
          zoho_pushed_at: string | null
          zoho_status: string
          zoho_vendor_id: string | null
        }
        Insert: {
          bill_date?: string | null
          bill_number?: string | null
          cgst_amount?: number | null
          created_at?: string
          currency?: string | null
          discount?: number | null
          grand_total?: number | null
          id?: string
          igst_amount?: number | null
          image_path: string
          is_reviewed?: boolean
          line_items?: Json
          notes?: string | null
          original_filename?: string | null
          other_charges?: number | null
          payment_mode?: string | null
          sgst_amount?: number | null
          status?: string
          subtotal?: number | null
          updated_at?: string
          user_id: string
          vendor_gstin?: string | null
          vendor_name?: string | null
          zoho_error?: string | null
          zoho_expense_id?: string | null
          zoho_pushed_at?: string | null
          zoho_status?: string
          zoho_vendor_id?: string | null
        }
        Update: {
          bill_date?: string | null
          bill_number?: string | null
          cgst_amount?: number | null
          created_at?: string
          currency?: string | null
          discount?: number | null
          grand_total?: number | null
          id?: string
          igst_amount?: number | null
          image_path?: string
          is_reviewed?: boolean
          line_items?: Json
          notes?: string | null
          original_filename?: string | null
          other_charges?: number | null
          payment_mode?: string | null
          sgst_amount?: number | null
          status?: string
          subtotal?: number | null
          updated_at?: string
          user_id?: string
          vendor_gstin?: string | null
          vendor_name?: string | null
          zoho_error?: string | null
          zoho_expense_id?: string | null
          zoho_pushed_at?: string | null
          zoho_status?: string
          zoho_vendor_id?: string | null
        }
        Relationships: []
      }
      extractions: {
        Row: {
          bill_id: string
          created_at: string
          error: string | null
          id: string
          latency_ms: number | null
          model: string
          model_label: string | null
          parse_ok: boolean
          parsed: Json | null
          raw_response: string | null
          user_id: string
        }
        Insert: {
          bill_id: string
          created_at?: string
          error?: string | null
          id?: string
          latency_ms?: number | null
          model: string
          model_label?: string | null
          parse_ok?: boolean
          parsed?: Json | null
          raw_response?: string | null
          user_id: string
        }
        Update: {
          bill_id?: string
          created_at?: string
          error?: string | null
          id?: string
          latency_ms?: number | null
          model?: string
          model_label?: string | null
          parse_ok?: boolean
          parsed?: Json | null
          raw_response?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "extractions_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
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
