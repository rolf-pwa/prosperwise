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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      contacts: {
        Row: {
          accountant_firm: string | null
          accountant_name: string | null
          address: string | null
          asana_url: string | null
          created_at: string
          created_by: string
          email: string | null
          fiduciary_entity: Database["public"]["Enums"]["fiduciary_entity"]
          full_name: string
          google_drive_url: string | null
          governance_status: Database["public"]["Enums"]["governance_status"]
          household_members: Json | null
          ia_financial_url: string | null
          id: string
          lawyer_firm: string | null
          lawyer_name: string | null
          phone: string | null
          quiet_period_start_date: string | null
          sidedrawer_url: string | null
          updated_at: string
          vineyard_balance_sheet_summary: string | null
          vineyard_ebitda: number | null
          vineyard_operating_income: number | null
        }
        Insert: {
          accountant_firm?: string | null
          accountant_name?: string | null
          address?: string | null
          asana_url?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          fiduciary_entity?: Database["public"]["Enums"]["fiduciary_entity"]
          full_name: string
          google_drive_url?: string | null
          governance_status?: Database["public"]["Enums"]["governance_status"]
          household_members?: Json | null
          ia_financial_url?: string | null
          id?: string
          lawyer_firm?: string | null
          lawyer_name?: string | null
          phone?: string | null
          quiet_period_start_date?: string | null
          sidedrawer_url?: string | null
          updated_at?: string
          vineyard_balance_sheet_summary?: string | null
          vineyard_ebitda?: number | null
          vineyard_operating_income?: number | null
        }
        Update: {
          accountant_firm?: string | null
          accountant_name?: string | null
          address?: string | null
          asana_url?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          fiduciary_entity?: Database["public"]["Enums"]["fiduciary_entity"]
          full_name?: string
          google_drive_url?: string | null
          governance_status?: Database["public"]["Enums"]["governance_status"]
          household_members?: Json | null
          ia_financial_url?: string | null
          id?: string
          lawyer_firm?: string | null
          lawyer_name?: string | null
          phone?: string | null
          quiet_period_start_date?: string | null
          sidedrawer_url?: string | null
          updated_at?: string
          vineyard_balance_sheet_summary?: string | null
          vineyard_ebitda?: number | null
          vineyard_operating_income?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      storehouses: {
        Row: {
          asset_type: string | null
          charter_alignment: Database["public"]["Enums"]["charter_alignment"]
          contact_id: string
          created_at: string
          id: string
          label: string
          notes: string | null
          risk_cap: string | null
          storehouse_number: number
          updated_at: string
        }
        Insert: {
          asset_type?: string | null
          charter_alignment?: Database["public"]["Enums"]["charter_alignment"]
          contact_id: string
          created_at?: string
          id?: string
          label?: string
          notes?: string | null
          risk_cap?: string | null
          storehouse_number: number
          updated_at?: string
        }
        Update: {
          asset_type?: string | null
          charter_alignment?: Database["public"]["Enums"]["charter_alignment"]
          contact_id?: string
          created_at?: string
          id?: string
          label?: string
          notes?: string | null
          risk_cap?: string | null
          storehouse_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "storehouses_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      charter_alignment: "aligned" | "misaligned" | "pending_review"
      fiduciary_entity: "pws" | "pwa"
      governance_status: "stabilization" | "sovereign"
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
    Enums: {
      charter_alignment: ["aligned", "misaligned", "pending_review"],
      fiduciary_entity: ["pws", "pwa"],
      governance_status: ["stabilization", "sovereign"],
    },
  },
} as const
