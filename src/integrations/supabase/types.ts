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
      account_harvest_snapshots: {
        Row: {
          boy_value: number
          contact_id: string
          created_at: string
          created_by: string | null
          current_harvest: number
          current_value: number
          id: string
          notes: string | null
          reporting_year: number
          snapshot_date: string
          storehouse_id: string | null
          updated_at: string
          vineyard_account_id: string | null
          ytd_value: number
        }
        Insert: {
          boy_value?: number
          contact_id: string
          created_at?: string
          created_by?: string | null
          current_harvest?: number
          current_value?: number
          id?: string
          notes?: string | null
          reporting_year?: number
          snapshot_date?: string
          storehouse_id?: string | null
          updated_at?: string
          vineyard_account_id?: string | null
          ytd_value?: number
        }
        Update: {
          boy_value?: number
          contact_id?: string
          created_at?: string
          created_by?: string | null
          current_harvest?: number
          current_value?: number
          id?: string
          notes?: string | null
          reporting_year?: number
          snapshot_date?: string
          storehouse_id?: string | null
          updated_at?: string
          vineyard_account_id?: string | null
          ytd_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "account_harvest_snapshots_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_harvest_snapshots_storehouse_id_fkey"
            columns: ["storehouse_id"]
            isOneToOne: false
            referencedRelation: "storehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_harvest_snapshots_vineyard_account_id_fkey"
            columns: ["vineyard_account_id"]
            isOneToOne: false
            referencedRelation: "vineyard_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      business_pipeline: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["pipeline_category"]
          contact_id: string
          created_at: string
          created_by: string
          expected_close_date: string | null
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["pipeline_status"]
          updated_at: string
        }
        Insert: {
          amount?: number
          category: Database["public"]["Enums"]["pipeline_category"]
          contact_id: string
          created_at?: string
          created_by: string
          expected_close_date?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["pipeline_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["pipeline_category"]
          contact_id?: string
          created_at?: string
          created_by?: string
          expected_close_date?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["pipeline_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_pipeline_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      cashflow_analyses: {
        Row: {
          burn_rate: Json | null
          category_breakdown: Json | null
          created_at: string
          created_by: string
          file_paths: string[] | null
          household_id: string
          id: string
          liquidity_status: Json | null
          logic_trace: string | null
          outliers: Json | null
          period_end: string | null
          period_start: string | null
          proposed_tasks: Json | null
          raw_report: string | null
          status: string
          updated_at: string
        }
        Insert: {
          burn_rate?: Json | null
          category_breakdown?: Json | null
          created_at?: string
          created_by: string
          file_paths?: string[] | null
          household_id: string
          id?: string
          liquidity_status?: Json | null
          logic_trace?: string | null
          outliers?: Json | null
          period_end?: string | null
          period_start?: string | null
          proposed_tasks?: Json | null
          raw_report?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          burn_rate?: Json | null
          category_breakdown?: Json | null
          created_at?: string
          created_by?: string
          file_paths?: string[] | null
          household_id?: string
          id?: string
          liquidity_status?: Json | null
          logic_trace?: string | null
          outliers?: Json | null
          period_end?: string | null
          period_start?: string | null
          proposed_tasks?: Json | null
          raw_report?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cashflow_analyses_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          accountant_firm: string | null
          accountant_name: string | null
          address: string | null
          asana_url: string | null
          charter_url: string | null
          created_at: string
          created_by: string
          email: string | null
          email_notifications_enabled: boolean
          executor_firm: string | null
          executor_name: string | null
          family_id: string | null
          family_role: Database["public"]["Enums"]["family_role"]
          fiduciary_entity: Database["public"]["Enums"]["fiduciary_entity"]
          first_name: string
          full_name: string
          google_drive_url: string | null
          governance_status: Database["public"]["Enums"]["governance_status"]
          household_id: string | null
          household_members: Json | null
          ia_financial_url: string | null
          id: string
          is_minor: boolean
          just_wealth_url: string | null
          last_name: string | null
          lawyer_firm: string | null
          lawyer_name: string | null
          phone: string | null
          poa_firm: string | null
          poa_name: string | null
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
          charter_url?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          email_notifications_enabled?: boolean
          executor_firm?: string | null
          executor_name?: string | null
          family_id?: string | null
          family_role?: Database["public"]["Enums"]["family_role"]
          fiduciary_entity?: Database["public"]["Enums"]["fiduciary_entity"]
          first_name?: string
          full_name: string
          google_drive_url?: string | null
          governance_status?: Database["public"]["Enums"]["governance_status"]
          household_id?: string | null
          household_members?: Json | null
          ia_financial_url?: string | null
          id?: string
          is_minor?: boolean
          just_wealth_url?: string | null
          last_name?: string | null
          lawyer_firm?: string | null
          lawyer_name?: string | null
          phone?: string | null
          poa_firm?: string | null
          poa_name?: string | null
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
          charter_url?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          email_notifications_enabled?: boolean
          executor_firm?: string | null
          executor_name?: string | null
          family_id?: string | null
          family_role?: Database["public"]["Enums"]["family_role"]
          fiduciary_entity?: Database["public"]["Enums"]["fiduciary_entity"]
          first_name?: string
          full_name?: string
          google_drive_url?: string | null
          governance_status?: Database["public"]["Enums"]["governance_status"]
          household_id?: string | null
          household_members?: Json | null
          ia_financial_url?: string | null
          id?: string
          is_minor?: boolean
          just_wealth_url?: string | null
          last_name?: string | null
          lawyer_firm?: string | null
          lawyer_name?: string | null
          phone?: string | null
          poa_firm?: string | null
          poa_name?: string | null
          quiet_period_start_date?: string | null
          sidedrawer_url?: string | null
          updated_at?: string
          vineyard_balance_sheet_summary?: string | null
          vineyard_ebitda?: number | null
          vineyard_operating_income?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      content_platform_versions: {
        Row: {
          body: string
          created_at: string
          external_url: string | null
          id: string
          platform: Database["public"]["Enums"]["content_platform"]
          post_id: string
          published: boolean
          published_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          external_url?: string | null
          id?: string
          platform: Database["public"]["Enums"]["content_platform"]
          post_id: string
          published?: boolean
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          external_url?: string | null
          id?: string
          platform?: Database["public"]["Enums"]["content_platform"]
          post_id?: string
          published?: boolean
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_platform_versions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "content_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      content_posts: {
        Row: {
          assigned_to: string | null
          body: string
          created_at: string
          created_by: string
          id: string
          notes: string | null
          published_at: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["content_status"]
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          body?: string
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      corporate_shareholders: {
        Row: {
          child_corporation_id: string
          created_at: string
          id: string
          notes: string | null
          ownership_percentage: number
          parent_corporation_id: string
          share_class: string | null
          updated_at: string
        }
        Insert: {
          child_corporation_id: string
          created_at?: string
          id?: string
          notes?: string | null
          ownership_percentage?: number
          parent_corporation_id: string
          share_class?: string | null
          updated_at?: string
        }
        Update: {
          child_corporation_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          ownership_percentage?: number
          parent_corporation_id?: string
          share_class?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "corporate_shareholders_child_corporation_id_fkey"
            columns: ["child_corporation_id"]
            isOneToOne: false
            referencedRelation: "corporations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corporate_shareholders_parent_corporation_id_fkey"
            columns: ["parent_corporation_id"]
            isOneToOne: false
            referencedRelation: "corporations"
            referencedColumns: ["id"]
          },
        ]
      }
      corporate_vineyard_accounts: {
        Row: {
          account_name: string
          account_number: string | null
          account_type: string
          corporation_id: string
          created_at: string
          current_value: number | null
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          account_name: string
          account_number?: string | null
          account_type?: string
          corporation_id: string
          created_at?: string
          current_value?: number | null
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_number?: string | null
          account_type?: string
          corporation_id?: string
          created_at?: string
          current_value?: number | null
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "corporate_vineyard_accounts_corporation_id_fkey"
            columns: ["corporation_id"]
            isOneToOne: false
            referencedRelation: "corporations"
            referencedColumns: ["id"]
          },
        ]
      }
      corporations: {
        Row: {
          asana_project_url: string | null
          corporation_type: Database["public"]["Enums"]["corporation_type"]
          created_at: string
          created_by: string
          fiscal_year_end: string | null
          id: string
          jurisdiction: string | null
          name: string
          notes: string | null
          sidedrawer_url: string | null
          updated_at: string
        }
        Insert: {
          asana_project_url?: string | null
          corporation_type?: Database["public"]["Enums"]["corporation_type"]
          created_at?: string
          created_by: string
          fiscal_year_end?: string | null
          id?: string
          jurisdiction?: string | null
          name: string
          notes?: string | null
          sidedrawer_url?: string | null
          updated_at?: string
        }
        Update: {
          asana_project_url?: string | null
          corporation_type?: Database["public"]["Enums"]["corporation_type"]
          created_at?: string
          created_by?: string
          fiscal_year_end?: string | null
          id?: string
          jurisdiction?: string | null
          name?: string
          notes?: string | null
          sidedrawer_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      daily_recaps: {
        Row: {
          ai_draft: string | null
          author_id: string
          body: string | null
          created_at: string
          id: string
          recap_date: string
          updated_at: string
        }
        Insert: {
          ai_draft?: string | null
          author_id: string
          body?: string | null
          created_at?: string
          id?: string
          recap_date: string
          updated_at?: string
        }
        Update: {
          ai_draft?: string | null
          author_id?: string
          body?: string | null
          created_at?: string
          id?: string
          recap_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      discovery_leads: {
        Row: {
          anxiety_anchor: string | null
          created_at: string
          discovery_notes: string | null
          email: string | null
          family_id: string | null
          first_name: string
          id: string
          phone: string | null
          pipeda_consent: boolean
          pipeda_consented_at: string | null
          sovereignty_status: string
          transition_type: string | null
          updated_at: string
          vineyard_summary: string | null
          vision_summary: string | null
        }
        Insert: {
          anxiety_anchor?: string | null
          created_at?: string
          discovery_notes?: string | null
          email?: string | null
          family_id?: string | null
          first_name: string
          id?: string
          phone?: string | null
          pipeda_consent?: boolean
          pipeda_consented_at?: string | null
          sovereignty_status?: string
          transition_type?: string | null
          updated_at?: string
          vineyard_summary?: string | null
          vision_summary?: string | null
        }
        Update: {
          anxiety_anchor?: string | null
          created_at?: string
          discovery_notes?: string | null
          email?: string | null
          family_id?: string | null
          first_name?: string
          id?: string
          phone?: string | null
          pipeda_consent?: boolean
          pipeda_consented_at?: string | null
          sovereignty_status?: string
          transition_type?: string | null
          updated_at?: string
          vineyard_summary?: string | null
          vision_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discovery_leads_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_watch_state: {
        Row: {
          charter_folder_id: string | null
          charter_last_checked_at: string | null
          charter_last_synced_at: string | null
          charter_sync_status: string
          contact_id: string
          created_at: string
          id: string
          last_checked_at: string
          last_file_found_at: string | null
          updated_at: string
        }
        Insert: {
          charter_folder_id?: string | null
          charter_last_checked_at?: string | null
          charter_last_synced_at?: string | null
          charter_sync_status?: string
          contact_id: string
          created_at?: string
          id?: string
          last_checked_at?: string
          last_file_found_at?: string | null
          updated_at?: string
        }
        Update: {
          charter_folder_id?: string | null
          charter_last_checked_at?: string | null
          charter_last_synced_at?: string | null
          charter_sync_status?: string
          contact_id?: string
          created_at?: string
          id?: string
          last_checked_at?: string
          last_file_found_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_watch_state_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          annual_savings: number
          charter_document_url: string | null
          created_at: string
          created_by: string
          fee_tier: Database["public"]["Enums"]["fee_tier"]
          fee_tier_discount_pct: number
          id: string
          name: string
          total_family_assets: number
          updated_at: string
        }
        Insert: {
          annual_savings?: number
          charter_document_url?: string | null
          created_at?: string
          created_by: string
          fee_tier?: Database["public"]["Enums"]["fee_tier"]
          fee_tier_discount_pct?: number
          id?: string
          name: string
          total_family_assets?: number
          updated_at?: string
        }
        Update: {
          annual_savings?: number
          charter_document_url?: string | null
          created_at?: string
          created_by?: string
          fee_tier?: Database["public"]["Enums"]["fee_tier"]
          fee_tier_discount_pct?: number
          id?: string
          name?: string
          total_family_assets?: number
          updated_at?: string
        }
        Relationships: []
      }
      family_relationships: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          member_contact_id: string
          relationship_label: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          member_contact_id: string
          relationship_label?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          member_contact_id?: string
          relationship_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_relationships_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_relationships_member_contact_id_fkey"
            columns: ["member_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      georgia_analytics_sync_configs: {
        Row: {
          created_at: string
          destination_type: string
          id: string
          is_active: boolean
          last_error: string | null
          last_run_status: string | null
          last_synced_at: string | null
          spreadsheet_id: string
          updated_at: string
          worksheet_summary_name: string
          worksheet_traffic_name: string
        }
        Insert: {
          created_at?: string
          destination_type?: string
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_run_status?: string | null
          last_synced_at?: string | null
          spreadsheet_id: string
          updated_at?: string
          worksheet_summary_name?: string
          worksheet_traffic_name?: string
        }
        Update: {
          created_at?: string
          destination_type?: string
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_run_status?: string | null
          last_synced_at?: string | null
          spreadsheet_id?: string
          updated_at?: string
          worksheet_summary_name?: string
          worksheet_traffic_name?: string
        }
        Relationships: []
      }
      georgia_session_starts: {
        Row: {
          created_at: string
          id: string
          landing_path: string | null
          referrer: string | null
          session_key: string
          source: string
          started_at: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          landing_path?: string | null
          referrer?: string | null
          session_key: string
          source?: string
          started_at?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          landing_path?: string | null
          referrer?: string | null
          session_key?: string
          source?: string
          started_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      google_tokens: {
        Row: {
          access_token: string
          created_at: string
          id: string
          refresh_token: string
          scopes: string[]
          token_expiry: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          id?: string
          refresh_token: string
          scopes?: string[]
          token_expiry: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          refresh_token?: string
          scopes?: string[]
          token_expiry?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      holding_tank: {
        Row: {
          account_name: string
          account_number: string | null
          account_owner: string | null
          account_type: string
          book_value: number | null
          contact_id: string
          created_at: string
          current_value: number | null
          custodian: string | null
          expected_deposit_date: string | null
          household_id: string | null
          id: string
          notes: string | null
          source_file: string | null
          status: string
          updated_at: string
          visibility_scope: Database["public"]["Enums"]["visibility_scope"]
        }
        Insert: {
          account_name: string
          account_number?: string | null
          account_owner?: string | null
          account_type?: string
          book_value?: number | null
          contact_id: string
          created_at?: string
          current_value?: number | null
          custodian?: string | null
          expected_deposit_date?: string | null
          household_id?: string | null
          id?: string
          notes?: string | null
          source_file?: string | null
          status?: string
          updated_at?: string
          visibility_scope?: Database["public"]["Enums"]["visibility_scope"]
        }
        Update: {
          account_name?: string
          account_number?: string | null
          account_owner?: string | null
          account_type?: string
          book_value?: number | null
          contact_id?: string
          created_at?: string
          current_value?: number | null
          custodian?: string | null
          expected_deposit_date?: string | null
          household_id?: string | null
          id?: string
          notes?: string | null
          source_file?: string | null
          status?: string
          updated_at?: string
          visibility_scope?: Database["public"]["Enums"]["visibility_scope"]
        }
        Relationships: [
          {
            foreignKeyName: "holding_tank_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holding_tank_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_relationships: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          member_contact_id: string
          relationship_label: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          member_contact_id: string
          relationship_label?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          member_contact_id?: string
          relationship_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "household_relationships_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_relationships_member_contact_id_fkey"
            columns: ["member_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          address: string | null
          created_at: string
          family_id: string
          fiduciary_entity: Database["public"]["Enums"]["fiduciary_entity"]
          governance_status: Database["public"]["Enums"]["governance_status"]
          hof_visible: boolean
          id: string
          label: string
          quiet_period_start_date: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          family_id: string
          fiduciary_entity?: Database["public"]["Enums"]["fiduciary_entity"]
          governance_status?: Database["public"]["Enums"]["governance_status"]
          hof_visible?: boolean
          id?: string
          label?: string
          quiet_period_start_date?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          family_id?: string
          fiduciary_entity?: Database["public"]["Enums"]["fiduciary_entity"]
          governance_status?: Database["public"]["Enums"]["governance_status"]
          hof_visible?: boolean
          id?: string
          label?: string
          quiet_period_start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "households_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          category: string
          content: string
          created_at: string
          created_by: string
          file_path: string | null
          id: string
          is_active: boolean
          source_type: string
          target: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content?: string
          created_at?: string
          created_by: string
          file_path?: string | null
          id?: string
          is_active?: boolean
          source_type?: string
          target?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          created_by?: string
          file_path?: string | null
          id?: string
          is_active?: boolean
          source_type?: string
          target?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_update_reads: {
        Row: {
          contact_id: string
          id: string
          read_at: string
          update_id: string
        }
        Insert: {
          contact_id: string
          id?: string
          read_at?: string
          update_id: string
        }
        Update: {
          contact_id?: string
          id?: string
          read_at?: string
          update_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_update_reads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_update_reads_update_id_fkey"
            columns: ["update_id"]
            isOneToOne: false
            referencedRelation: "marketing_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_updates: {
        Row: {
          created_at: string
          id: string
          published_by: string
          scheduled_at: string | null
          sent: boolean
          target_contact_ids: string[] | null
          target_governance_status: string
          target_household_ids: string[] | null
          title: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          published_by: string
          scheduled_at?: string | null
          sent?: boolean
          target_contact_ids?: string[] | null
          target_governance_status?: string
          target_household_ids?: string[] | null
          title: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          published_by?: string
          scheduled_at?: string | null
          sent?: boolean
          target_contact_ids?: string[] | null
          target_governance_status?: string
          target_household_ids?: string[] | null
          title?: string
          url?: string
        }
        Relationships: []
      }
      portal_client_notifications: {
        Row: {
          body: string | null
          contact_id: string
          created_at: string
          id: string
          link_tab: string | null
          read: boolean
          source_type: string
          title: string
        }
        Insert: {
          body?: string | null
          contact_id: string
          created_at?: string
          id?: string
          link_tab?: string | null
          read?: boolean
          source_type?: string
          title: string
        }
        Update: {
          body?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          link_tab?: string | null
          read?: boolean
          source_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_client_notifications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_links: {
        Row: {
          created_at: string
          created_by: string
          group_label: string | null
          icon: string
          id: string
          is_active: boolean
          is_system: boolean
          label: string
          link_type: string
          sort_order: number
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by: string
          group_label?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          label: string
          link_type?: string
          sort_order?: number
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string
          group_label?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          label?: string
          link_type?: string
          sort_order?: number
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      portal_logins: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          login_method: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          login_method?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          login_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_logins_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_otps: {
        Row: {
          code: string
          contact_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          verified: boolean
        }
        Insert: {
          code: string
          contact_id: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          verified?: boolean
        }
        Update: {
          code?: string
          contact_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "portal_otps_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_request_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          request_id: string
          sender_name: string | null
          sender_type: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          request_id: string
          sender_name?: string | null
          sender_type: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          request_id?: string
          sender_name?: string | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_request_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "portal_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_requests: {
        Row: {
          contact_id: string
          created_at: string
          file_urls: string[] | null
          id: string
          request_description: string
          request_details: Json | null
          request_type: string
          resolved_at: string | null
          resolved_by: string | null
          staff_notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          file_urls?: string[] | null
          id?: string
          request_description: string
          request_details?: Json | null
          request_type: string
          resolved_at?: string | null
          resolved_by?: string | null
          staff_notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          file_urls?: string[] | null
          id?: string
          request_description?: string
          request_details?: Json | null
          request_type?: string
          resolved_at?: string | null
          resolved_by?: string | null
          staff_notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_requests_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_task_interactions: {
        Row: {
          contact_id: string
          id: string
          interacted_at: string
          task_gid: string
        }
        Insert: {
          contact_id: string
          id?: string
          interacted_at?: string
          task_gid: string
        }
        Update: {
          contact_id?: string
          id?: string
          interacted_at?: string
          task_gid?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_task_interactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_tokens: {
        Row: {
          contact_id: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          revoked: boolean
          token: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          revoked?: boolean
          token?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          revoked?: boolean
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_tokens_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
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
      quarterly_system_reviews: {
        Row: {
          alignment_overview: string
          charter_detail: string
          charter_status: string
          client_first_name: string
          client_last_name: string
          contact_id: string
          created_at: string
          created_by: string | null
          cross_system_detail: string
          cross_system_status: string
          footer_note: string
          gap_1: string
          gap_2: string
          gap_3: string
          gap_4: string
          gap_5: string
          generation_error: string | null
          generation_status: string
          id: string
          logic_trace: string | null
          priority_1: string
          priority_2: string
          priority_3: string
          priority_4: string
          priority_5: string
          review_date: string | null
          review_summary: string
          storehouse_detail: string
          storehouse_status: string
          updated_at: string
          vineyard_detail: string
          vineyard_status: string
        }
        Insert: {
          alignment_overview?: string
          charter_detail?: string
          charter_status?: string
          client_first_name?: string
          client_last_name?: string
          contact_id: string
          created_at?: string
          created_by?: string | null
          cross_system_detail?: string
          cross_system_status?: string
          footer_note?: string
          gap_1?: string
          gap_2?: string
          gap_3?: string
          gap_4?: string
          gap_5?: string
          generation_error?: string | null
          generation_status?: string
          id?: string
          logic_trace?: string | null
          priority_1?: string
          priority_2?: string
          priority_3?: string
          priority_4?: string
          priority_5?: string
          review_date?: string | null
          review_summary?: string
          storehouse_detail?: string
          storehouse_status?: string
          updated_at?: string
          vineyard_detail?: string
          vineyard_status?: string
        }
        Update: {
          alignment_overview?: string
          charter_detail?: string
          charter_status?: string
          client_first_name?: string
          client_last_name?: string
          contact_id?: string
          created_at?: string
          created_by?: string | null
          cross_system_detail?: string
          cross_system_status?: string
          footer_note?: string
          gap_1?: string
          gap_2?: string
          gap_3?: string
          gap_4?: string
          gap_5?: string
          generation_error?: string | null
          generation_status?: string
          id?: string
          logic_trace?: string | null
          priority_1?: string
          priority_2?: string
          priority_3?: string
          priority_4?: string
          priority_5?: string
          review_date?: string | null
          review_summary?: string
          storehouse_detail?: string
          storehouse_status?: string
          updated_at?: string
          vineyard_detail?: string
          vineyard_status?: string
        }
        Relationships: []
      }
      review_queue: {
        Row: {
          action_description: string
          action_type: string
          client_visible: boolean
          contact_id: string | null
          created_at: string
          created_by: string | null
          escalated_to: string | null
          family_id: string | null
          id: string
          logic_trace: string | null
          proposed_data: Json | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["review_status"]
          updated_at: string
        }
        Insert: {
          action_description: string
          action_type: string
          client_visible?: boolean
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          escalated_to?: string | null
          family_id?: string | null
          id?: string
          logic_trace?: string | null
          proposed_data?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          updated_at?: string
        }
        Update: {
          action_description?: string
          action_type?: string
          client_visible?: boolean
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          escalated_to?: string | null
          family_id?: string | null
          id?: string
          logic_trace?: string | null
          proposed_data?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_queue_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_queue_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_logs: {
        Row: {
          created_at: string
          id: string
          logic_trace: string
          run_id: string
          status: string
          test_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          logic_trace: string
          run_id: string
          status: string
          test_name: string
        }
        Update: {
          created_at?: string
          id?: string
          logic_trace?: string
          run_id?: string
          status?: string
          test_name?: string
        }
        Relationships: []
      }
      shareholders: {
        Row: {
          contact_id: string
          corporation_id: string
          created_at: string
          id: string
          is_active: boolean
          ownership_percentage: number
          role_title: string | null
          share_class: string | null
          updated_at: string
        }
        Insert: {
          contact_id: string
          corporation_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          ownership_percentage?: number
          role_title?: string | null
          share_class?: string | null
          updated_at?: string
        }
        Update: {
          contact_id?: string
          corporation_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          ownership_percentage?: number
          role_title?: string | null
          share_class?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shareholders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shareholders_corporation_id_fkey"
            columns: ["corporation_id"]
            isOneToOne: false
            referencedRelation: "corporations"
            referencedColumns: ["id"]
          },
        ]
      }
      sovereignty_audit_trail: {
        Row: {
          action_description: string
          action_type: string
          approved_at: string
          contact_id: string
          created_at: string
          id: string
          proposed_data: Json | null
          user_id: string
        }
        Insert: {
          action_description: string
          action_type: string
          approved_at?: string
          contact_id: string
          created_at?: string
          id?: string
          proposed_data?: Json | null
          user_id: string
        }
        Update: {
          action_description?: string
          action_type?: string
          approved_at?: string
          contact_id?: string
          created_at?: string
          id?: string
          proposed_data?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sovereignty_audit_trail_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      sovereignty_charter_sources: {
        Row: {
          charter_id: string | null
          contact_id: string
          content_text: string | null
          created_at: string
          created_by: string
          external_file_id: string | null
          external_folder_id: string | null
          external_modified_at: string | null
          extracted_text: string | null
          file_name: string | null
          id: string
          import_origin: string
          input_mode: string
          mime_type: string | null
          sort_order: number
          source_kind: string
          source_url: string | null
          storage_bucket: string | null
          storage_path: string | null
          sync_error: string | null
          title: string
          updated_at: string
        }
        Insert: {
          charter_id?: string | null
          contact_id: string
          content_text?: string | null
          created_at?: string
          created_by: string
          external_file_id?: string | null
          external_folder_id?: string | null
          external_modified_at?: string | null
          extracted_text?: string | null
          file_name?: string | null
          id?: string
          import_origin?: string
          input_mode?: string
          mime_type?: string | null
          sort_order?: number
          source_kind: string
          source_url?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          sync_error?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          charter_id?: string | null
          contact_id?: string
          content_text?: string | null
          created_at?: string
          created_by?: string
          external_file_id?: string | null
          external_folder_id?: string | null
          external_modified_at?: string | null
          extracted_text?: string | null
          file_name?: string | null
          id?: string
          import_origin?: string
          input_mode?: string
          mime_type?: string | null
          sort_order?: number
          source_kind?: string
          source_url?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          sync_error?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sovereignty_charter_sources_charter_id_fkey"
            columns: ["charter_id"]
            isOneToOne: false
            referencedRelation: "sovereignty_charters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sovereignty_charter_sources_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      sovereignty_charters: {
        Row: {
          appendix_note: string | null
          architecture_intro: string | null
          conflict_resolution: string | null
          contact_id: string
          created_at: string
          custom_sections: Json
          draft_status: string
          fiduciary_alliance: string | null
          footer_date_label: string | null
          footer_status: string | null
          full_markdown: string | null
          generation_summary: string | null
          governance_authority: string | null
          harvest_accounts_note: string | null
          id: string
          intro_callout: string | null
          intro_heading: string | null
          intro_note: string | null
          last_generated_at: string | null
          mission_of_capital: string | null
          protected_assets_note: string | null
          quiet_period: string | null
          ratified_at: string | null
          ratified_by: string | null
          subtitle: string | null
          title: string | null
          updated_at: string
          vision_20_year: string | null
        }
        Insert: {
          appendix_note?: string | null
          architecture_intro?: string | null
          conflict_resolution?: string | null
          contact_id: string
          created_at?: string
          custom_sections?: Json
          draft_status?: string
          fiduciary_alliance?: string | null
          footer_date_label?: string | null
          footer_status?: string | null
          full_markdown?: string | null
          generation_summary?: string | null
          governance_authority?: string | null
          harvest_accounts_note?: string | null
          id?: string
          intro_callout?: string | null
          intro_heading?: string | null
          intro_note?: string | null
          last_generated_at?: string | null
          mission_of_capital?: string | null
          protected_assets_note?: string | null
          quiet_period?: string | null
          ratified_at?: string | null
          ratified_by?: string | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string
          vision_20_year?: string | null
        }
        Update: {
          appendix_note?: string | null
          architecture_intro?: string | null
          conflict_resolution?: string | null
          contact_id?: string
          created_at?: string
          custom_sections?: Json
          draft_status?: string
          fiduciary_alliance?: string | null
          footer_date_label?: string | null
          footer_status?: string | null
          full_markdown?: string | null
          generation_summary?: string | null
          governance_authority?: string | null
          harvest_accounts_note?: string | null
          id?: string
          intro_callout?: string | null
          intro_heading?: string | null
          intro_note?: string | null
          last_generated_at?: string | null
          mission_of_capital?: string | null
          protected_assets_note?: string | null
          quiet_period?: string | null
          ratified_at?: string | null
          ratified_by?: string | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string
          vision_20_year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sovereignty_charters_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      stabilization_maps: {
        Row: {
          client_first_name: string
          client_last_name: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          event_type: string
          footer_note: string
          generation_error: string | null
          generation_status: string
          id: string
          lead_id: string | null
          logic_trace: string | null
          next_step_1: string
          next_step_2: string
          next_step_3: string
          next_step_4: string
          next_step_5: string
          risk_1: string
          risk_2: string
          risk_3: string
          risk_4: string
          risk_5: string
          session_date: string | null
          situation_summary: string
          solicitation_detail: string
          solicitation_status: string
          sovereignty_charter_detail: string
          sovereignty_charter_status: string
          storehouse_detail: string
          storehouse_status: string
          tax_detail: string
          tax_status: string
          updated_at: string
          urgency_flag: string
        }
        Insert: {
          client_first_name?: string
          client_last_name?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          event_type?: string
          footer_note?: string
          generation_error?: string | null
          generation_status?: string
          id?: string
          lead_id?: string | null
          logic_trace?: string | null
          next_step_1?: string
          next_step_2?: string
          next_step_3?: string
          next_step_4?: string
          next_step_5?: string
          risk_1?: string
          risk_2?: string
          risk_3?: string
          risk_4?: string
          risk_5?: string
          session_date?: string | null
          situation_summary?: string
          solicitation_detail?: string
          solicitation_status?: string
          sovereignty_charter_detail?: string
          sovereignty_charter_status?: string
          storehouse_detail?: string
          storehouse_status?: string
          tax_detail?: string
          tax_status?: string
          updated_at?: string
          urgency_flag?: string
        }
        Update: {
          client_first_name?: string
          client_last_name?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          event_type?: string
          footer_note?: string
          generation_error?: string | null
          generation_status?: string
          id?: string
          lead_id?: string | null
          logic_trace?: string | null
          next_step_1?: string
          next_step_2?: string
          next_step_3?: string
          next_step_4?: string
          next_step_5?: string
          risk_1?: string
          risk_2?: string
          risk_3?: string
          risk_4?: string
          risk_5?: string
          session_date?: string | null
          situation_summary?: string
          solicitation_detail?: string
          solicitation_status?: string
          sovereignty_charter_detail?: string
          sovereignty_charter_status?: string
          storehouse_detail?: string
          storehouse_status?: string
          tax_detail?: string
          tax_status?: string
          updated_at?: string
          urgency_flag?: string
        }
        Relationships: [
          {
            foreignKeyName: "stabilization_maps_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stabilization_maps_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "discovery_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_notifications: {
        Row: {
          body: string | null
          contact_id: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          source_type: string
          title: string
        }
        Insert: {
          body?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          source_type?: string
          title: string
        }
        Update: {
          body?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          source_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_notifications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      storehouse_rules: {
        Row: {
          created_at: string
          family_id: string
          id: string
          rule_description: string
          rule_metadata: Json | null
          rule_type: string
          rule_value: number | null
          storehouse_label: string
          storehouse_number: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          rule_description: string
          rule_metadata?: Json | null
          rule_type: string
          rule_value?: number | null
          storehouse_label: string
          storehouse_number: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          rule_description?: string
          rule_metadata?: Json | null
          rule_type?: string
          rule_value?: number | null
          storehouse_label?: string
          storehouse_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "storehouse_rules_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      storehouses: {
        Row: {
          asset_type: string | null
          book_value: number | null
          charter_alignment: Database["public"]["Enums"]["charter_alignment"]
          contact_id: string
          created_at: string
          current_value: number | null
          id: string
          label: string
          notes: string | null
          risk_cap: string | null
          storehouse_number: number
          target_value: number | null
          updated_at: string
          visibility_scope: Database["public"]["Enums"]["visibility_scope"]
        }
        Insert: {
          asset_type?: string | null
          book_value?: number | null
          charter_alignment?: Database["public"]["Enums"]["charter_alignment"]
          contact_id: string
          created_at?: string
          current_value?: number | null
          id?: string
          label?: string
          notes?: string | null
          risk_cap?: string | null
          storehouse_number: number
          target_value?: number | null
          updated_at?: string
          visibility_scope?: Database["public"]["Enums"]["visibility_scope"]
        }
        Update: {
          asset_type?: string | null
          book_value?: number | null
          charter_alignment?: Database["public"]["Enums"]["charter_alignment"]
          contact_id?: string
          created_at?: string
          current_value?: number | null
          id?: string
          label?: string
          notes?: string | null
          risk_cap?: string | null
          storehouse_number?: number
          target_value?: number | null
          updated_at?: string
          visibility_scope?: Database["public"]["Enums"]["visibility_scope"]
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
      task_collaborators: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          tagged_by: string
          task_gid: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          tagged_by: string
          task_gid: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          tagged_by?: string
          task_gid?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_collaborators_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      vineyard_accounts: {
        Row: {
          account_name: string
          account_number: string | null
          account_type: string
          book_value: number | null
          contact_id: string
          created_at: string
          current_value: number | null
          id: string
          notes: string | null
          updated_at: string
          visibility_scope: Database["public"]["Enums"]["visibility_scope"]
        }
        Insert: {
          account_name: string
          account_number?: string | null
          account_type?: string
          book_value?: number | null
          contact_id: string
          created_at?: string
          current_value?: number | null
          id?: string
          notes?: string | null
          updated_at?: string
          visibility_scope?: Database["public"]["Enums"]["visibility_scope"]
        }
        Update: {
          account_name?: string
          account_number?: string | null
          account_type?: string
          book_value?: number | null
          contact_id?: string
          created_at?: string
          current_value?: number | null
          id?: string
          notes?: string | null
          updated_at?: string
          visibility_scope?: Database["public"]["Enums"]["visibility_scope"]
        }
        Relationships: [
          {
            foreignKeyName: "vineyard_accounts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      waterfall_priorities: {
        Row: {
          created_at: string
          family_id: string
          id: string
          is_active: boolean
          priority_description: string | null
          priority_label: string
          priority_order: number
          target_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          is_active?: boolean
          priority_description?: string | null
          priority_label: string
          priority_order: number
          target_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          is_active?: boolean
          priority_description?: string | null
          priority_label?: string
          priority_order?: number
          target_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waterfall_priorities_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
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
      content_platform: "linkedin" | "substack" | "wix_blog"
      content_status: "draft" | "review" | "approved" | "published" | "archived"
      corporation_type: "opco" | "holdco" | "trust" | "partnership" | "other"
      family_role:
        | "head_of_family"
        | "spouse"
        | "beneficiary"
        | "minor"
        | "head_of_household"
      fee_tier: "sovereign" | "legacy" | "dynasty"
      fiduciary_entity: "pws" | "pwa"
      governance_status: "stabilization" | "sovereign" | "none" | "core"
      pipeline_category: "pws_consulting" | "new_aum" | "insurance"
      pipeline_status: "pending" | "in_process" | "completed"
      review_status: "pending" | "approved" | "rejected" | "escalated"
      visibility_scope: "private" | "household_shared" | "family_shared"
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
      content_platform: ["linkedin", "substack", "wix_blog"],
      content_status: ["draft", "review", "approved", "published", "archived"],
      corporation_type: ["opco", "holdco", "trust", "partnership", "other"],
      family_role: [
        "head_of_family",
        "spouse",
        "beneficiary",
        "minor",
        "head_of_household",
      ],
      fee_tier: ["sovereign", "legacy", "dynasty"],
      fiduciary_entity: ["pws", "pwa"],
      governance_status: ["stabilization", "sovereign", "none", "core"],
      pipeline_category: ["pws_consulting", "new_aum", "insurance"],
      pipeline_status: ["pending", "in_process", "completed"],
      review_status: ["pending", "approved", "rejected", "escalated"],
      visibility_scope: ["private", "household_shared", "family_shared"],
    },
  },
} as const
