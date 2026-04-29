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
      ai_advisor_conversations: {
        Row: {
          created_at: string
          id: string
          organization_id: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_advisor_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_advisor_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          tool_calls: Json | null
          tool_results: Json | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          tool_calls?: Json | null
          tool_results?: Json | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          tool_calls?: Json | null
          tool_results?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_advisor_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_advisor_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_actions: {
        Row: {
          audit_id: string | null
          conversation_id: string | null
          created_at: string
          id: string
          is_write: boolean
          organization_id: string | null
          reverted_at: string | null
          reverted_by: string | null
          status: string
          target_entity_id: string | null
          target_entity_type: string | null
          tool_input: Json
          tool_name: string
          tool_output: Json | null
          user_id: string
        }
        Insert: {
          audit_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          is_write?: boolean
          organization_id?: string | null
          reverted_at?: string | null
          reverted_by?: string | null
          status?: string
          target_entity_id?: string | null
          target_entity_type?: string | null
          tool_input?: Json
          tool_name: string
          tool_output?: Json | null
          user_id: string
        }
        Update: {
          audit_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          is_write?: boolean
          organization_id?: string | null
          reverted_at?: string | null
          reverted_by?: string | null
          status?: string
          target_entity_id?: string | null
          target_entity_type?: string | null
          tool_input?: Json
          tool_name?: string
          tool_output?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_actions_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "ai_audit_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_actions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_advisor_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_audit_log: {
        Row: {
          action_type: string
          created_at: string
          draft_payload: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json
          model: string | null
          organization_id: string | null
          output_summary: string | null
          parent_audit_id: string | null
          prompt_summary: string | null
          prompt_version: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_field: string | null
          target_language: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          draft_payload?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          model?: string | null
          organization_id?: string | null
          output_summary?: string | null
          parent_audit_id?: string | null
          prompt_summary?: string | null
          prompt_version?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_field?: string | null
          target_language?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          draft_payload?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          model?: string | null
          organization_id?: string | null
          output_summary?: string | null
          parent_audit_id?: string | null
          prompt_summary?: string | null
          prompt_version?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_field?: string | null
          target_language?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_audit_log_parent_audit_id_fkey"
            columns: ["parent_audit_id"]
            isOneToOne: false
            referencedRelation: "ai_audit_log"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_credit_ledger: {
        Row: {
          action_type: string
          amount: number
          created_at: string
          decision: string
          id: string
          metadata: Json
          model: string | null
          organization_id: string
          period_start: string
          user_id: string | null
        }
        Insert: {
          action_type: string
          amount?: number
          created_at?: string
          decision?: string
          id?: string
          metadata?: Json
          model?: string | null
          organization_id: string
          period_start: string
          user_id?: string | null
        }
        Update: {
          action_type?: string
          amount?: number
          created_at?: string
          decision?: string
          id?: string
          metadata?: Json
          model?: string | null
          organization_id?: string
          period_start?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_credit_ledger_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_credit_packs: {
        Row: {
          amount_usd: number
          created_at: string
          created_by: string | null
          credits: number
          currency: string
          description: string | null
          highlight: boolean
          id: string
          is_active: boolean
          name: string
          pack_key: string
          sort_order: number
          stripe_price_lookup_key: string | null
          stripe_product_id: string | null
          updated_at: string
        }
        Insert: {
          amount_usd: number
          created_at?: string
          created_by?: string | null
          credits: number
          currency?: string
          description?: string | null
          highlight?: boolean
          id?: string
          is_active?: boolean
          name: string
          pack_key: string
          sort_order?: number
          stripe_price_lookup_key?: string | null
          stripe_product_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          created_by?: string | null
          credits?: number
          currency?: string
          description?: string | null
          highlight?: boolean
          id?: string
          is_active?: boolean
          name?: string
          pack_key?: string
          sort_order?: number
          stripe_price_lookup_key?: string | null
          stripe_product_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_credit_purchases: {
        Row: {
          amount_cents: number
          created_at: string
          credits: number
          currency: string
          environment: string
          id: string
          metadata: Json
          organization_id: string
          pack_id: string
          period_start: string
          status: string
          stripe_payment_intent: string | null
          stripe_session_id: string | null
          user_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          credits: number
          currency?: string
          environment?: string
          id?: string
          metadata?: Json
          organization_id: string
          pack_id: string
          period_start: string
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          credits?: number
          currency?: string
          environment?: string
          id?: string
          metadata?: Json
          organization_id?: string
          pack_id?: string
          period_start?: string
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_credit_purchases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_credit_usage: {
        Row: {
          created_at: string
          id: string
          last_action: string | null
          last_model: string | null
          organization_id: string
          period_start: string
          purchased: number
          updated_at: string
          used: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_action?: string | null
          last_model?: string | null
          organization_id: string
          period_start: string
          purchased?: number
          updated_at?: string
          used?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_action?: string | null
          last_model?: string | null
          organization_id?: string
          period_start?: string
          purchased?: number
          updated_at?: string
          used?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_credit_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_insights: {
        Row: {
          created_at: string
          description: string | null
          detected_at: string
          dismissed: boolean
          dismissed_at: string | null
          dismissed_by: string | null
          evidence: Json | null
          expires_at: string | null
          generated_by: string
          id: string
          insight_type: string
          organization_id: string
          recommendation: string | null
          resolved: boolean
          scope_id: string | null
          scope_type: string | null
          severity: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          detected_at?: string
          dismissed?: boolean
          dismissed_at?: string | null
          dismissed_by?: string | null
          evidence?: Json | null
          expires_at?: string | null
          generated_by?: string
          id?: string
          insight_type: string
          organization_id: string
          recommendation?: string | null
          resolved?: boolean
          scope_id?: string | null
          scope_type?: string | null
          severity?: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          detected_at?: string
          dismissed?: boolean
          dismissed_at?: string | null
          dismissed_by?: string | null
          evidence?: Json | null
          expires_at?: string | null
          generated_by?: string
          id?: string
          insight_type?: string
          organization_id?: string
          recommendation?: string | null
          resolved?: boolean
          scope_id?: string | null
          scope_type?: string | null
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_provider_settings: {
        Row: {
          api_key_secret_name: string | null
          base_url: string | null
          created_at: string
          created_by: string | null
          default_model: string | null
          enabled_modules: Json
          id: string
          is_active: boolean
          notes: string | null
          organization_id: string | null
          provider: string
          scope: string
          updated_at: string
        }
        Insert: {
          api_key_secret_name?: string | null
          base_url?: string | null
          created_at?: string
          created_by?: string | null
          default_model?: string | null
          enabled_modules?: Json
          id?: string
          is_active?: boolean
          notes?: string | null
          organization_id?: string | null
          provider: string
          scope: string
          updated_at?: string
        }
        Update: {
          api_key_secret_name?: string | null
          base_url?: string | null
          created_at?: string
          created_by?: string | null
          default_model?: string | null
          enabled_modules?: Json
          id?: string
          is_active?: boolean
          notes?: string | null
          organization_id?: string | null
          provider?: string
          scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_provider_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_summaries: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          change_count_at_generation: number
          created_at: string
          draft_content: Json | null
          generated_at: string | null
          generated_by: string | null
          id: string
          is_stale: boolean
          last_audit_id: string | null
          model: string | null
          organization_id: string | null
          prompt_version: string | null
          published_content: Json | null
          scope_id: string
          scope_type: string
          status: string
          summary_kind: string
          translations: Json
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          change_count_at_generation?: number
          created_at?: string
          draft_content?: Json | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          is_stale?: boolean
          last_audit_id?: string | null
          model?: string | null
          organization_id?: string | null
          prompt_version?: string | null
          published_content?: Json | null
          scope_id: string
          scope_type: string
          status?: string
          summary_kind: string
          translations?: Json
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          change_count_at_generation?: number
          created_at?: string
          draft_content?: Json | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          is_stale?: boolean
          last_audit_id?: string | null
          model?: string | null
          organization_id?: string | null
          prompt_version?: string | null
          published_content?: Json | null
          scope_id?: string
          scope_type?: string
          status?: string
          summary_kind?: string
          translations?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_summaries_last_audit_id_fkey"
            columns: ["last_audit_id"]
            isOneToOne: false
            referencedRelation: "ai_audit_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_summaries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_evidence: {
        Row: {
          approval_id: string
          approval_type: string
          attested_at: string | null
          attested_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          document_id: string | null
          evidence_label: string
          id: string
          is_required: boolean
          organization_id: string
        }
        Insert: {
          approval_id: string
          approval_type: string
          attested_at?: string | null
          attested_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_id?: string | null
          evidence_label: string
          id?: string
          is_required?: boolean
          organization_id: string
        }
        Update: {
          approval_id?: string
          approval_type?: string
          attested_at?: string | null
          attested_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_id?: string | null
          evidence_label?: string
          id?: string
          is_required?: boolean
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_evidence_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_contracts: {
        Row: {
          auto_renew: boolean
          contract_number: string | null
          contract_type: string
          cost: number | null
          cost_currency: string | null
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          renewal_date: string | null
          start_date: string | null
          status: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          auto_renew?: boolean
          contract_number?: string | null
          contract_type?: string
          cost?: number | null
          cost_currency?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          renewal_date?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          auto_renew?: boolean
          contract_number?: string | null
          contract_type?: string
          cost?: number | null
          cost_currency?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          renewal_date?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: []
      }
      assets: {
        Row: {
          asset_tag: string
          assigned_to_user_id: string | null
          category: string
          ci_id: string | null
          created_at: string
          created_by: string | null
          department: string | null
          end_of_life_at: string | null
          id: string
          location: string | null
          manufacturer: string | null
          model: string | null
          name: string
          notes: string | null
          organization_id: string
          purchase_cost: number | null
          purchase_date: string | null
          serial_number: string | null
          status: string
          updated_at: string
          vendor: string | null
          warranty_expires_at: string | null
        }
        Insert: {
          asset_tag: string
          assigned_to_user_id?: string | null
          category?: string
          ci_id?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          end_of_life_at?: string | null
          id?: string
          location?: string | null
          manufacturer?: string | null
          model?: string | null
          name: string
          notes?: string | null
          organization_id: string
          purchase_cost?: number | null
          purchase_date?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
          vendor?: string | null
          warranty_expires_at?: string | null
        }
        Update: {
          asset_tag?: string
          assigned_to_user_id?: string | null
          category?: string
          ci_id?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          end_of_life_at?: string | null
          id?: string
          location?: string | null
          manufacturer?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          purchase_cost?: number | null
          purchase_date?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
          vendor?: string | null
          warranty_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_ci_id_fkey"
            columns: ["ci_id"]
            isOneToOne: false
            referencedRelation: "cmdb_ci_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_ci_id_fkey"
            columns: ["ci_id"]
            isOneToOne: false
            referencedRelation: "configuration_items"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log_retention_policies: {
        Row: {
          auto_purge_enabled: boolean
          created_at: string
          created_by: string | null
          id: string
          last_purged_at: string | null
          last_purged_count: number | null
          organization_id: string | null
          retention_days: number
          updated_at: string
        }
        Insert: {
          auto_purge_enabled?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          last_purged_at?: string | null
          last_purged_count?: number | null
          organization_id?: string | null
          retention_days?: number
          updated_at?: string
        }
        Update: {
          auto_purge_enabled?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          last_purged_at?: string | null
          last_purged_count?: number | null
          organization_id?: string | null
          retention_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_retention_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_audit_log: {
        Row: {
          created_at: string
          event_category: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          organization_id: string | null
          status: string
          target_entity_id: string | null
          target_entity_type: string | null
          target_user_id: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_category?: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          organization_id?: string | null
          status?: string
          target_entity_id?: string | null
          target_entity_type?: string | null
          target_user_id?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_category?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          organization_id?: string | null
          status?: string
          target_entity_id?: string | null
          target_entity_type?: string | null
          target_user_id?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_approvals: {
        Row: {
          assigned_to_role: string | null
          assigned_to_user_id: string | null
          context: Json
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision: string
          decision_comment: string | null
          description: string | null
          due_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          module: string
          organization_id: string
          run_id: string
          step_execution_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to_role?: string | null
          assigned_to_user_id?: string | null
          context?: Json
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string
          decision_comment?: string | null
          description?: string | null
          due_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          module: string
          organization_id: string
          run_id: string
          step_execution_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to_role?: string | null
          assigned_to_user_id?: string | null
          context?: Json
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string
          decision_comment?: string | null
          description?: string | null
          due_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          module?: string
          organization_id?: string
          run_id?: string
          step_execution_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_approvals_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_approvals_step_execution_id_fkey"
            columns: ["step_execution_id"]
            isOneToOne: false
            referencedRelation: "automation_step_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          completed_at: string | null
          context: Json
          created_at: string
          current_step_index: number
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          id: string
          module: string
          organization_id: string
          started_at: string | null
          status: string
          step_count: number
          trigger_event: string
          trigger_payload: Json
          triggered_by: string | null
          updated_at: string
          workflow_id: string
        }
        Insert: {
          completed_at?: string | null
          context?: Json
          created_at?: string
          current_step_index?: number
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          module: string
          organization_id: string
          started_at?: string | null
          status?: string
          step_count?: number
          trigger_event: string
          trigger_payload?: Json
          triggered_by?: string | null
          updated_at?: string
          workflow_id: string
        }
        Update: {
          completed_at?: string | null
          context?: Json
          created_at?: string
          current_step_index?: number
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          module?: string
          organization_id?: string
          started_at?: string | null
          status?: string
          step_count?: number
          trigger_event?: string
          trigger_payload?: Json
          triggered_by?: string | null
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "automation_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_step_executions: {
        Row: {
          ai_model: string | null
          ai_tokens: number | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          input: Json | null
          organization_id: string
          output: Json | null
          run_id: string
          started_at: string | null
          status: string
          step_index: number
          step_label: string | null
          step_type: string
        }
        Insert: {
          ai_model?: string | null
          ai_tokens?: number | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input?: Json | null
          organization_id: string
          output?: Json | null
          run_id: string
          started_at?: string | null
          status?: string
          step_index: number
          step_label?: string | null
          step_type: string
        }
        Update: {
          ai_model?: string | null
          ai_tokens?: number | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input?: Json | null
          organization_id?: string
          output?: Json | null
          run_id?: string
          started_at?: string | null
          status?: string
          step_index?: number
          step_label?: string | null
          step_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_step_executions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_step_executions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_workflows: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          match_conditions: Json
          module: string
          name: string
          organization_id: string
          priority: number
          steps: Json
          tags: string[] | null
          trigger_event: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          match_conditions?: Json
          module: string
          name: string
          organization_id: string
          priority?: number
          steps?: Json
          tags?: string[] | null
          trigger_event: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          match_conditions?: Json
          module?: string
          name?: string
          organization_id?: string
          priority?: number
          steps?: Json
          tags?: string[] | null
          trigger_event?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_workflows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      benefit_measurements: {
        Row: {
          actual_value: number | null
          benefit_id: string
          created_at: string
          evidence_document_id: string | null
          id: string
          measurement_date: string
          notes: string | null
          organization_id: string
          qualitative_status: string | null
          recorded_by: string | null
        }
        Insert: {
          actual_value?: number | null
          benefit_id: string
          created_at?: string
          evidence_document_id?: string | null
          id?: string
          measurement_date?: string
          notes?: string | null
          organization_id: string
          qualitative_status?: string | null
          recorded_by?: string | null
        }
        Update: {
          actual_value?: number | null
          benefit_id?: string
          created_at?: string
          evidence_document_id?: string | null
          id?: string
          measurement_date?: string
          notes?: string | null
          organization_id?: string
          qualitative_status?: string | null
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "benefit_measurements_benefit_id_fkey"
            columns: ["benefit_id"]
            isOneToOne: false
            referencedRelation: "benefits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benefit_measurements_evidence_document_id_fkey"
            columns: ["evidence_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      benefit_profiles: {
        Row: {
          baseline_date: string | null
          baseline_value: number | null
          benefit_id: string
          created_at: string
          created_by: string | null
          current_maturity_level: string | null
          dependencies: string | null
          dis_benefits: string | null
          id: string
          measurement_method: string | null
          measurement_unit: string | null
          organization_id: string
          profile_type: string
          qualitative_rubric: Json | null
          realization_owner: string | null
          target_date: string | null
          target_value: number | null
          trajectory: Json | null
          updated_at: string
        }
        Insert: {
          baseline_date?: string | null
          baseline_value?: number | null
          benefit_id: string
          created_at?: string
          created_by?: string | null
          current_maturity_level?: string | null
          dependencies?: string | null
          dis_benefits?: string | null
          id?: string
          measurement_method?: string | null
          measurement_unit?: string | null
          organization_id: string
          profile_type?: string
          qualitative_rubric?: Json | null
          realization_owner?: string | null
          target_date?: string | null
          target_value?: number | null
          trajectory?: Json | null
          updated_at?: string
        }
        Update: {
          baseline_date?: string | null
          baseline_value?: number | null
          benefit_id?: string
          created_at?: string
          created_by?: string | null
          current_maturity_level?: string | null
          dependencies?: string | null
          dis_benefits?: string | null
          id?: string
          measurement_method?: string | null
          measurement_unit?: string | null
          organization_id?: string
          profile_type?: string
          qualitative_rubric?: Json | null
          realization_owner?: string | null
          target_date?: string | null
          target_value?: number | null
          trajectory?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "benefit_profiles_benefit_id_fkey"
            columns: ["benefit_id"]
            isOneToOne: true
            referencedRelation: "benefits"
            referencedColumns: ["id"]
          },
        ]
      }
      benefits: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          current_value: string | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          organization_id: string
          owner_id: string | null
          product_id: string | null
          programme_id: string | null
          project_id: string | null
          realization: number
          reference_number: string | null
          start_date: string | null
          status: string
          target_value: string | null
          type: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          current_value?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          organization_id: string
          owner_id?: string | null
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          realization?: number
          reference_number?: string | null
          start_date?: string | null
          status?: string
          target_value?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          current_value?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          organization_id?: string
          owner_id?: string | null
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          realization?: number
          reference_number?: string | null
          start_date?: string | null
          status?: string
          target_value?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "benefits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benefits_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benefits_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benefits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      branding_settings: {
        Row: {
          accent_color: string | null
          app_name: string | null
          app_name_color: string | null
          app_tagline: string | null
          created_at: string
          feature_1_label: string | null
          feature_1_text: string | null
          feature_2_label: string | null
          feature_2_text: string | null
          feature_3_label: string | null
          feature_3_text: string | null
          feature_4_label: string | null
          feature_4_text: string | null
          font_family: string | null
          form_text_color: string | null
          header_font_size: string | null
          hero_description: string | null
          hero_text_color: string | null
          hero_title: string | null
          id: string
          login_bg_image_url: string | null
          login_bg_pattern: string | null
          login_button_text: string | null
          login_cta_text: string | null
          login_footer_text: string | null
          login_layout: string | null
          logo_size: string | null
          logo_url: string | null
          organization_id: string | null
          primary_color: string | null
          right_panel_bg_color: string | null
          secondary_color: string | null
          show_app_name: boolean
          show_features: boolean | null
          show_footer: boolean
          show_hero_description: boolean
          show_hero_title: boolean
          show_login_cta: boolean
          show_logo: boolean | null
          show_tagline: boolean
          show_welcome_message: boolean
          tagline_color: string | null
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          accent_color?: string | null
          app_name?: string | null
          app_name_color?: string | null
          app_tagline?: string | null
          created_at?: string
          feature_1_label?: string | null
          feature_1_text?: string | null
          feature_2_label?: string | null
          feature_2_text?: string | null
          feature_3_label?: string | null
          feature_3_text?: string | null
          feature_4_label?: string | null
          feature_4_text?: string | null
          font_family?: string | null
          form_text_color?: string | null
          header_font_size?: string | null
          hero_description?: string | null
          hero_text_color?: string | null
          hero_title?: string | null
          id?: string
          login_bg_image_url?: string | null
          login_bg_pattern?: string | null
          login_button_text?: string | null
          login_cta_text?: string | null
          login_footer_text?: string | null
          login_layout?: string | null
          logo_size?: string | null
          logo_url?: string | null
          organization_id?: string | null
          primary_color?: string | null
          right_panel_bg_color?: string | null
          secondary_color?: string | null
          show_app_name?: boolean
          show_features?: boolean | null
          show_footer?: boolean
          show_hero_description?: boolean
          show_hero_title?: boolean
          show_login_cta?: boolean
          show_logo?: boolean | null
          show_tagline?: boolean
          show_welcome_message?: boolean
          tagline_color?: string | null
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          accent_color?: string | null
          app_name?: string | null
          app_name_color?: string | null
          app_tagline?: string | null
          created_at?: string
          feature_1_label?: string | null
          feature_1_text?: string | null
          feature_2_label?: string | null
          feature_2_text?: string | null
          feature_3_label?: string | null
          feature_3_text?: string | null
          feature_4_label?: string | null
          feature_4_text?: string | null
          font_family?: string | null
          form_text_color?: string | null
          header_font_size?: string | null
          hero_description?: string | null
          hero_text_color?: string | null
          hero_title?: string | null
          id?: string
          login_bg_image_url?: string | null
          login_bg_pattern?: string | null
          login_button_text?: string | null
          login_cta_text?: string | null
          login_footer_text?: string | null
          login_layout?: string | null
          logo_size?: string | null
          logo_url?: string | null
          organization_id?: string | null
          primary_color?: string | null
          right_panel_bg_color?: string | null
          secondary_color?: string | null
          show_app_name?: boolean
          show_features?: boolean | null
          show_footer?: boolean
          show_hero_description?: boolean
          show_hero_title?: boolean
          show_login_cta?: boolean
          show_logo?: boolean | null
          show_tagline?: boolean
          show_welcome_message?: boolean
          tagline_color?: string | null
          updated_at?: string
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branding_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      business_requirements: {
        Row: {
          acceptance_criteria: string | null
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          organization_id: string
          owner_id: string | null
          priority: string
          product_id: string | null
          programme_id: string | null
          project_id: string | null
          rationale: string | null
          reference_number: string
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          acceptance_criteria?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id: string
          owner_id?: string | null
          priority?: string
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          rationale?: string | null
          reference_number: string
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          acceptance_criteria?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          owner_id?: string | null
          priority?: string
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          rationale?: string | null
          reference_number?: string
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_requirements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_requirements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_requirements_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_requirements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      change_management_activity: {
        Row: {
          actor_user_id: string | null
          change_id: string
          created_at: string
          event_type: string
          from_value: Json | null
          id: string
          notes: string | null
          organization_id: string
          to_value: Json | null
        }
        Insert: {
          actor_user_id?: string | null
          change_id: string
          created_at?: string
          event_type: string
          from_value?: Json | null
          id?: string
          notes?: string | null
          organization_id: string
          to_value?: Json | null
        }
        Update: {
          actor_user_id?: string | null
          change_id?: string
          created_at?: string
          event_type?: string
          from_value?: Json | null
          id?: string
          notes?: string | null
          organization_id?: string
          to_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "change_management_activity_change_id_fkey"
            columns: ["change_id"]
            isOneToOne: false
            referencedRelation: "change_management_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_management_activity_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      change_management_approvals: {
        Row: {
          approval_kind: Database["public"]["Enums"]["cm_approval_kind"]
          approver_id: string | null
          change_id: string
          created_at: string
          decided_at: string | null
          decision: Database["public"]["Enums"]["cm_approval_decision"]
          decision_notes: string | null
          id: string
          organization_id: string
          required: boolean
          sequence: number
          updated_at: string
        }
        Insert: {
          approval_kind: Database["public"]["Enums"]["cm_approval_kind"]
          approver_id?: string | null
          change_id: string
          created_at?: string
          decided_at?: string | null
          decision?: Database["public"]["Enums"]["cm_approval_decision"]
          decision_notes?: string | null
          id?: string
          organization_id: string
          required?: boolean
          sequence?: number
          updated_at?: string
        }
        Update: {
          approval_kind?: Database["public"]["Enums"]["cm_approval_kind"]
          approver_id?: string | null
          change_id?: string
          created_at?: string
          decided_at?: string | null
          decision?: Database["public"]["Enums"]["cm_approval_decision"]
          decision_notes?: string | null
          id?: string
          organization_id?: string
          required?: boolean
          sequence?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_management_approvals_change_id_fkey"
            columns: ["change_id"]
            isOneToOne: false
            referencedRelation: "change_management_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_management_approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      change_management_requests: {
        Row: {
          actual_end_at: string | null
          actual_start_at: string | null
          affected_services: string[] | null
          business_justification: string | null
          category: string | null
          change_type: Database["public"]["Enums"]["cm_change_type"]
          communication_plan: string | null
          cost_estimate: number | null
          created_at: string
          created_by: string | null
          description: string | null
          downtime_minutes: number | null
          downtime_required: boolean
          id: string
          impact: Database["public"]["Enums"]["cm_impact"]
          implementation_plan: string | null
          implementer_id: string | null
          metadata: Json
          organization_id: string
          owner_id: string | null
          planned_end_at: string | null
          planned_start_at: string | null
          product_id: string | null
          programme_id: string | null
          project_id: string | null
          reason: string | null
          reference_number: string | null
          related_ticket_id: string | null
          requested_by: string | null
          risk_score: number | null
          rollback_plan: string | null
          status: Database["public"]["Enums"]["cm_status"]
          test_plan: string | null
          title: string
          updated_at: string
          urgency: Database["public"]["Enums"]["cm_urgency"]
        }
        Insert: {
          actual_end_at?: string | null
          actual_start_at?: string | null
          affected_services?: string[] | null
          business_justification?: string | null
          category?: string | null
          change_type?: Database["public"]["Enums"]["cm_change_type"]
          communication_plan?: string | null
          cost_estimate?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          downtime_minutes?: number | null
          downtime_required?: boolean
          id?: string
          impact?: Database["public"]["Enums"]["cm_impact"]
          implementation_plan?: string | null
          implementer_id?: string | null
          metadata?: Json
          organization_id: string
          owner_id?: string | null
          planned_end_at?: string | null
          planned_start_at?: string | null
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          reason?: string | null
          reference_number?: string | null
          related_ticket_id?: string | null
          requested_by?: string | null
          risk_score?: number | null
          rollback_plan?: string | null
          status?: Database["public"]["Enums"]["cm_status"]
          test_plan?: string | null
          title: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["cm_urgency"]
        }
        Update: {
          actual_end_at?: string | null
          actual_start_at?: string | null
          affected_services?: string[] | null
          business_justification?: string | null
          category?: string | null
          change_type?: Database["public"]["Enums"]["cm_change_type"]
          communication_plan?: string | null
          cost_estimate?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          downtime_minutes?: number | null
          downtime_required?: boolean
          id?: string
          impact?: Database["public"]["Enums"]["cm_impact"]
          implementation_plan?: string | null
          implementer_id?: string | null
          metadata?: Json
          organization_id?: string
          owner_id?: string | null
          planned_end_at?: string | null
          planned_start_at?: string | null
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          reason?: string | null
          reference_number?: string | null
          related_ticket_id?: string | null
          requested_by?: string | null
          risk_score?: number | null
          rollback_plan?: string | null
          status?: Database["public"]["Enums"]["cm_status"]
          test_plan?: string | null
          title?: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["cm_urgency"]
        }
        Relationships: [
          {
            foreignKeyName: "change_management_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_management_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_management_requests_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_management_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_management_requests_related_ticket_id_fkey"
            columns: ["related_ticket_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      change_notification_settings: {
        Row: {
          created_at: string
          id: string
          notify_on_approval_decision: boolean
          notify_on_comment: boolean
          notify_on_impact_change: boolean
          notify_on_implementation_note: boolean
          notify_on_owner_change: boolean
          notify_on_progress_note: boolean
          notify_on_status_change: boolean
          notify_on_test_result: boolean
          notify_on_type_change: boolean
          notify_on_urgency_change: boolean
          organization_id: string
          require_comment_on_comment: boolean
          require_comment_on_impact: boolean
          require_comment_on_implementation: boolean
          require_comment_on_owner: boolean
          require_comment_on_progress: boolean
          require_comment_on_status: boolean
          require_comment_on_status_approved: boolean
          require_comment_on_status_cab_review: boolean
          require_comment_on_status_cancelled: boolean
          require_comment_on_status_closed: boolean
          require_comment_on_status_draft: boolean
          require_comment_on_status_failed: boolean
          require_comment_on_status_implemented: boolean
          require_comment_on_status_in_progress: boolean
          require_comment_on_status_in_review: boolean
          require_comment_on_status_needs_information: boolean
          require_comment_on_status_rejected: boolean
          require_comment_on_status_scheduled: boolean
          require_comment_on_status_submitted: boolean
          require_comment_on_test: boolean
          require_comment_on_type: boolean
          require_comment_on_urgency: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notify_on_approval_decision?: boolean
          notify_on_comment?: boolean
          notify_on_impact_change?: boolean
          notify_on_implementation_note?: boolean
          notify_on_owner_change?: boolean
          notify_on_progress_note?: boolean
          notify_on_status_change?: boolean
          notify_on_test_result?: boolean
          notify_on_type_change?: boolean
          notify_on_urgency_change?: boolean
          organization_id: string
          require_comment_on_comment?: boolean
          require_comment_on_impact?: boolean
          require_comment_on_implementation?: boolean
          require_comment_on_owner?: boolean
          require_comment_on_progress?: boolean
          require_comment_on_status?: boolean
          require_comment_on_status_approved?: boolean
          require_comment_on_status_cab_review?: boolean
          require_comment_on_status_cancelled?: boolean
          require_comment_on_status_closed?: boolean
          require_comment_on_status_draft?: boolean
          require_comment_on_status_failed?: boolean
          require_comment_on_status_implemented?: boolean
          require_comment_on_status_in_progress?: boolean
          require_comment_on_status_in_review?: boolean
          require_comment_on_status_needs_information?: boolean
          require_comment_on_status_rejected?: boolean
          require_comment_on_status_scheduled?: boolean
          require_comment_on_status_submitted?: boolean
          require_comment_on_test?: boolean
          require_comment_on_type?: boolean
          require_comment_on_urgency?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notify_on_approval_decision?: boolean
          notify_on_comment?: boolean
          notify_on_impact_change?: boolean
          notify_on_implementation_note?: boolean
          notify_on_owner_change?: boolean
          notify_on_progress_note?: boolean
          notify_on_status_change?: boolean
          notify_on_test_result?: boolean
          notify_on_type_change?: boolean
          notify_on_urgency_change?: boolean
          organization_id?: string
          require_comment_on_comment?: boolean
          require_comment_on_impact?: boolean
          require_comment_on_implementation?: boolean
          require_comment_on_owner?: boolean
          require_comment_on_progress?: boolean
          require_comment_on_status?: boolean
          require_comment_on_status_approved?: boolean
          require_comment_on_status_cab_review?: boolean
          require_comment_on_status_cancelled?: boolean
          require_comment_on_status_closed?: boolean
          require_comment_on_status_draft?: boolean
          require_comment_on_status_failed?: boolean
          require_comment_on_status_implemented?: boolean
          require_comment_on_status_in_progress?: boolean
          require_comment_on_status_in_review?: boolean
          require_comment_on_status_needs_information?: boolean
          require_comment_on_status_rejected?: boolean
          require_comment_on_status_scheduled?: boolean
          require_comment_on_status_submitted?: boolean
          require_comment_on_test?: boolean
          require_comment_on_type?: boolean
          require_comment_on_urgency?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "change_notification_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      change_requests: {
        Row: {
          approver_id: string | null
          benefits: string | null
          change_type: string
          cost_impact: number | null
          created_at: string
          created_by: string | null
          date_decided: string | null
          date_implemented: string | null
          date_raised: string
          date_required: string | null
          decided_by: string | null
          decision_notes: string | null
          description: string | null
          id: string
          impact_summary: string | null
          organization_id: string
          owner_id: string | null
          priority: string
          product_id: string | null
          programme_id: string | null
          project_id: string | null
          quality_impact: string | null
          raised_by: string | null
          reason: string | null
          reference_number: string
          risk_impact: string | null
          status: Database["public"]["Enums"]["change_status"]
          time_impact_days: number | null
          title: string
          updated_at: string
          verifier_id: string | null
        }
        Insert: {
          approver_id?: string | null
          benefits?: string | null
          change_type?: string
          cost_impact?: number | null
          created_at?: string
          created_by?: string | null
          date_decided?: string | null
          date_implemented?: string | null
          date_raised?: string
          date_required?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          description?: string | null
          id?: string
          impact_summary?: string | null
          organization_id: string
          owner_id?: string | null
          priority?: string
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          quality_impact?: string | null
          raised_by?: string | null
          reason?: string | null
          reference_number: string
          risk_impact?: string | null
          status?: Database["public"]["Enums"]["change_status"]
          time_impact_days?: number | null
          title: string
          updated_at?: string
          verifier_id?: string | null
        }
        Update: {
          approver_id?: string | null
          benefits?: string | null
          change_type?: string
          cost_impact?: number | null
          created_at?: string
          created_by?: string | null
          date_decided?: string | null
          date_implemented?: string | null
          date_raised?: string
          date_required?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          description?: string | null
          id?: string
          impact_summary?: string | null
          organization_id?: string
          owner_id?: string | null
          priority?: string
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          quality_impact?: string | null
          raised_by?: string | null
          reason?: string | null
          reference_number?: string
          risk_impact?: string | null
          status?: Database["public"]["Enums"]["change_status"]
          time_impact_days?: number | null
          title?: string
          updated_at?: string
          verifier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "change_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_requests_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      ci_relationships: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          organization_id: string
          relationship_type: string
          source_ci_id: string
          target_ci_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          relationship_type: string
          source_ci_id: string
          target_ci_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          relationship_type?: string
          source_ci_id?: string
          target_ci_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_relationships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_relationships_source_ci_id_fkey"
            columns: ["source_ci_id"]
            isOneToOne: false
            referencedRelation: "cmdb_ci_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_relationships_source_ci_id_fkey"
            columns: ["source_ci_id"]
            isOneToOne: false
            referencedRelation: "configuration_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_relationships_target_ci_id_fkey"
            columns: ["target_ci_id"]
            isOneToOne: false
            referencedRelation: "cmdb_ci_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_relationships_target_ci_id_fkey"
            columns: ["target_ci_id"]
            isOneToOne: false
            referencedRelation: "configuration_items"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_ticket_links: {
        Row: {
          ci_id: string
          created_at: string
          created_by: string | null
          id: string
          link_type: string
          notes: string | null
          organization_id: string
          ticket_id: string
        }
        Insert: {
          ci_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          link_type?: string
          notes?: string | null
          organization_id: string
          ticket_id: string
        }
        Update: {
          ci_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          link_type?: string
          notes?: string | null
          organization_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_ticket_links_ci_id_fkey"
            columns: ["ci_id"]
            isOneToOne: false
            referencedRelation: "cmdb_ci_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_ticket_links_ci_id_fkey"
            columns: ["ci_id"]
            isOneToOne: false
            referencedRelation: "configuration_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_ticket_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_ticket_links_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      client_engagements: {
        Row: {
          account_manager: string | null
          billed_to_date: number | null
          client_name: string
          contract_value: number | null
          created_at: string
          end_date: string | null
          engagement_code: string
          engagement_type: string
          id: string
          notes: string | null
          organization_id: string
          project_id: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_manager?: string | null
          billed_to_date?: number | null
          client_name: string
          contract_value?: number | null
          created_at?: string
          end_date?: string | null
          engagement_code: string
          engagement_type?: string
          id?: string
          notes?: string | null
          organization_id: string
          project_id?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_manager?: string | null
          billed_to_date?: number | null
          client_name?: string
          contract_value?: number | null
          created_at?: string
          end_date?: string | null
          engagement_code?: string
          engagement_type?: string
          id?: string
          notes?: string | null
          organization_id?: string
          project_id?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_engagements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_engagements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cm_workflow_approvals: {
        Row: {
          assigned_to_role: string | null
          assigned_to_user_id: string | null
          change_request_id: string | null
          context: Json
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision: string
          decision_comment: string | null
          description: string | null
          id: string
          organization_id: string
          run_id: string
          step_execution_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to_role?: string | null
          assigned_to_user_id?: string | null
          change_request_id?: string | null
          context?: Json
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string
          decision_comment?: string | null
          description?: string | null
          id?: string
          organization_id: string
          run_id: string
          step_execution_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to_role?: string | null
          assigned_to_user_id?: string | null
          change_request_id?: string | null
          context?: Json
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string
          decision_comment?: string | null
          description?: string | null
          id?: string
          organization_id?: string
          run_id?: string
          step_execution_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cm_workflow_approvals_change_request_id_fkey"
            columns: ["change_request_id"]
            isOneToOne: false
            referencedRelation: "change_management_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_workflow_approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_workflow_approvals_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "cm_workflow_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_workflow_approvals_step_execution_id_fkey"
            columns: ["step_execution_id"]
            isOneToOne: false
            referencedRelation: "cm_workflow_step_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      cm_workflow_categories: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cm_workflow_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cm_workflow_runs: {
        Row: {
          change_request_id: string | null
          completed_at: string | null
          context: Json
          created_at: string
          current_step_index: number
          error_message: string | null
          id: string
          organization_id: string
          started_at: string
          status: string
          step_count: number
          trigger_event: string
          trigger_payload: Json
          triggered_by: string | null
          updated_at: string
          workflow_id: string
        }
        Insert: {
          change_request_id?: string | null
          completed_at?: string | null
          context?: Json
          created_at?: string
          current_step_index?: number
          error_message?: string | null
          id?: string
          organization_id: string
          started_at?: string
          status?: string
          step_count?: number
          trigger_event: string
          trigger_payload?: Json
          triggered_by?: string | null
          updated_at?: string
          workflow_id: string
        }
        Update: {
          change_request_id?: string | null
          completed_at?: string | null
          context?: Json
          created_at?: string
          current_step_index?: number
          error_message?: string | null
          id?: string
          organization_id?: string
          started_at?: string
          status?: string
          step_count?: number
          trigger_event?: string
          trigger_payload?: Json
          triggered_by?: string | null
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cm_workflow_runs_change_request_id_fkey"
            columns: ["change_request_id"]
            isOneToOne: false
            referencedRelation: "change_management_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_workflow_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_workflow_runs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "cm_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      cm_workflow_step_executions: {
        Row: {
          ai_model: string | null
          ai_tokens: number | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          input: Json
          organization_id: string
          output: Json
          run_id: string
          started_at: string | null
          status: string
          step_index: number
          step_label: string | null
          step_type: string
        }
        Insert: {
          ai_model?: string | null
          ai_tokens?: number | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input?: Json
          organization_id: string
          output?: Json
          run_id: string
          started_at?: string | null
          status?: string
          step_index: number
          step_label?: string | null
          step_type: string
        }
        Update: {
          ai_model?: string | null
          ai_tokens?: number | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input?: Json
          organization_id?: string
          output?: Json
          run_id?: string
          started_at?: string | null
          status?: string
          step_index?: number
          step_label?: string | null
          step_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cm_workflow_step_executions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_workflow_step_executions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "cm_workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      cm_workflows: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          failure_count: number
          id: string
          is_enabled: boolean
          last_run_at: string | null
          match_conditions: Json
          name: string
          organization_id: string
          run_count: number
          steps: Json
          success_count: number
          trigger_config: Json
          trigger_event: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          failure_count?: number
          id?: string
          is_enabled?: boolean
          last_run_at?: string | null
          match_conditions?: Json
          name: string
          organization_id: string
          run_count?: number
          steps?: Json
          success_count?: number
          trigger_config?: Json
          trigger_event: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          failure_count?: number
          id?: string
          is_enabled?: boolean
          last_run_at?: string | null
          match_conditions?: Json
          name?: string
          organization_id?: string
          run_count?: number
          steps?: Json
          success_count?: number
          trigger_config?: Json
          trigger_event?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cm_workflows_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "cm_workflow_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_workflows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cmdb_ci_types: {
        Row: {
          category: string
          color: string
          created_at: string
          default_attributes: Json
          description: string | null
          icon: string
          id: string
          is_system: boolean
          key: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category?: string
          color?: string
          created_at?: string
          default_attributes?: Json
          description?: string | null
          icon?: string
          id?: string
          is_system?: boolean
          key: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          color?: string
          created_at?: string
          default_attributes?: Json
          description?: string | null
          icon?: string
          id?: string
          is_system?: boolean
          key?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      comms_packs: {
        Row: {
          created_at: string
          created_by: string
          email_html: string | null
          email_subject: string | null
          governance_report_id: string | null
          id: string
          organization_id: string
          pdf_summary: string | null
          period_end: string | null
          period_start: string | null
          published_at: string | null
          scope_id: string
          scope_type: string
          slack_markdown: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          email_html?: string | null
          email_subject?: string | null
          governance_report_id?: string | null
          id?: string
          organization_id: string
          pdf_summary?: string | null
          period_end?: string | null
          period_start?: string | null
          published_at?: string | null
          scope_id: string
          scope_type: string
          slack_markdown?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          email_html?: string | null
          email_subject?: string | null
          governance_report_id?: string | null
          id?: string
          organization_id?: string
          pdf_summary?: string | null
          period_end?: string | null
          period_start?: string | null
          published_at?: string | null
          scope_id?: string
          scope_type?: string
          slack_markdown?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comms_packs_governance_report_id_fkey"
            columns: ["governance_report_id"]
            isOneToOne: false
            referencedRelation: "governance_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comms_packs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_attestations: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          evidence_url: string | null
          expires_at: string | null
          id: string
          notes: string | null
          organization_id: string
          standard: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          evidence_url?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          standard: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          evidence_url?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          standard?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_attestations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_rule_configs: {
        Row: {
          cadence_window_days: number
          check_has_benefits: boolean
          check_has_issues: boolean
          check_has_milestones: boolean
          check_has_risks: boolean
          check_has_stakeholders: boolean
          check_orphan_issues: boolean
          check_orphan_risks: boolean
          check_recent_updates: boolean
          check_stale_issues: boolean
          check_stale_risks: boolean
          created_at: string
          id: string
          organization_id: string
          stale_window_days: number
          threshold_pass: number
          threshold_warn: number
          updated_at: string
          weight_cadence: number
          weight_controls: number
          weight_hygiene: number
        }
        Insert: {
          cadence_window_days?: number
          check_has_benefits?: boolean
          check_has_issues?: boolean
          check_has_milestones?: boolean
          check_has_risks?: boolean
          check_has_stakeholders?: boolean
          check_orphan_issues?: boolean
          check_orphan_risks?: boolean
          check_recent_updates?: boolean
          check_stale_issues?: boolean
          check_stale_risks?: boolean
          created_at?: string
          id?: string
          organization_id: string
          stale_window_days?: number
          threshold_pass?: number
          threshold_warn?: number
          updated_at?: string
          weight_cadence?: number
          weight_controls?: number
          weight_hygiene?: number
        }
        Update: {
          cadence_window_days?: number
          check_has_benefits?: boolean
          check_has_issues?: boolean
          check_has_milestones?: boolean
          check_has_risks?: boolean
          check_has_stakeholders?: boolean
          check_orphan_issues?: boolean
          check_orphan_risks?: boolean
          check_recent_updates?: boolean
          check_stale_issues?: boolean
          check_stale_risks?: boolean
          created_at?: string
          id?: string
          organization_id?: string
          stale_window_days?: number
          threshold_pass?: number
          threshold_warn?: number
          updated_at?: string
          weight_cadence?: number
          weight_controls?: number
          weight_hygiene?: number
        }
        Relationships: [
          {
            foreignKeyName: "compliance_rule_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_scores: {
        Row: {
          cadence_score: number
          computed_at: string
          controls_score: number
          created_at: string
          details: Json
          hygiene_score: number
          id: string
          organization_id: string
          scope_id: string
          scope_type: string
          score: number
        }
        Insert: {
          cadence_score?: number
          computed_at?: string
          controls_score?: number
          created_at?: string
          details?: Json
          hygiene_score?: number
          id?: string
          organization_id: string
          scope_id: string
          scope_type: string
          score: number
        }
        Update: {
          cadence_score?: number
          computed_at?: string
          controls_score?: number
          created_at?: string
          details?: Json
          hygiene_score?: number
          id?: string
          organization_id?: string
          scope_id?: string
          scope_type?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "compliance_scores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      configuration_items: {
        Row: {
          attributes: Json
          business_service: string | null
          ci_type_id: string
          cost_center: string | null
          created_at: string
          created_by: string | null
          criticality: string
          description: string | null
          environment: string | null
          external_id: string | null
          external_source: string | null
          id: string
          is_public_facing: boolean
          lifecycle_state: string
          location: string | null
          name: string
          organization_id: string
          owner_team: string | null
          owner_user_id: string | null
          product_id: string | null
          programme_id: string | null
          project_id: string | null
          reference_number: string | null
          retired_at: string | null
          status: string
          tags: string[]
          updated_at: string
          vendor: string | null
        }
        Insert: {
          attributes?: Json
          business_service?: string | null
          ci_type_id: string
          cost_center?: string | null
          created_at?: string
          created_by?: string | null
          criticality?: string
          description?: string | null
          environment?: string | null
          external_id?: string | null
          external_source?: string | null
          id?: string
          is_public_facing?: boolean
          lifecycle_state?: string
          location?: string | null
          name: string
          organization_id: string
          owner_team?: string | null
          owner_user_id?: string | null
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          reference_number?: string | null
          retired_at?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          attributes?: Json
          business_service?: string | null
          ci_type_id?: string
          cost_center?: string | null
          created_at?: string
          created_by?: string | null
          criticality?: string
          description?: string | null
          environment?: string | null
          external_id?: string | null
          external_source?: string | null
          id?: string
          is_public_facing?: boolean
          lifecycle_state?: string
          location?: string | null
          name?: string
          organization_id?: string
          owner_team?: string | null
          owner_user_id?: string | null
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          reference_number?: string | null
          retired_at?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "configuration_items_ci_type_id_fkey"
            columns: ["ci_type_id"]
            isOneToOne: false
            referencedRelation: "cmdb_ci_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "configuration_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      construction_report_log: {
        Row: {
          delivered_count: number
          failed_count: number
          generated_at: string
          id: string
          organization_id: string
          period_end: string
          period_start: string
          project_id: string
          recipients_count: number
          report_kind: string
          status: string
          summary: Json
        }
        Insert: {
          delivered_count?: number
          failed_count?: number
          generated_at?: string
          id?: string
          organization_id: string
          period_end: string
          period_start: string
          project_id: string
          recipients_count?: number
          report_kind?: string
          status?: string
          summary?: Json
        }
        Update: {
          delivered_count?: number
          failed_count?: number
          generated_at?: string
          id?: string
          organization_id?: string
          period_end?: string
          period_start?: string
          project_id?: string
          recipients_count?: number
          report_kind?: string
          status?: string
          summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "construction_report_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_report_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      csat_responses: {
        Row: {
          comment: string | null
          created_at: string
          expires_at: string | null
          follow_up_answer: string | null
          id: string
          organization_id: string
          rating: number | null
          reporter_email: string | null
          responded_at: string | null
          sent_at: string | null
          ticket_id: string
          token: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          expires_at?: string | null
          follow_up_answer?: string | null
          id?: string
          organization_id: string
          rating?: number | null
          reporter_email?: string | null
          responded_at?: string | null
          sent_at?: string | null
          ticket_id: string
          token: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          expires_at?: string | null
          follow_up_answer?: string | null
          id?: string
          organization_id?: string
          rating?: number | null
          reporter_email?: string | null
          responded_at?: string | null
          sent_at?: string | null
          ticket_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "csat_responses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "csat_responses_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "helpdesk_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      csat_surveys: {
        Row: {
          comment_label: string
          created_at: string
          enabled: boolean
          follow_up_label: string | null
          id: string
          intro_text: string
          min_priority: string | null
          organization_id: string
          rating_label: string
          rating_scale: number
          send_delay_hours: number
          thank_you_message: string
          ticket_types: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          comment_label?: string
          created_at?: string
          enabled?: boolean
          follow_up_label?: string | null
          id?: string
          intro_text?: string
          min_priority?: string | null
          organization_id: string
          rating_label?: string
          rating_scale?: number
          send_delay_hours?: number
          thank_you_message?: string
          ticket_types?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          comment_label?: string
          created_at?: string
          enabled?: boolean
          follow_up_label?: string | null
          id?: string
          intro_text?: string
          min_priority?: string | null
          organization_id?: string
          rating_label?: string
          rating_scale?: number
          send_delay_hours?: number
          thank_you_message?: string
          ticket_types?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "csat_surveys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_roles: {
        Row: {
          can_approve_ai_output: boolean
          can_draft_with_ai: boolean
          can_manage_ai_credits: boolean
          can_manage_benefits: boolean | null
          can_manage_change_requests: boolean | null
          can_manage_compliance: boolean
          can_manage_exceptions: boolean | null
          can_manage_integrations: boolean
          can_manage_issues: boolean | null
          can_manage_lessons: boolean | null
          can_manage_milestones: boolean | null
          can_manage_platform: boolean
          can_manage_products: boolean | null
          can_manage_programmes: boolean | null
          can_manage_projects: boolean | null
          can_manage_quality: boolean | null
          can_manage_regions: boolean
          can_manage_requirements: boolean | null
          can_manage_risks: boolean | null
          can_manage_stage_gates: boolean | null
          can_manage_stakeholder_portal: boolean
          can_manage_stakeholders: boolean | null
          can_manage_templates: boolean
          can_manage_tranches: boolean | null
          can_manage_translations: boolean
          can_manage_users: boolean | null
          can_manage_work_packages: boolean | null
          can_publish_comms: boolean
          can_view_ai_advisor: boolean
          can_view_ai_insights: boolean
          can_view_audit_log: boolean
          can_view_reports: boolean | null
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_system: boolean | null
          name: string
          permissions: Json | null
          updated_at: string
        }
        Insert: {
          can_approve_ai_output?: boolean
          can_draft_with_ai?: boolean
          can_manage_ai_credits?: boolean
          can_manage_benefits?: boolean | null
          can_manage_change_requests?: boolean | null
          can_manage_compliance?: boolean
          can_manage_exceptions?: boolean | null
          can_manage_integrations?: boolean
          can_manage_issues?: boolean | null
          can_manage_lessons?: boolean | null
          can_manage_milestones?: boolean | null
          can_manage_platform?: boolean
          can_manage_products?: boolean | null
          can_manage_programmes?: boolean | null
          can_manage_projects?: boolean | null
          can_manage_quality?: boolean | null
          can_manage_regions?: boolean
          can_manage_requirements?: boolean | null
          can_manage_risks?: boolean | null
          can_manage_stage_gates?: boolean | null
          can_manage_stakeholder_portal?: boolean
          can_manage_stakeholders?: boolean | null
          can_manage_templates?: boolean
          can_manage_tranches?: boolean | null
          can_manage_translations?: boolean
          can_manage_users?: boolean | null
          can_manage_work_packages?: boolean | null
          can_publish_comms?: boolean
          can_view_ai_advisor?: boolean
          can_view_ai_insights?: boolean
          can_view_audit_log?: boolean
          can_view_reports?: boolean | null
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          permissions?: Json | null
          updated_at?: string
        }
        Update: {
          can_approve_ai_output?: boolean
          can_draft_with_ai?: boolean
          can_manage_ai_credits?: boolean
          can_manage_benefits?: boolean | null
          can_manage_change_requests?: boolean | null
          can_manage_compliance?: boolean
          can_manage_exceptions?: boolean | null
          can_manage_integrations?: boolean
          can_manage_issues?: boolean | null
          can_manage_lessons?: boolean | null
          can_manage_milestones?: boolean | null
          can_manage_platform?: boolean
          can_manage_products?: boolean | null
          can_manage_programmes?: boolean | null
          can_manage_projects?: boolean | null
          can_manage_quality?: boolean | null
          can_manage_regions?: boolean
          can_manage_requirements?: boolean | null
          can_manage_risks?: boolean | null
          can_manage_stage_gates?: boolean | null
          can_manage_stakeholder_portal?: boolean
          can_manage_stakeholders?: boolean | null
          can_manage_templates?: boolean
          can_manage_tranches?: boolean | null
          can_manage_translations?: boolean
          can_manage_users?: boolean | null
          can_manage_work_packages?: boolean | null
          can_publish_comms?: boolean
          can_view_ai_advisor?: boolean
          can_view_ai_insights?: boolean
          can_view_audit_log?: boolean
          can_view_reports?: boolean | null
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          permissions?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      daily_logs: {
        Row: {
          created_at: string
          created_by: string | null
          crew_count: number | null
          delays: string | null
          hours_worked: number | null
          id: string
          log_date: string
          notes: string | null
          organization_id: string
          project_id: string | null
          safety_incidents: string | null
          updated_at: string
          visitors: string | null
          weather: string | null
          work_performed: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          crew_count?: number | null
          delays?: string | null
          hours_worked?: number | null
          id?: string
          log_date?: string
          notes?: string | null
          organization_id: string
          project_id?: string | null
          safety_incidents?: string | null
          updated_at?: string
          visitors?: string | null
          weather?: string | null
          work_performed?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          crew_count?: number | null
          delays?: string | null
          hours_worked?: number | null
          id?: string
          log_date?: string
          notes?: string | null
          organization_id?: string
          project_id?: string | null
          safety_incidents?: string | null
          updated_at?: string
          visitors?: string | null
          weather?: string | null
          work_performed?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          name: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          name: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          name?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      domain_verifications: {
        Row: {
          created_at: string
          created_by: string | null
          domain: string
          id: string
          last_checked_at: string | null
          organization_id: string
          status: string
          updated_at: string
          verification_token: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          domain: string
          id?: string
          last_checked_at?: string | null
          organization_id: string
          status?: string
          updated_at?: string
          verification_token?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          domain?: string
          id?: string
          last_checked_at?: string | null
          organization_id?: string
          status?: string
          updated_at?: string
          verification_token?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "domain_verifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_settings: {
        Row: {
          active_transport: Database["public"]["Enums"]["email_transport"]
          created_at: string
          from_address: string | null
          from_name: string | null
          id: string
          last_test_at: string | null
          last_test_error: string | null
          last_test_status: string | null
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active_transport?: Database["public"]["Enums"]["email_transport"]
          created_at?: string
          from_address?: string | null
          from_name?: string | null
          id?: string
          last_test_at?: string | null
          last_test_error?: string | null
          last_test_status?: string | null
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active_transport?: Database["public"]["Enums"]["email_transport"]
          created_at?: string
          from_address?: string | null
          from_name?: string | null
          id?: string
          last_test_at?: string | null
          last_test_error?: string | null
          last_test_status?: string | null
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      entity_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          organization_id: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          organization_id?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          organization_id?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          changed_fields: string[]
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
          organization_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          changed_fields?: string[]
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json
          organization_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          changed_fields?: string[]
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json
          organization_id?: string
        }
        Relationships: []
      }
      entity_updates: {
        Row: {
          created_at: string
          created_by: string
          entity_id: string
          entity_type: string
          id: string
          is_risk_flagged: boolean
          organization_id: string
          risk_criticality: string | null
          update_text: string
        }
        Insert: {
          created_at?: string
          created_by: string
          entity_id: string
          entity_type: string
          id?: string
          is_risk_flagged?: boolean
          organization_id: string
          risk_criticality?: string | null
          update_text: string
        }
        Update: {
          created_at?: string
          created_by?: string
          entity_id?: string
          entity_type?: string
          id?: string
          is_risk_flagged?: boolean
          organization_id?: string
          risk_criticality?: string | null
          update_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_updates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      exception_assessments: {
        Row: {
          assessed_at: string
          assessed_by: string | null
          cost_estimate: number | null
          created_at: string
          exception_id: string
          id: string
          impact_summary: string | null
          options_considered: Json | null
          organization_id: string
          recommendation: string | null
          recommended_option: string | null
          time_estimate_days: number | null
          updated_at: string
        }
        Insert: {
          assessed_at?: string
          assessed_by?: string | null
          cost_estimate?: number | null
          created_at?: string
          exception_id: string
          id?: string
          impact_summary?: string | null
          options_considered?: Json | null
          organization_id: string
          recommendation?: string | null
          recommended_option?: string | null
          time_estimate_days?: number | null
          updated_at?: string
        }
        Update: {
          assessed_at?: string
          assessed_by?: string | null
          cost_estimate?: number | null
          created_at?: string
          exception_id?: string
          id?: string
          impact_summary?: string | null
          options_considered?: Json | null
          organization_id?: string
          recommendation?: string | null
          recommended_option?: string | null
          time_estimate_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exception_assessments_exception_id_fkey"
            columns: ["exception_id"]
            isOneToOne: false
            referencedRelation: "exceptions"
            referencedColumns: ["id"]
          },
        ]
      }
      exception_lifecycle_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          exception_id: string
          id: string
          metadata: Json | null
          notes: string | null
          organization_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          exception_id: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          organization_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          exception_id?: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exception_lifecycle_events_exception_id_fkey"
            columns: ["exception_id"]
            isOneToOne: false
            referencedRelation: "exceptions"
            referencedColumns: ["id"]
          },
        ]
      }
      exceptions: {
        Row: {
          cause: string | null
          created_at: string
          created_by: string | null
          current_forecast: string | null
          date_raised: string
          description: string | null
          escalated_to: string | null
          escalation_date: string | null
          escalation_notes: string | null
          exception_type: string
          id: string
          impact: string | null
          options: string[] | null
          organization_id: string
          original_tolerance: string | null
          owner_id: string | null
          product_id: string | null
          programme_id: string | null
          project_id: string | null
          raised_by: string | null
          recommendation: string | null
          reference_number: string
          resolution: string | null
          resolution_date: string | null
          resolved_by: string | null
          severity: string
          status: Database["public"]["Enums"]["exception_status"]
          title: string
          tolerance_type: string | null
          updated_at: string
          variance: string | null
        }
        Insert: {
          cause?: string | null
          created_at?: string
          created_by?: string | null
          current_forecast?: string | null
          date_raised?: string
          description?: string | null
          escalated_to?: string | null
          escalation_date?: string | null
          escalation_notes?: string | null
          exception_type?: string
          id?: string
          impact?: string | null
          options?: string[] | null
          organization_id: string
          original_tolerance?: string | null
          owner_id?: string | null
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          raised_by?: string | null
          recommendation?: string | null
          reference_number: string
          resolution?: string | null
          resolution_date?: string | null
          resolved_by?: string | null
          severity?: string
          status?: Database["public"]["Enums"]["exception_status"]
          title: string
          tolerance_type?: string | null
          updated_at?: string
          variance?: string | null
        }
        Update: {
          cause?: string | null
          created_at?: string
          created_by?: string | null
          current_forecast?: string | null
          date_raised?: string
          description?: string | null
          escalated_to?: string | null
          escalation_date?: string | null
          escalation_notes?: string | null
          exception_type?: string
          id?: string
          impact?: string | null
          options?: string[] | null
          organization_id?: string
          original_tolerance?: string | null
          owner_id?: string | null
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          raised_by?: string | null
          recommendation?: string | null
          reference_number?: string
          resolution?: string | null
          resolution_date?: string | null
          resolved_by?: string | null
          severity?: string
          status?: Database["public"]["Enums"]["exception_status"]
          title?: string
          tolerance_type?: string | null
          updated_at?: string
          variance?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exceptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exceptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exceptions_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exceptions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_dependencies: {
        Row: {
          created_at: string
          created_by: string | null
          dependency_type: string
          depends_on_id: string
          description: string | null
          feature_id: string
          id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dependency_type?: string
          depends_on_id: string
          description?: string | null
          feature_id: string
          id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dependency_type?: string
          depends_on_id?: string
          description?: string | null
          feature_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_dependencies_depends_on_id_fkey"
            columns: ["depends_on_id"]
            isOneToOne: false
            referencedRelation: "product_features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_dependencies_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "product_features"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_reports: {
        Row: {
          ai_model: string | null
          ai_prompt_version: string | null
          approved_at: string | null
          approved_by: string | null
          content: Json
          created_at: string
          created_by: string
          generated_by: string | null
          id: string
          organization_id: string
          period_end: string | null
          period_start: string | null
          published_at: string | null
          report_type: string
          scope_id: string
          scope_type: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          ai_model?: string | null
          ai_prompt_version?: string | null
          approved_at?: string | null
          approved_by?: string | null
          content?: Json
          created_at?: string
          created_by: string
          generated_by?: string | null
          id?: string
          organization_id: string
          period_end?: string | null
          period_start?: string | null
          published_at?: string | null
          report_type: string
          scope_id: string
          scope_type: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          ai_model?: string | null
          ai_prompt_version?: string | null
          approved_at?: string | null
          approved_by?: string | null
          content?: Json
          created_at?: string
          created_by?: string
          generated_by?: string | null
          id?: string
          organization_id?: string
          period_end?: string | null
          period_start?: string | null
          published_at?: string | null
          report_type?: string
          scope_id?: string
          scope_type?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      helpdesk_approval_chain_steps: {
        Row: {
          approver_role: string | null
          approver_type: string
          approver_user_id: string | null
          chain_id: string
          created_at: string
          id: string
          is_optional: boolean
          name: string
          organization_id: string
          step_order: number
        }
        Insert: {
          approver_role?: string | null
          approver_type?: string
          approver_user_id?: string | null
          chain_id: string
          created_at?: string
          id?: string
          is_optional?: boolean
          name: string
          organization_id: string
          step_order?: number
        }
        Update: {
          approver_role?: string | null
          approver_type?: string
          approver_user_id?: string | null
          chain_id?: string
          created_at?: string
          id?: string
          is_optional?: boolean
          name?: string
          organization_id?: string
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "helpdesk_approval_chain_steps_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_approval_chains"
            referencedColumns: ["id"]
          },
        ]
      }
      helpdesk_approval_chains: {
        Row: {
          auto_approve_on_complete: boolean
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          mode: string
          name: string
          organization_id: string
          priority: number
          required_approvals: number
          trigger_catalog_item_id: string | null
          trigger_category: string | null
          trigger_min_cost: number | null
          trigger_priority: string | null
          trigger_ticket_type: string | null
          updated_at: string
        }
        Insert: {
          auto_approve_on_complete?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          mode?: string
          name: string
          organization_id: string
          priority?: number
          required_approvals?: number
          trigger_catalog_item_id?: string | null
          trigger_category?: string | null
          trigger_min_cost?: number | null
          trigger_priority?: string | null
          trigger_ticket_type?: string | null
          updated_at?: string
        }
        Update: {
          auto_approve_on_complete?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          mode?: string
          name?: string
          organization_id?: string
          priority?: number
          required_approvals?: number
          trigger_catalog_item_id?: string | null
          trigger_category?: string | null
          trigger_min_cost?: number | null
          trigger_priority?: string | null
          trigger_ticket_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      helpdesk_catalog_items: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          list_id: string
          metadata: Json
          name: string
          organization_id: string
          parent_item_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          list_id: string
          metadata?: Json
          name: string
          organization_id: string
          parent_item_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          list_id?: string
          metadata?: Json
          name?: string
          organization_id?: string
          parent_item_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "helpdesk_catalog_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_catalog_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helpdesk_catalog_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helpdesk_catalog_items_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_catalog_items"
            referencedColumns: ["id"]
          },
        ]
      }
      helpdesk_catalog_lists: {
        Row: {
          allow_multiple: boolean
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          key: string
          name: string
          organization_id: string
          required_for_types: string[]
          sort_order: number
          updated_at: string
        }
        Insert: {
          allow_multiple?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          key: string
          name: string
          organization_id: string
          required_for_types?: string[]
          sort_order?: number
          updated_at?: string
        }
        Update: {
          allow_multiple?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          organization_id?: string
          required_for_types?: string[]
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "helpdesk_catalog_lists_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      helpdesk_email_inboxes: {
        Row: {
          auto_reply_body: string | null
          auto_reply_enabled: boolean
          auto_reply_subject: string | null
          created_at: string
          created_by: string | null
          default_assignee_id: string | null
          default_category: string | null
          default_channel_id: string | null
          default_priority: string
          display_name: string | null
          email_address: string
          id: string
          is_active: boolean
          organization_id: string
          spam_filter_enabled: boolean
          updated_at: string
        }
        Insert: {
          auto_reply_body?: string | null
          auto_reply_enabled?: boolean
          auto_reply_subject?: string | null
          created_at?: string
          created_by?: string | null
          default_assignee_id?: string | null
          default_category?: string | null
          default_channel_id?: string | null
          default_priority?: string
          display_name?: string | null
          email_address: string
          id?: string
          is_active?: boolean
          organization_id: string
          spam_filter_enabled?: boolean
          updated_at?: string
        }
        Update: {
          auto_reply_body?: string | null
          auto_reply_enabled?: boolean
          auto_reply_subject?: string | null
          created_at?: string
          created_by?: string | null
          default_assignee_id?: string | null
          default_category?: string | null
          default_channel_id?: string | null
          default_priority?: string
          display_name?: string | null
          email_address?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          spam_filter_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "helpdesk_email_inboxes_default_channel_id_fkey"
            columns: ["default_channel_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_intake_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      helpdesk_email_log: {
        Row: {
          body_html: string | null
          body_text: string | null
          created_at: string
          direction: string
          error_message: string | null
          from_address: string | null
          id: string
          message_id: string | null
          organization_id: string | null
          processed_at: string | null
          raw_payload: Json | null
          status: string
          subject: string | null
          ticket_id: string | null
          to_address: string | null
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          direction?: string
          error_message?: string | null
          from_address?: string | null
          id?: string
          message_id?: string | null
          organization_id?: string | null
          processed_at?: string | null
          raw_payload?: Json | null
          status?: string
          subject?: string | null
          ticket_id?: string | null
          to_address?: string | null
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          direction?: string
          error_message?: string | null
          from_address?: string | null
          id?: string
          message_id?: string | null
          organization_id?: string | null
          processed_at?: string | null
          raw_payload?: Json | null
          status?: string
          subject?: string | null
          ticket_id?: string | null
          to_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "helpdesk_email_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helpdesk_email_log_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      helpdesk_email_messages: {
        Row: {
          attachments: Json
          body_html: string | null
          body_text: string | null
          cc_emails: string[] | null
          created_at: string
          direction: string
          error_message: string | null
          from_email: string
          from_name: string | null
          id: string
          in_reply_to: string | null
          inbox_id: string | null
          is_auto_reply: boolean
          is_spam: boolean
          message_id: string | null
          organization_id: string
          processing_status: string
          raw_headers: Json | null
          received_at: string
          references_ids: string[] | null
          subject: string | null
          ticket_id: string | null
          to_email: string | null
        }
        Insert: {
          attachments?: Json
          body_html?: string | null
          body_text?: string | null
          cc_emails?: string[] | null
          created_at?: string
          direction?: string
          error_message?: string | null
          from_email: string
          from_name?: string | null
          id?: string
          in_reply_to?: string | null
          inbox_id?: string | null
          is_auto_reply?: boolean
          is_spam?: boolean
          message_id?: string | null
          organization_id: string
          processing_status?: string
          raw_headers?: Json | null
          received_at?: string
          references_ids?: string[] | null
          subject?: string | null
          ticket_id?: string | null
          to_email?: string | null
        }
        Update: {
          attachments?: Json
          body_html?: string | null
          body_text?: string | null
          cc_emails?: string[] | null
          created_at?: string
          direction?: string
          error_message?: string | null
          from_email?: string
          from_name?: string | null
          id?: string
          in_reply_to?: string | null
          inbox_id?: string | null
          is_auto_reply?: boolean
          is_spam?: boolean
          message_id?: string | null
          organization_id?: string
          processing_status?: string
          raw_headers?: Json | null
          received_at?: string
          references_ids?: string[] | null
          subject?: string | null
          ticket_id?: string | null
          to_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "helpdesk_email_messages_inbox_id_fkey"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_email_inboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      helpdesk_escalation_events: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          organization_id: string
          rule_id: string | null
          ticket_id: string
          trigger_type: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          organization_id: string
          rule_id?: string | null
          ticket_id: string
          trigger_type: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          organization_id?: string
          rule_id?: string | null
          ticket_id?: string
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "helpdesk_escalation_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helpdesk_escalation_events_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_escalation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helpdesk_escalation_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      helpdesk_escalation_rules: {
        Row: {
          action: string
          cooldown_minutes: number
          created_at: string
          description: string | null
          id: string
          is_enabled: boolean
          name: string
          notify_emails: string[] | null
          organization_id: string
          priority: string | null
          raise_to_priority: string | null
          target_role: string | null
          target_user_id: string | null
          threshold_minutes: number
          ticket_type: string | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          action: string
          cooldown_minutes?: number
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          name: string
          notify_emails?: string[] | null
          organization_id: string
          priority?: string | null
          raise_to_priority?: string | null
          target_role?: string | null
          target_user_id?: string | null
          threshold_minutes?: number
          ticket_type?: string | null
          trigger_type: string
          updated_at?: string
        }
        Update: {
          action?: string
          cooldown_minutes?: number
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          name?: string
          notify_emails?: string[] | null
          organization_id?: string
          priority?: string | null
          raise_to_priority?: string | null
          target_role?: string | null
          target_user_id?: string | null
          threshold_minutes?: number
          ticket_type?: string | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "helpdesk_escalation_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helpdesk_escalation_rules_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helpdesk_escalation_rules_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      helpdesk_intake_channels: {
        Row: {
          allowed_origins: string[] | null
          branding: Json
          channel_type: string
          created_at: string
          created_by: string | null
          default_assignee_id: string | null
          default_category_id: string | null
          default_priority: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          public_token: string
          rate_limit_per_hour: number
          require_email: boolean
          updated_at: string
        }
        Insert: {
          allowed_origins?: string[] | null
          branding?: Json
          channel_type?: string
          created_at?: string
          created_by?: string | null
          default_assignee_id?: string | null
          default_category_id?: string | null
          default_priority?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          public_token?: string
          rate_limit_per_hour?: number
          require_email?: boolean
          updated_at?: string
        }
        Update: {
          allowed_origins?: string[] | null
          branding?: Json
          channel_type?: string
          created_at?: string
          created_by?: string | null
          default_assignee_id?: string | null
          default_category_id?: string | null
          default_priority?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          public_token?: string
          rate_limit_per_hour?: number
          require_email?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      helpdesk_intake_submissions: {
        Row: {
          channel_id: string
          created_at: string
          error_message: string | null
          id: string
          ip_address: string | null
          organization_id: string
          status: string
          subject: string | null
          submitter_email: string | null
          submitter_name: string | null
          ticket_id: string | null
          user_agent: string | null
        }
        Insert: {
          channel_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          organization_id: string
          status?: string
          subject?: string | null
          submitter_email?: string | null
          submitter_name?: string | null
          ticket_id?: string | null
          user_agent?: string | null
        }
        Update: {
          channel_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          organization_id?: string
          status?: string
          subject?: string | null
          submitter_email?: string | null
          submitter_name?: string | null
          ticket_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "helpdesk_intake_submissions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_intake_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      helpdesk_macro_usage: {
        Row: {
          id: string
          macro_id: string
          organization_id: string
          ticket_id: string | null
          used_at: string
          used_by: string | null
        }
        Insert: {
          id?: string
          macro_id: string
          organization_id: string
          ticket_id?: string | null
          used_at?: string
          used_by?: string | null
        }
        Update: {
          id?: string
          macro_id?: string
          organization_id?: string
          ticket_id?: string | null
          used_at?: string
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "helpdesk_macro_usage_macro_id_fkey"
            columns: ["macro_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_macros"
            referencedColumns: ["id"]
          },
        ]
      }
      helpdesk_macros: {
        Row: {
          body: string
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_shared: boolean
          last_used_at: string | null
          name: string
          organization_id: string
          shortcut: string | null
          updated_at: string
          usage_count: number
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_shared?: boolean
          last_used_at?: string | null
          name: string
          organization_id: string
          shortcut?: string | null
          updated_at?: string
          usage_count?: number
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_shared?: boolean
          last_used_at?: string | null
          name?: string
          organization_id?: string
          shortcut?: string | null
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      helpdesk_notifications: {
        Row: {
          body: string | null
          created_at: string
          error_message: string | null
          id: string
          metadata: Json
          notification_type: string
          organization_id: string
          recipient_email: string
          sent_at: string | null
          status: string
          subject: string | null
          ticket_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          notification_type: string
          organization_id: string
          recipient_email: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          ticket_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          notification_type?: string
          organization_id?: string
          recipient_email?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "helpdesk_notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helpdesk_notifications_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      helpdesk_report_runs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          file_size_bytes: number | null
          id: string
          organization_id: string
          report_id: string
          row_count: number | null
          started_at: string
          status: string
          trigger_source: string
          triggered_by: string | null
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          organization_id: string
          report_id: string
          row_count?: number | null
          started_at?: string
          status?: string
          trigger_source?: string
          triggered_by?: string | null
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          organization_id?: string
          report_id?: string
          row_count?: number | null
          started_at?: string
          status?: string
          trigger_source?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "helpdesk_report_runs_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      helpdesk_reports: {
        Row: {
          columns: Json
          created_at: string
          created_by: string | null
          dataset: string
          description: string | null
          filters: Json
          group_by: string | null
          id: string
          is_enabled: boolean
          last_run_at: string | null
          name: string
          next_run_at: string | null
          organization_id: string
          recipients: string[] | null
          schedule_interval: string | null
          sort_by: string | null
          sort_dir: string | null
          updated_at: string
        }
        Insert: {
          columns?: Json
          created_at?: string
          created_by?: string | null
          dataset?: string
          description?: string | null
          filters?: Json
          group_by?: string | null
          id?: string
          is_enabled?: boolean
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          organization_id: string
          recipients?: string[] | null
          schedule_interval?: string | null
          sort_by?: string | null
          sort_dir?: string | null
          updated_at?: string
        }
        Update: {
          columns?: Json
          created_at?: string
          created_by?: string | null
          dataset?: string
          description?: string | null
          filters?: Json
          group_by?: string | null
          id?: string
          is_enabled?: boolean
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          organization_id?: string
          recipients?: string[] | null
          schedule_interval?: string | null
          sort_by?: string | null
          sort_dir?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      helpdesk_sla_escalation_events: {
        Row: {
          actions_taken: Json
          details: Json
          fired_at: string
          id: string
          organization_id: string
          rule_id: string | null
          sla_leg: string
          ticket_id: string
          trigger_type: string
        }
        Insert: {
          actions_taken?: Json
          details?: Json
          fired_at?: string
          id?: string
          organization_id: string
          rule_id?: string | null
          sla_leg: string
          ticket_id: string
          trigger_type: string
        }
        Update: {
          actions_taken?: Json
          details?: Json
          fired_at?: string
          id?: string
          organization_id?: string
          rule_id?: string | null
          sla_leg?: string
          ticket_id?: string
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "helpdesk_sla_escalation_events_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_sla_escalation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      helpdesk_sla_escalation_rules: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          note_template: string | null
          notify_assignee: boolean
          notify_user_ids: string[]
          organization_id: string
          post_internal_note: boolean
          priority_filter: string[] | null
          raise_priority: boolean
          reassign_to: string | null
          sla_leg: string
          threshold_percent: number
          trigger_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          note_template?: string | null
          notify_assignee?: boolean
          notify_user_ids?: string[]
          organization_id: string
          post_internal_note?: boolean
          priority_filter?: string[] | null
          raise_priority?: boolean
          reassign_to?: string | null
          sla_leg?: string
          threshold_percent?: number
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          note_template?: string | null
          notify_assignee?: boolean
          notify_user_ids?: string[]
          organization_id?: string
          post_internal_note?: boolean
          priority_filter?: string[] | null
          raise_priority?: boolean
          reassign_to?: string | null
          sla_leg?: string
          threshold_percent?: number
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      helpdesk_sla_policies: {
        Row: {
          business_hours_only: boolean
          created_at: string
          id: string
          organization_id: string
          priority: Database["public"]["Enums"]["helpdesk_ticket_priority"]
          resolution_minutes: number
          response_minutes: number
          ticket_type:
            | Database["public"]["Enums"]["helpdesk_ticket_type"]
            | null
          updated_at: string
        }
        Insert: {
          business_hours_only?: boolean
          created_at?: string
          id?: string
          organization_id: string
          priority: Database["public"]["Enums"]["helpdesk_ticket_priority"]
          resolution_minutes?: number
          response_minutes?: number
          ticket_type?:
            | Database["public"]["Enums"]["helpdesk_ticket_type"]
            | null
          updated_at?: string
        }
        Update: {
          business_hours_only?: boolean
          created_at?: string
          id?: string
          organization_id?: string
          priority?: Database["public"]["Enums"]["helpdesk_ticket_priority"]
          resolution_minutes?: number
          response_minutes?: number
          ticket_type?:
            | Database["public"]["Enums"]["helpdesk_ticket_type"]
            | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "helpdesk_sla_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      helpdesk_ticket_activity: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          from_value: Json | null
          id: string
          notes: string | null
          organization_id: string
          ticket_id: string
          to_value: Json | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          from_value?: Json | null
          id?: string
          notes?: string | null
          organization_id: string
          ticket_id: string
          to_value?: Json | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          from_value?: Json | null
          id?: string
          notes?: string | null
          organization_id?: string
          ticket_id?: string
          to_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "helpdesk_ticket_activity_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helpdesk_ticket_activity_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      helpdesk_ticket_attachments: {
        Row: {
          comment_id: string | null
          created_at: string
          file_name: string
          file_size: number | null
          id: string
          is_internal: boolean
          mime_type: string | null
          organization_id: string
          storage_path: string
          ticket_id: string
          uploaded_by: string | null
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          file_name: string
          file_size?: number | null
          id?: string
          is_internal?: boolean
          mime_type?: string | null
          organization_id: string
          storage_path: string
          ticket_id: string
          uploaded_by?: string | null
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          file_name?: string
          file_size?: number | null
          id?: string
          is_internal?: boolean
          mime_type?: string | null
          organization_id?: string
          storage_path?: string
          ticket_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "helpdesk_ticket_attachments_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_ticket_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helpdesk_ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      helpdesk_ticket_catalog_items: {
        Row: {
          catalog_item_id: string
          created_at: string
          created_by: string | null
          list_id: string
          organization_id: string
          ticket_id: string
        }
        Insert: {
          catalog_item_id: string
          created_at?: string
          created_by?: string | null
          list_id: string
          organization_id: string
          ticket_id: string
        }
        Update: {
          catalog_item_id?: string
          created_at?: string
          created_by?: string | null
          list_id?: string
          organization_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "helpdesk_ticket_catalog_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helpdesk_ticket_catalog_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_catalog_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helpdesk_ticket_catalog_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helpdesk_ticket_catalog_items_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      helpdesk_ticket_comments: {
        Row: {
          author_email: string | null
          author_name: string | null
          author_user_id: string | null
          body: string
          created_at: string
          id: string
          is_from_email: boolean
          is_internal: boolean
          metadata: Json
          organization_id: string
          ticket_id: string
        }
        Insert: {
          author_email?: string | null
          author_name?: string | null
          author_user_id?: string | null
          body: string
          created_at?: string
          id?: string
          is_from_email?: boolean
          is_internal?: boolean
          metadata?: Json
          organization_id: string
          ticket_id: string
        }
        Update: {
          author_email?: string | null
          author_name?: string | null
          author_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          is_from_email?: boolean
          is_internal?: boolean
          metadata?: Json
          organization_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "helpdesk_ticket_comments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helpdesk_ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      helpdesk_tickets: {
        Row: {
          assignee_id: string | null
          category: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          first_response_at: string | null
          id: string
          metadata: Json
          organization_id: string
          parent_problem_id: string | null
          parent_ticket_id: string | null
          priority: Database["public"]["Enums"]["helpdesk_ticket_priority"]
          product_id: string | null
          programme_id: string | null
          project_id: string | null
          reference_number: string | null
          reporter_email: string | null
          reporter_name: string | null
          reporter_user_id: string | null
          resolution: string | null
          resolution_code:
            | Database["public"]["Enums"]["helpdesk_resolution_code"]
            | null
          resolved_at: string | null
          sla_paused_at: string | null
          sla_paused_seconds: number
          sla_resolution_breached: boolean
          sla_resolution_due_at: string | null
          sla_response_breached: boolean
          sla_response_due_at: string | null
          source: Database["public"]["Enums"]["helpdesk_ticket_source"]
          status: Database["public"]["Enums"]["helpdesk_ticket_status"]
          subject: string
          tags: string[] | null
          ticket_type: Database["public"]["Enums"]["helpdesk_ticket_type"]
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          category?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          first_response_at?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          parent_problem_id?: string | null
          parent_ticket_id?: string | null
          priority?: Database["public"]["Enums"]["helpdesk_ticket_priority"]
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          reference_number?: string | null
          reporter_email?: string | null
          reporter_name?: string | null
          reporter_user_id?: string | null
          resolution?: string | null
          resolution_code?:
            | Database["public"]["Enums"]["helpdesk_resolution_code"]
            | null
          resolved_at?: string | null
          sla_paused_at?: string | null
          sla_paused_seconds?: number
          sla_resolution_breached?: boolean
          sla_resolution_due_at?: string | null
          sla_response_breached?: boolean
          sla_response_due_at?: string | null
          source?: Database["public"]["Enums"]["helpdesk_ticket_source"]
          status?: Database["public"]["Enums"]["helpdesk_ticket_status"]
          subject: string
          tags?: string[] | null
          ticket_type?: Database["public"]["Enums"]["helpdesk_ticket_type"]
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          category?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          first_response_at?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          parent_problem_id?: string | null
          parent_ticket_id?: string | null
          priority?: Database["public"]["Enums"]["helpdesk_ticket_priority"]
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          reference_number?: string | null
          reporter_email?: string | null
          reporter_name?: string | null
          reporter_user_id?: string | null
          resolution?: string | null
          resolution_code?:
            | Database["public"]["Enums"]["helpdesk_resolution_code"]
            | null
          resolved_at?: string | null
          sla_paused_at?: string | null
          sla_paused_seconds?: number
          sla_resolution_breached?: boolean
          sla_resolution_due_at?: string | null
          sla_response_breached?: boolean
          sla_response_due_at?: string | null
          source?: Database["public"]["Enums"]["helpdesk_ticket_source"]
          status?: Database["public"]["Enums"]["helpdesk_ticket_status"]
          subject?: string
          tags?: string[] | null
          ticket_type?: Database["public"]["Enums"]["helpdesk_ticket_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "helpdesk_tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helpdesk_tickets_parent_problem_id_fkey"
            columns: ["parent_problem_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helpdesk_tickets_parent_ticket_id_fkey"
            columns: ["parent_ticket_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helpdesk_tickets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helpdesk_tickets_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helpdesk_tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      helpdesk_workflow_approvals: {
        Row: {
          assigned_to_role: string | null
          assigned_to_user_id: string | null
          context: Json
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision: string
          decision_comment: string | null
          description: string | null
          due_at: string | null
          id: string
          organization_id: string
          run_id: string
          step_execution_id: string | null
          ticket_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to_role?: string | null
          assigned_to_user_id?: string | null
          context?: Json
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string
          decision_comment?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          organization_id: string
          run_id: string
          step_execution_id?: string | null
          ticket_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to_role?: string | null
          assigned_to_user_id?: string | null
          context?: Json
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string
          decision_comment?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          organization_id?: string
          run_id?: string
          step_execution_id?: string | null
          ticket_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "helpdesk_workflow_approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helpdesk_workflow_approvals_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_workflow_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helpdesk_workflow_approvals_step_execution_id_fkey"
            columns: ["step_execution_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_workflow_step_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helpdesk_workflow_approvals_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      helpdesk_workflow_categories: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "helpdesk_workflow_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      helpdesk_workflow_runs: {
        Row: {
          completed_at: string | null
          context: Json
          created_at: string
          current_step_index: number
          error_message: string | null
          id: string
          organization_id: string
          started_at: string
          status: string
          step_count: number
          ticket_id: string | null
          trigger_event: string
          trigger_payload: Json
          triggered_by: string | null
          updated_at: string
          workflow_id: string
        }
        Insert: {
          completed_at?: string | null
          context?: Json
          created_at?: string
          current_step_index?: number
          error_message?: string | null
          id?: string
          organization_id: string
          started_at?: string
          status?: string
          step_count?: number
          ticket_id?: string | null
          trigger_event: string
          trigger_payload?: Json
          triggered_by?: string | null
          updated_at?: string
          workflow_id: string
        }
        Update: {
          completed_at?: string | null
          context?: Json
          created_at?: string
          current_step_index?: number
          error_message?: string | null
          id?: string
          organization_id?: string
          started_at?: string
          status?: string
          step_count?: number
          ticket_id?: string | null
          trigger_event?: string
          trigger_payload?: Json
          triggered_by?: string | null
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "helpdesk_workflow_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helpdesk_workflow_runs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helpdesk_workflow_runs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      helpdesk_workflow_step_executions: {
        Row: {
          ai_model: string | null
          ai_tokens: number | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          input: Json
          organization_id: string
          output: Json
          run_id: string
          started_at: string | null
          status: string
          step_index: number
          step_label: string | null
          step_type: string
        }
        Insert: {
          ai_model?: string | null
          ai_tokens?: number | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input?: Json
          organization_id: string
          output?: Json
          run_id: string
          started_at?: string | null
          status?: string
          step_index: number
          step_label?: string | null
          step_type: string
        }
        Update: {
          ai_model?: string | null
          ai_tokens?: number | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input?: Json
          organization_id?: string
          output?: Json
          run_id?: string
          started_at?: string | null
          status?: string
          step_index?: number
          step_label?: string | null
          step_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "helpdesk_workflow_step_executions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helpdesk_workflow_step_executions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      helpdesk_workflows: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          failure_count: number
          id: string
          is_enabled: boolean
          last_run_at: string | null
          match_conditions: Json
          name: string
          organization_id: string
          run_count: number
          steps: Json
          success_count: number
          trigger_config: Json
          trigger_event: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          failure_count?: number
          id?: string
          is_enabled?: boolean
          last_run_at?: string | null
          match_conditions?: Json
          name: string
          organization_id: string
          run_count?: number
          steps?: Json
          success_count?: number
          trigger_config?: Json
          trigger_event: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          failure_count?: number
          id?: string
          is_enabled?: boolean
          last_run_at?: string | null
          match_conditions?: Json
          name?: string
          organization_id?: string
          run_count?: number
          steps?: Json
          success_count?: number
          trigger_config?: Json
          trigger_event?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "helpdesk_workflows_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_workflow_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helpdesk_workflows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      industry_verticals: {
        Row: {
          ai_context_prompt: string | null
          created_at: string
          default_dashboards: string[]
          description: string | null
          enabled_modules: string[]
          icon: string | null
          id: string
          is_active: boolean
          is_seed: boolean
          name: string
          sort_order: number
          terminology_overrides: Json
          updated_at: string
        }
        Insert: {
          ai_context_prompt?: string | null
          created_at?: string
          default_dashboards?: string[]
          description?: string | null
          enabled_modules?: string[]
          icon?: string | null
          id: string
          is_active?: boolean
          is_seed?: boolean
          name: string
          sort_order?: number
          terminology_overrides?: Json
          updated_at?: string
        }
        Update: {
          ai_context_prompt?: string | null
          created_at?: string
          default_dashboards?: string[]
          description?: string | null
          enabled_modules?: string[]
          icon?: string | null
          id?: string
          is_active?: boolean
          is_seed?: boolean
          name?: string
          sort_order?: number
          terminology_overrides?: Json
          updated_at?: string
        }
        Relationships: []
      }
      issues: {
        Row: {
          created_at: string
          created_by: string | null
          date_raised: string | null
          description: string | null
          id: string
          organization_id: string
          owner_id: string | null
          priority: string
          product_id: string | null
          programme_id: string | null
          project_id: string | null
          reference_number: string | null
          resolution: string | null
          status: string
          target_date: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_raised?: string | null
          description?: string | null
          id?: string
          organization_id: string
          owner_id?: string | null
          priority?: string
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          reference_number?: string | null
          resolution?: string | null
          status?: string
          target_date?: string | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_raised?: string | null
          description?: string | null
          id?: string
          organization_id?: string
          owner_id?: string | null
          priority?: string
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          reference_number?: string | null
          resolution?: string | null
          status?: string
          target_date?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_article_chunks: {
        Row: {
          article_id: string
          chunk_index: number
          content: string
          created_at: string
          embedding: string | null
          id: string
          organization_id: string
          token_estimate: number | null
        }
        Insert: {
          article_id: string
          chunk_index: number
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          organization_id: string
          token_estimate?: number | null
        }
        Update: {
          article_id?: string
          chunk_index?: number
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          organization_id?: string
          token_estimate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_article_chunks_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "kb_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_article_chunks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_article_feedback: {
        Row: {
          article_id: string
          comment: string | null
          created_at: string
          id: string
          is_helpful: boolean
          organization_id: string
          session_token: string | null
          user_id: string | null
        }
        Insert: {
          article_id: string
          comment?: string | null
          created_at?: string
          id?: string
          is_helpful: boolean
          organization_id: string
          session_token?: string | null
          user_id?: string | null
        }
        Update: {
          article_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          is_helpful?: boolean
          organization_id?: string
          session_token?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_article_feedback_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "kb_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_article_feedback_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_articles: {
        Row: {
          author_user_id: string | null
          body: string
          category: string | null
          created_at: string
          embedding_status: string
          embedding_updated_at: string | null
          helpful_count: number
          id: string
          last_edited_by: string | null
          not_helpful_count: number
          organization_id: string
          published_at: string | null
          slug: string | null
          source: string
          status: string
          summary: string | null
          tags: string[]
          title: string
          updated_at: string
          view_count: number
          visibility: string
        }
        Insert: {
          author_user_id?: string | null
          body?: string
          category?: string | null
          created_at?: string
          embedding_status?: string
          embedding_updated_at?: string | null
          helpful_count?: number
          id?: string
          last_edited_by?: string | null
          not_helpful_count?: number
          organization_id: string
          published_at?: string | null
          slug?: string | null
          source?: string
          status?: string
          summary?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          view_count?: number
          visibility?: string
        }
        Update: {
          author_user_id?: string | null
          body?: string
          category?: string | null
          created_at?: string
          embedding_status?: string
          embedding_updated_at?: string | null
          helpful_count?: number
          id?: string
          last_edited_by?: string | null
          not_helpful_count?: number
          organization_id?: string
          published_at?: string | null
          slug?: string | null
          source?: string
          status?: string
          summary?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          view_count?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_articles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_attachments: {
        Row: {
          article_id: string | null
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          organization_id: string
          parsed: boolean
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          article_id?: string | null
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          organization_id: string
          parsed?: boolean
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          article_id?: string | null
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          organization_id?: string
          parsed?: boolean
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_attachments_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "kb_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          icon: string | null
          id: string
          is_public: boolean
          name: string
          organization_id: string
          parent_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_public?: boolean
          name: string
          organization_id: string
          parent_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_public?: boolean
          name?: string
          organization_id?: string
          parent_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "kb_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_search_log: {
        Row: {
          ai_answer: string | null
          created_at: string
          created_ticket: boolean
          id: string
          matched_article_ids: string[]
          organization_id: string
          query: string
          surface: string
          ticket_id: string | null
          user_id: string | null
          was_helpful: boolean | null
        }
        Insert: {
          ai_answer?: string | null
          created_at?: string
          created_ticket?: boolean
          id?: string
          matched_article_ids?: string[]
          organization_id: string
          query: string
          surface?: string
          ticket_id?: string | null
          user_id?: string | null
          was_helpful?: boolean | null
        }
        Update: {
          ai_answer?: string | null
          created_at?: string
          created_ticket?: boolean
          id?: string
          matched_article_ids?: string[]
          organization_id?: string
          query?: string
          surface?: string
          ticket_id?: string | null
          user_id?: string | null
          was_helpful?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_search_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_ticket_deflections: {
        Row: {
          article_id: string | null
          created_at: string
          id: string
          organization_id: string
          resolved_without_ticket: boolean
          search_query: string | null
          ticket_id: string | null
          user_id: string | null
        }
        Insert: {
          article_id?: string | null
          created_at?: string
          id?: string
          organization_id: string
          resolved_without_ticket?: boolean
          search_query?: string | null
          ticket_id?: string | null
          user_id?: string | null
        }
        Update: {
          article_id?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          resolved_without_ticket?: boolean
          search_query?: string | null
          ticket_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_ticket_deflections_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "kb_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_ticket_deflections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_ticket_deflections_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_applications: {
        Row: {
          application_notes: string | null
          applied_by: string | null
          applied_to_id: string
          applied_to_type: string
          created_at: string
          id: string
          lesson_id: string
          organization_id: string
          outcome: string | null
        }
        Insert: {
          application_notes?: string | null
          applied_by?: string | null
          applied_to_id: string
          applied_to_type: string
          created_at?: string
          id?: string
          lesson_id: string
          organization_id: string
          outcome?: string | null
        }
        Update: {
          application_notes?: string | null
          applied_by?: string | null
          applied_to_id?: string
          applied_to_type?: string
          created_at?: string
          id?: string
          lesson_id?: string
          organization_id?: string
          outcome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_applications_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons_learned"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_tag_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          lesson_id: string
          tag_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          lesson_id: string
          tag_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          lesson_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_tag_assignments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons_learned"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "lesson_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_tags: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          organization_id: string
          tag_name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          organization_id: string
          tag_name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          organization_id?: string
          tag_name?: string
        }
        Relationships: []
      }
      lessons_learned: {
        Row: {
          action_taken: string | null
          applicable_to: string[] | null
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          event_date: string | null
          id: string
          identified_by: string | null
          lesson_type: string
          organization_id: string
          outcome: string | null
          owner_id: string | null
          priority: string
          product_id: string | null
          programme_id: string | null
          project_id: string | null
          project_stage: string | null
          recommendation: string | null
          reference_number: string | null
          root_cause: string | null
          status: string
          title: string
          updated_at: string
          what_happened: string | null
        }
        Insert: {
          action_taken?: string | null
          applicable_to?: string[] | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date?: string | null
          id?: string
          identified_by?: string | null
          lesson_type?: string
          organization_id: string
          outcome?: string | null
          owner_id?: string | null
          priority?: string
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          project_stage?: string | null
          recommendation?: string | null
          reference_number?: string | null
          root_cause?: string | null
          status?: string
          title: string
          updated_at?: string
          what_happened?: string | null
        }
        Update: {
          action_taken?: string | null
          applicable_to?: string[] | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date?: string | null
          id?: string
          identified_by?: string | null
          lesson_type?: string
          organization_id?: string
          outcome?: string | null
          owner_id?: string | null
          priority?: string
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          project_stage?: string | null
          recommendation?: string | null
          reference_number?: string | null
          root_cause?: string | null
          status?: string
          title?: string
          updated_at?: string
          what_happened?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_learned_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_learned_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_learned_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_learned_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      license_assignments: {
        Row: {
          asset_id: string | null
          assigned_at: string
          assigned_by: string | null
          id: string
          license_id: string
          notes: string | null
          organization_id: string
          user_id: string | null
        }
        Insert: {
          asset_id?: string | null
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          license_id: string
          notes?: string | null
          organization_id: string
          user_id?: string | null
        }
        Update: {
          asset_id?: string | null
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          license_id?: string
          notes?: string | null
          organization_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "license_assignments_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "license_assignments_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "software_licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      major_incident_tickets: {
        Row: {
          created_at: string
          id: string
          linked_by: string | null
          major_incident_id: string
          organization_id: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          linked_by?: string | null
          major_incident_id: string
          organization_id: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          linked_by?: string | null
          major_incident_id?: string
          organization_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "major_incident_tickets_linked_by_fkey"
            columns: ["linked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "major_incident_tickets_linked_by_fkey"
            columns: ["linked_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "major_incident_tickets_major_incident_id_fkey"
            columns: ["major_incident_id"]
            isOneToOne: false
            referencedRelation: "major_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "major_incident_tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "major_incident_tickets_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      major_incident_updates: {
        Row: {
          created_at: string
          id: string
          is_public: boolean
          major_incident_id: string
          message: string
          organization_id: string
          posted_by: string | null
          update_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_public?: boolean
          major_incident_id: string
          message: string
          organization_id: string
          posted_by?: string | null
          update_type?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_public?: boolean
          major_incident_id?: string
          message?: string
          organization_id?: string
          posted_by?: string | null
          update_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "major_incident_updates_major_incident_id_fkey"
            columns: ["major_incident_id"]
            isOneToOne: false
            referencedRelation: "major_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "major_incident_updates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "major_incident_updates_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "major_incident_updates_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      major_incidents: {
        Row: {
          closed_at: string | null
          comms_lead_id: string | null
          created_at: string
          created_by: string | null
          declared_at: string
          description: string | null
          id: string
          impact: string | null
          incident_commander_id: string | null
          organization_id: string
          parent_problem_id: string | null
          post_mortem: string | null
          post_mortem_published_at: string | null
          reference_number: string | null
          resolved_at: string | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          comms_lead_id?: string | null
          created_at?: string
          created_by?: string | null
          declared_at?: string
          description?: string | null
          id?: string
          impact?: string | null
          incident_commander_id?: string | null
          organization_id: string
          parent_problem_id?: string | null
          post_mortem?: string | null
          post_mortem_published_at?: string | null
          reference_number?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          comms_lead_id?: string | null
          created_at?: string
          created_by?: string | null
          declared_at?: string
          description?: string | null
          id?: string
          impact?: string | null
          incident_commander_id?: string | null
          organization_id?: string
          parent_problem_id?: string | null
          post_mortem?: string | null
          post_mortem_published_at?: string | null
          reference_number?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "major_incidents_comms_lead_id_fkey"
            columns: ["comms_lead_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "major_incidents_comms_lead_id_fkey"
            columns: ["comms_lead_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "major_incidents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "major_incidents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "major_incidents_incident_commander_id_fkey"
            columns: ["incident_commander_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "major_incidents_incident_commander_id_fkey"
            columns: ["incident_commander_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "major_incidents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "major_incidents_parent_problem_id_fkey"
            columns: ["parent_problem_id"]
            isOneToOne: false
            referencedRelation: "problem_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "major_incidents_parent_problem_id_fkey"
            columns: ["parent_problem_id"]
            isOneToOne: false
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
        ]
      }
      milestone_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          comment: string | null
          event_type: string
          from_value: string | null
          id: string
          metadata: Json
          milestone_id: string
          organization_id: string | null
          to_value: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          comment?: string | null
          event_type: string
          from_value?: string | null
          id?: string
          metadata?: Json
          milestone_id: string
          organization_id?: string | null
          to_value?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          comment?: string | null
          event_type?: string
          from_value?: string | null
          id?: string
          metadata?: Json
          milestone_id?: string
          organization_id?: string | null
          to_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milestone_history_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestone_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          acceptance_criteria: string | null
          actual_date: string | null
          approval_status: string | null
          approver_id: string | null
          created_at: string
          created_by: string | null
          deliverables: string[] | null
          description: string | null
          id: string
          is_stage_boundary: boolean | null
          milestone_type: string
          name: string
          organization_id: string
          original_target_date: string | null
          owner_id: string | null
          product_id: string | null
          programme_id: string | null
          project_id: string | null
          reference_number: string | null
          revised_target_date: string | null
          revision_reason: string | null
          status: Database["public"]["Enums"]["milestone_status"]
          target_date: string
          updated_at: string
          verifier_id: string | null
          work_package_id: string | null
        }
        Insert: {
          acceptance_criteria?: string | null
          actual_date?: string | null
          approval_status?: string | null
          approver_id?: string | null
          created_at?: string
          created_by?: string | null
          deliverables?: string[] | null
          description?: string | null
          id?: string
          is_stage_boundary?: boolean | null
          milestone_type?: string
          name: string
          organization_id: string
          original_target_date?: string | null
          owner_id?: string | null
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          reference_number?: string | null
          revised_target_date?: string | null
          revision_reason?: string | null
          status?: Database["public"]["Enums"]["milestone_status"]
          target_date: string
          updated_at?: string
          verifier_id?: string | null
          work_package_id?: string | null
        }
        Update: {
          acceptance_criteria?: string | null
          actual_date?: string | null
          approval_status?: string | null
          approver_id?: string | null
          created_at?: string
          created_by?: string | null
          deliverables?: string[] | null
          description?: string | null
          id?: string
          is_stage_boundary?: boolean | null
          milestone_type?: string
          name?: string
          organization_id?: string
          original_target_date?: string | null
          owner_id?: string | null
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          reference_number?: string | null
          revised_target_date?: string | null
          revision_reason?: string | null
          status?: Database["public"]["Enums"]["milestone_status"]
          target_date?: string
          updated_at?: string
          verifier_id?: string | null
          work_package_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milestones_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_work_package_id_fkey"
            columns: ["work_package_id"]
            isOneToOne: false
            referencedRelation: "work_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string | null
          metadata: Json | null
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          metadata?: Json | null
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          metadata?: Json | null
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      org_mfa_policies: {
        Row: {
          allow_recovery_codes: boolean
          created_at: string
          enforcement_mode: string
          grace_period_days: number
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allow_recovery_codes?: boolean
          created_at?: string
          enforcement_mode?: string
          grace_period_days?: number
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allow_recovery_codes?: boolean
          created_at?: string
          enforcement_mode?: string
          grace_period_days?: number
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_mfa_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_override_audit_log: {
        Row: {
          actor_email: string | null
          actor_user_id: string | null
          after_value: Json | null
          before_value: Json | null
          change_kind: string
          created_at: string
          feature_key: string | null
          id: string
          operation: string
          organization_id: string
          reason: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_user_id?: string | null
          after_value?: Json | null
          before_value?: Json | null
          change_kind: string
          created_at?: string
          feature_key?: string | null
          id?: string
          operation: string
          organization_id: string
          reason?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_user_id?: string | null
          after_value?: Json | null
          before_value?: Json | null
          change_kind?: string
          created_at?: string
          feature_key?: string | null
          id?: string
          operation?: string
          organization_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_override_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_session_policies: {
        Row: {
          absolute_timeout_minutes: number
          created_at: string
          enforce_ip_allowlist: boolean
          idle_timeout_minutes: number
          ip_allowlist: string[]
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          absolute_timeout_minutes?: number
          created_at?: string
          enforce_ip_allowlist?: boolean
          idle_timeout_minutes?: number
          ip_allowlist?: string[]
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          absolute_timeout_minutes?: number
          created_at?: string
          enforce_ip_allowlist?: boolean
          idle_timeout_minutes?: number
          ip_allowlist?: string[]
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_session_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_addon_subscriptions: {
        Row: {
          addon_plan_id: string
          billing_interval: string | null
          cancel_at_period_end: boolean | null
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          feature_keys: string[]
          id: string
          organization_id: string
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          addon_plan_id: string
          billing_interval?: string | null
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          feature_keys?: string[]
          id?: string
          organization_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          addon_plan_id?: string
          billing_interval?: string | null
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          feature_keys?: string[]
          id?: string
          organization_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_addon_subscriptions_addon_plan_id_fkey"
            columns: ["addon_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_addon_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          access_level: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          access_level?: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          access_level?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_licenses: {
        Row: {
          ai_credits_monthly: number
          created_at: string
          customer_reference: string | null
          deployment_mode: string
          features_override: Json
          id: string
          issued_at: string
          issued_by: string | null
          license_key: string
          notes: string | null
          organization_id: string
          plan_id: string | null
          plan_tier: string | null
          seats: number
          status: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          ai_credits_monthly?: number
          created_at?: string
          customer_reference?: string | null
          deployment_mode?: string
          features_override?: Json
          id?: string
          issued_at?: string
          issued_by?: string | null
          license_key: string
          notes?: string | null
          organization_id: string
          plan_id?: string | null
          plan_tier?: string | null
          seats?: number
          status?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          ai_credits_monthly?: number
          created_at?: string
          customer_reference?: string | null
          deployment_mode?: string
          features_override?: Json
          id?: string
          issued_at?: string
          issued_by?: string | null
          license_key?: string
          notes?: string | null
          organization_id?: string
          plan_id?: string | null
          plan_tier?: string | null
          seats?: number
          status?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_licenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_licenses_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_module_toggles: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          module_key: string
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          module_key: string
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          module_key?: string
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_module_toggles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_plan_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string | null
          expires_at: string | null
          feature_key: string
          id: string
          organization_id: string
          override_value: Json
          reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          expires_at?: string | null
          feature_key: string
          id?: string
          organization_id: string
          override_value: Json
          reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          expires_at?: string | null
          feature_key?: string
          id?: string
          organization_id?: string
          override_value?: Json
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_plan_overrides_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "plan_features"
            referencedColumns: ["feature_key"]
          },
          {
            foreignKeyName: "organization_plan_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_subscriptions: {
        Row: {
          billing_interval: string | null
          cancel_at_period_end: boolean | null
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          organization_id: string
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          billing_interval?: string | null
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          organization_id: string
          plan_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_interval?: string | null
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          organization_id?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          allow_cross_region_ai: boolean
          archived_at: string | null
          archived_by: string | null
          created_at: string
          created_by: string | null
          data_region: string
          id: string
          industry_vertical: string
          is_archived: boolean
          is_suspended: boolean
          logo_url: string | null
          name: string
          primary_color: string | null
          residency_enforcement: string
          residency_locked_at: string | null
          residency_locked_by: string | null
          restrict_time_logging_to_assigned_tasks: boolean
          secondary_color: string | null
          slug: string
          suspended_at: string | null
          suspended_by: string | null
          suspended_reason: string | null
          suspension_kind: string | null
          updated_at: string
        }
        Insert: {
          allow_cross_region_ai?: boolean
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string | null
          data_region?: string
          id?: string
          industry_vertical?: string
          is_archived?: boolean
          is_suspended?: boolean
          logo_url?: string | null
          name: string
          primary_color?: string | null
          residency_enforcement?: string
          residency_locked_at?: string | null
          residency_locked_by?: string | null
          restrict_time_logging_to_assigned_tasks?: boolean
          secondary_color?: string | null
          slug: string
          suspended_at?: string | null
          suspended_by?: string | null
          suspended_reason?: string | null
          suspension_kind?: string | null
          updated_at?: string
        }
        Update: {
          allow_cross_region_ai?: boolean
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string | null
          data_region?: string
          id?: string
          industry_vertical?: string
          is_archived?: boolean
          is_suspended?: boolean
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          residency_enforcement?: string
          residency_locked_at?: string | null
          residency_locked_by?: string | null
          restrict_time_logging_to_assigned_tasks?: boolean
          secondary_color?: string | null
          slug?: string
          suspended_at?: string | null
          suspended_by?: string | null
          suspended_reason?: string | null
          suspension_kind?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_industry_vertical_fkey"
            columns: ["industry_vertical"]
            isOneToOne: false
            referencedRelation: "industry_verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_modules: {
        Row: {
          category: string
          created_at: string
          description: string | null
          label: string
          module_key: string
          sort_order: number
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          label: string
          module_key: string
          sort_order?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          label?: string
          module_key?: string
          sort_order?: number
        }
        Relationships: []
      }
      plan_feature_values: {
        Row: {
          created_at: string
          feature_key: string
          id: string
          plan_id: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          feature_key: string
          id?: string
          plan_id: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          feature_key?: string
          id?: string
          plan_id?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "plan_feature_values_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "plan_features"
            referencedColumns: ["feature_key"]
          },
          {
            foreignKeyName: "plan_feature_values_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_features: {
        Row: {
          category: string
          created_at: string
          default_value: Json
          description: string | null
          display_order: number
          feature_key: string
          feature_type: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          default_value?: Json
          description?: string | null
          display_order?: number
          feature_key: string
          feature_type?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          default_value?: Json
          description?: string | null
          display_order?: number
          feature_key?: string
          feature_type?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      plan_price_sync_history: {
        Row: {
          affected_subscribers: number | null
          created_at: string
          currency: string
          id: string
          interval: string
          lookup_key: string | null
          migration_strategy: string
          new_amount: number
          new_stripe_price_id: string | null
          notes: string | null
          old_amount: number | null
          old_stripe_price_id: string | null
          performed_by: string | null
          plan_id: string
        }
        Insert: {
          affected_subscribers?: number | null
          created_at?: string
          currency?: string
          id?: string
          interval: string
          lookup_key?: string | null
          migration_strategy?: string
          new_amount: number
          new_stripe_price_id?: string | null
          notes?: string | null
          old_amount?: number | null
          old_stripe_price_id?: string | null
          performed_by?: string | null
          plan_id: string
        }
        Update: {
          affected_subscribers?: number | null
          created_at?: string
          currency?: string
          id?: string
          interval?: string
          lookup_key?: string | null
          migration_strategy?: string
          new_amount?: number
          new_stripe_price_id?: string | null
          notes?: string | null
          old_amount?: number | null
          old_stripe_price_id?: string | null
          performed_by?: string | null
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_price_sync_history_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      problem_ci_links: {
        Row: {
          ci_id: string
          created_at: string
          created_by: string | null
          id: string
          link_type: string
          organization_id: string
          problem_id: string
        }
        Insert: {
          ci_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          link_type?: string
          organization_id: string
          problem_id: string
        }
        Update: {
          ci_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          link_type?: string
          organization_id?: string
          problem_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "problem_ci_links_ci_id_fkey"
            columns: ["ci_id"]
            isOneToOne: false
            referencedRelation: "cmdb_ci_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "problem_ci_links_ci_id_fkey"
            columns: ["ci_id"]
            isOneToOne: false
            referencedRelation: "configuration_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "problem_ci_links_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problem_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "problem_ci_links_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
        ]
      }
      problem_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          comment: string | null
          from_status: string | null
          id: string
          problem_id: string
          to_status: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          comment?: string | null
          from_status?: string | null
          id?: string
          problem_id: string
          to_status: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          comment?: string | null
          from_status?: string | null
          id?: string
          problem_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "problem_status_history_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problem_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "problem_status_history_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
        ]
      }
      problems: {
        Row: {
          assignee_id: string | null
          category: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          identified_at: string
          is_known_error: boolean
          metadata: Json
          organization_id: string
          priority: string
          product_id: string | null
          programme_id: string | null
          project_id: string | null
          reference_number: string | null
          reporter_user_id: string | null
          resolution: string | null
          resolved_at: string | null
          root_cause: string | null
          status: string
          tags: string[]
          title: string
          updated_at: string
          workaround: string | null
        }
        Insert: {
          assignee_id?: string | null
          category?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          identified_at?: string
          is_known_error?: boolean
          metadata?: Json
          organization_id: string
          priority?: string
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          reference_number?: string | null
          reporter_user_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          root_cause?: string | null
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          workaround?: string | null
        }
        Update: {
          assignee_id?: string | null
          category?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          identified_at?: string
          is_known_error?: boolean
          metadata?: Json
          organization_id?: string
          priority?: string
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          reference_number?: string | null
          reporter_user_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          root_cause?: string | null
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          workaround?: string | null
        }
        Relationships: []
      }
      product_features: {
        Row: {
          actual_release_date: string | null
          confidence_score: number | null
          created_at: string
          created_by: string | null
          description: string | null
          effort_score: number | null
          id: string
          impact_score: number | null
          moscow: string | null
          name: string
          organization_id: string | null
          priority: string
          product_id: string
          reach_score: number | null
          reference_number: string | null
          sprint_id: string | null
          status: string
          story_points: number | null
          target_release: string | null
          updated_at: string
        }
        Insert: {
          actual_release_date?: string | null
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          effort_score?: number | null
          id?: string
          impact_score?: number | null
          moscow?: string | null
          name: string
          organization_id?: string | null
          priority?: string
          product_id: string
          reach_score?: number | null
          reference_number?: string | null
          sprint_id?: string | null
          status?: string
          story_points?: number | null
          target_release?: string | null
          updated_at?: string
        }
        Update: {
          actual_release_date?: string | null
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          effort_score?: number | null
          id?: string
          impact_score?: number | null
          moscow?: string | null
          name?: string
          organization_id?: string | null
          priority?: string
          product_id?: string
          reach_score?: number | null
          reference_number?: string | null
          sprint_id?: string | null
          status?: string
          story_points?: number | null
          target_release?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_features_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_features_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_features_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          confidence_score: number | null
          cost_center: string | null
          created_at: string
          created_by: string | null
          description: string | null
          effort_score: number | null
          id: string
          impact_score: number | null
          launch_date: string | null
          name: string
          next_review_date: string | null
          organization_id: string
          primary_metric: string | null
          product_owner_id: string | null
          product_type: string
          programme_id: string | null
          project_id: string | null
          reach_score: number | null
          reference_number: string | null
          revenue_target: string | null
          secondary_metrics: string[] | null
          stage: string
          status: string
          target_market: string | null
          timesheets_enabled: boolean
          updated_at: string
          value_proposition: string | null
          vision: string | null
        }
        Insert: {
          confidence_score?: number | null
          cost_center?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          effort_score?: number | null
          id?: string
          impact_score?: number | null
          launch_date?: string | null
          name: string
          next_review_date?: string | null
          organization_id: string
          primary_metric?: string | null
          product_owner_id?: string | null
          product_type?: string
          programme_id?: string | null
          project_id?: string | null
          reach_score?: number | null
          reference_number?: string | null
          revenue_target?: string | null
          secondary_metrics?: string[] | null
          stage?: string
          status?: string
          target_market?: string | null
          timesheets_enabled?: boolean
          updated_at?: string
          value_proposition?: string | null
          vision?: string | null
        }
        Update: {
          confidence_score?: number | null
          cost_center?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          effort_score?: number | null
          id?: string
          impact_score?: number | null
          launch_date?: string | null
          name?: string
          next_review_date?: string | null
          organization_id?: string
          primary_metric?: string | null
          product_owner_id?: string | null
          product_type?: string
          programme_id?: string | null
          project_id?: string | null
          reach_score?: number | null
          reference_number?: string | null
          revenue_target?: string | null
          secondary_metrics?: string[] | null
          stage?: string
          status?: string
          target_market?: string | null
          timesheets_enabled?: boolean
          updated_at?: string
          value_proposition?: string | null
          vision?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          archived: boolean
          archived_at: string | null
          avatar_url: string | null
          city: string | null
          created_at: string
          default_organization_id: string | null
          department: string | null
          email: string
          first_name: string | null
          full_name: string | null
          id: string
          last_name: string | null
          location: string | null
          mailing_address: string | null
          phone_number: string | null
          preferred_language: string
          role: Database["public"]["Enums"]["app_role"]
          state: string | null
          updated_at: string
          user_id: string
          zip: string | null
        }
        Insert: {
          address?: string | null
          archived?: boolean
          archived_at?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          default_organization_id?: string | null
          department?: string | null
          email: string
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          location?: string | null
          mailing_address?: string | null
          phone_number?: string | null
          preferred_language?: string
          role?: Database["public"]["Enums"]["app_role"]
          state?: string | null
          updated_at?: string
          user_id: string
          zip?: string | null
        }
        Update: {
          address?: string | null
          archived?: boolean
          archived_at?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          default_organization_id?: string | null
          department?: string | null
          email?: string
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          location?: string | null
          mailing_address?: string | null
          phone_number?: string | null
          preferred_language?: string
          role?: Database["public"]["Enums"]["app_role"]
          state?: string | null
          updated_at?: string
          user_id?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_organization_id_fkey"
            columns: ["default_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_blueprint: {
        Row: {
          business_changes: Json | null
          capability_gaps: Json | null
          created_at: string
          created_by: string | null
          current_state: string | null
          future_state: string | null
          id: string
          organization_id: string
          programme_id: string
          target_operating_model: string | null
          transformation_flow: string | null
          updated_at: string
          vision_statement: string | null
        }
        Insert: {
          business_changes?: Json | null
          capability_gaps?: Json | null
          created_at?: string
          created_by?: string | null
          current_state?: string | null
          future_state?: string | null
          id?: string
          organization_id: string
          programme_id: string
          target_operating_model?: string | null
          transformation_flow?: string | null
          updated_at?: string
          vision_statement?: string | null
        }
        Update: {
          business_changes?: Json | null
          capability_gaps?: Json | null
          created_at?: string
          created_by?: string | null
          current_state?: string | null
          future_state?: string | null
          id?: string
          organization_id?: string
          programme_id?: string
          target_operating_model?: string | null
          transformation_flow?: string | null
          updated_at?: string
          vision_statement?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programme_blueprint_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: true
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_definitions: {
        Row: {
          constraints: string | null
          created_at: string
          created_by: string | null
          dependencies: string | null
          id: string
          key_assumptions: string | null
          organization_id: string
          out_of_scope: string | null
          programme_id: string
          scope_statement: string | null
          strategic_objectives: string | null
          success_criteria: string | null
          updated_at: string
          vision_statement: string | null
        }
        Insert: {
          constraints?: string | null
          created_at?: string
          created_by?: string | null
          dependencies?: string | null
          id?: string
          key_assumptions?: string | null
          organization_id: string
          out_of_scope?: string | null
          programme_id: string
          scope_statement?: string | null
          strategic_objectives?: string | null
          success_criteria?: string | null
          updated_at?: string
          vision_statement?: string | null
        }
        Update: {
          constraints?: string | null
          created_at?: string
          created_by?: string | null
          dependencies?: string | null
          id?: string
          key_assumptions?: string | null
          organization_id?: string
          out_of_scope?: string | null
          programme_id?: string
          scope_statement?: string | null
          strategic_objectives?: string | null
          success_criteria?: string | null
          updated_at?: string
          vision_statement?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programme_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programme_definitions_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: true
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_stakeholders: {
        Row: {
          created_at: string
          id: string
          programme_id: string
          stakeholder_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          programme_id: string
          stakeholder_id: string
        }
        Update: {
          created_at?: string
          id?: string
          programme_id?: string
          stakeholder_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_stakeholders_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programme_stakeholders_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_success_plan: {
        Row: {
          benefit_links: Json | null
          created_at: string
          created_by: string | null
          governance_arrangements: string | null
          id: string
          measurement_approach: string | null
          organization_id: string
          programme_id: string
          review_cadence: string | null
          success_criteria: Json | null
          updated_at: string
        }
        Insert: {
          benefit_links?: Json | null
          created_at?: string
          created_by?: string | null
          governance_arrangements?: string | null
          id?: string
          measurement_approach?: string | null
          organization_id: string
          programme_id: string
          review_cadence?: string | null
          success_criteria?: Json | null
          updated_at?: string
        }
        Update: {
          benefit_links?: Json | null
          created_at?: string
          created_by?: string | null
          governance_arrangements?: string | null
          id?: string
          measurement_approach?: string | null
          organization_id?: string
          programme_id?: string
          review_cadence?: string | null
          success_criteria?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_success_plan_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: true
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_tranches: {
        Row: {
          benefits_realized: string | null
          capabilities_delivered: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          organization_id: string
          programme_id: string
          sequence_number: number
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          benefits_realized?: string | null
          capabilities_delivered?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          organization_id: string
          programme_id: string
          sequence_number?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          benefits_realized?: string | null
          capabilities_delivered?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          organization_id?: string
          programme_id?: string
          sequence_number?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_tranches_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      programmes: {
        Row: {
          benefits_target: string | null
          budget: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          manager_id: string | null
          name: string
          organization_id: string
          programme_kind: string
          progress: number
          reference_number: string | null
          sponsor: string | null
          start_date: string | null
          status: string
          timesheets_enabled: boolean
          tranche: string | null
          updated_at: string
        }
        Insert: {
          benefits_target?: string | null
          budget?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          manager_id?: string | null
          name: string
          organization_id: string
          programme_kind?: string
          progress?: number
          reference_number?: string | null
          sponsor?: string | null
          start_date?: string | null
          status?: string
          timesheets_enabled?: boolean
          tranche?: string | null
          updated_at?: string
        }
        Update: {
          benefits_target?: string | null
          budget?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          manager_id?: string | null
          name?: string
          organization_id?: string
          programme_kind?: string
          progress?: number
          reference_number?: string | null
          sponsor?: string | null
          start_date?: string | null
          status?: string
          timesheets_enabled?: boolean
          tranche?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programmes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      project_lifecycle_phases: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          organization_id: string
          phase: string
          project_id: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          phase: string
          project_id: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          phase?: string
          project_id?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_lifecycle_phases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_lifecycle_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_report_recipients: {
        Row: {
          created_at: string
          created_by: string | null
          day_of_week: number
          display_name: string | null
          email: string
          frequency: string
          id: string
          is_active: boolean
          last_sent_at: string | null
          organization_id: string
          project_id: string
          report_kind: string
          role: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          day_of_week?: number
          display_name?: string | null
          email: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_sent_at?: string | null
          organization_id: string
          project_id: string
          report_kind?: string
          role?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          day_of_week?: number
          display_name?: string | null
          email?: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_sent_at?: string | null
          organization_id?: string
          project_id?: string
          report_kind?: string
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_report_recipients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_report_recipients_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_name: string | null
          contract_currency: string | null
          contract_form: string | null
          contract_value: number | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          health: string
          id: string
          manager_id: string | null
          methodology: string
          name: string
          organization_id: string
          priority: string
          programme_id: string | null
          project_kind: string
          reference_number: string | null
          source_award_id: string | null
          source_bid_id: string | null
          source_opportunity_id: string | null
          source_rfp_id: string | null
          stage: string
          start_date: string | null
          timesheets_enabled: boolean
          updated_at: string
        }
        Insert: {
          client_name?: string | null
          contract_currency?: string | null
          contract_form?: string | null
          contract_value?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          health?: string
          id?: string
          manager_id?: string | null
          methodology?: string
          name: string
          organization_id: string
          priority?: string
          programme_id?: string | null
          project_kind?: string
          reference_number?: string | null
          source_award_id?: string | null
          source_bid_id?: string | null
          source_opportunity_id?: string | null
          source_rfp_id?: string | null
          stage?: string
          start_date?: string | null
          timesheets_enabled?: boolean
          updated_at?: string
        }
        Update: {
          client_name?: string | null
          contract_currency?: string | null
          contract_form?: string | null
          contract_value?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          health?: string
          id?: string
          manager_id?: string | null
          methodology?: string
          name?: string
          organization_id?: string
          priority?: string
          programme_id?: string | null
          project_kind?: string
          reference_number?: string | null
          source_award_id?: string | null
          source_bid_id?: string | null
          source_opportunity_id?: string | null
          source_rfp_id?: string | null
          stage?: string
          start_date?: string | null
          timesheets_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_source_award_fk"
            columns: ["source_award_id"]
            isOneToOne: false
            referencedRelation: "vertical_entity_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_source_bid_fk"
            columns: ["source_bid_id"]
            isOneToOne: false
            referencedRelation: "vertical_entity_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_source_opportunity_fk"
            columns: ["source_opportunity_id"]
            isOneToOne: false
            referencedRelation: "vertical_entity_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_source_rfp_fk"
            columns: ["source_rfp_id"]
            isOneToOne: false
            referencedRelation: "vertical_entity_records"
            referencedColumns: ["id"]
          },
        ]
      }
      punch_list_items: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          description: string
          due_date: string | null
          id: string
          identified_by: string | null
          item_number: string | null
          location: string | null
          organization_id: string
          priority: string
          project_id: string | null
          status: string
          trade: string | null
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          identified_by?: string | null
          item_number?: string | null
          location?: string | null
          organization_id: string
          priority?: string
          project_id?: string | null
          status?: string
          trade?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          identified_by?: string | null
          item_number?: string | null
          location?: string | null
          organization_id?: string
          priority?: string
          project_id?: string | null
          status?: string
          trade?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "punch_list_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punch_list_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_criteria: {
        Row: {
          acceptance_test: string | null
          created_at: string
          created_by: string | null
          criterion: string
          id: string
          method: string | null
          organization_id: string
          priority: string
          product_id: string | null
          programme_id: string | null
          project_id: string | null
          status: string
          tolerance: string | null
          updated_at: string
          work_package_id: string | null
        }
        Insert: {
          acceptance_test?: string | null
          created_at?: string
          created_by?: string | null
          criterion: string
          id?: string
          method?: string | null
          organization_id: string
          priority?: string
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          status?: string
          tolerance?: string | null
          updated_at?: string
          work_package_id?: string | null
        }
        Update: {
          acceptance_test?: string | null
          created_at?: string
          created_by?: string | null
          criterion?: string
          id?: string
          method?: string | null
          organization_id?: string
          priority?: string
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          status?: string
          tolerance?: string | null
          updated_at?: string
          work_package_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_criteria_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_criteria_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_criteria_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_criteria_work_package_id_fkey"
            columns: ["work_package_id"]
            isOneToOne: false
            referencedRelation: "work_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_records: {
        Row: {
          acceptance_criteria: string | null
          actual_date: string | null
          approval_comments: string | null
          approval_date: string | null
          approved: boolean | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          defects_found: number | null
          deliverable_name: string | null
          deliverable_version: string | null
          description: string | null
          id: string
          organization_id: string
          owner_id: string | null
          planned_date: string | null
          product_id: string | null
          programme_id: string | null
          project_id: string | null
          quality_criteria: string[] | null
          quality_type: string
          reference_number: string
          results: string | null
          review_method: string | null
          reviewer_id: string | null
          reviewers: string[] | null
          status: Database["public"]["Enums"]["quality_status"]
          title: string
          updated_at: string
        }
        Insert: {
          acceptance_criteria?: string | null
          actual_date?: string | null
          approval_comments?: string | null
          approval_date?: string | null
          approved?: boolean | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          defects_found?: number | null
          deliverable_name?: string | null
          deliverable_version?: string | null
          description?: string | null
          id?: string
          organization_id: string
          owner_id?: string | null
          planned_date?: string | null
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          quality_criteria?: string[] | null
          quality_type?: string
          reference_number: string
          results?: string | null
          review_method?: string | null
          reviewer_id?: string | null
          reviewers?: string[] | null
          status?: Database["public"]["Enums"]["quality_status"]
          title: string
          updated_at?: string
        }
        Update: {
          acceptance_criteria?: string | null
          actual_date?: string | null
          approval_comments?: string | null
          approval_date?: string | null
          approved?: boolean | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          defects_found?: number | null
          deliverable_name?: string | null
          deliverable_version?: string | null
          description?: string | null
          id?: string
          organization_id?: string
          owner_id?: string | null
          planned_date?: string | null
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          quality_criteria?: string[] | null
          quality_type?: string
          reference_number?: string
          results?: string | null
          review_method?: string | null
          reviewer_id?: string | null
          reviewers?: string[] | null
          status?: Database["public"]["Enums"]["quality_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_records_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_records_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_reviews: {
        Row: {
          conditions: string | null
          created_at: string
          evidence_document_id: string | null
          findings: string | null
          id: string
          organization_id: string
          quality_criteria_id: string
          result: string
          reviewed_at: string
          reviewer_id: string | null
        }
        Insert: {
          conditions?: string | null
          created_at?: string
          evidence_document_id?: string | null
          findings?: string | null
          id?: string
          organization_id: string
          quality_criteria_id: string
          result: string
          reviewed_at?: string
          reviewer_id?: string | null
        }
        Update: {
          conditions?: string | null
          created_at?: string
          evidence_document_id?: string | null
          findings?: string | null
          id?: string
          organization_id?: string
          quality_criteria_id?: string
          result?: string
          reviewed_at?: string
          reviewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_reviews_evidence_document_id_fkey"
            columns: ["evidence_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_reviews_quality_criteria_id_fkey"
            columns: ["quality_criteria_id"]
            isOneToOne: false
            referencedRelation: "quality_criteria"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_sequences: {
        Row: {
          entity_type: string
          next_value: number
          organization_id: string
          updated_at: string
          year: number
        }
        Insert: {
          entity_type: string
          next_value?: number
          organization_id: string
          updated_at?: string
          year: number
        }
        Update: {
          entity_type?: string
          next_value?: number
          organization_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "reference_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      residency_audit_log: {
        Row: {
          created_at: string
          decision: string
          enforcement_mode: string
          id: string
          metadata: Json
          operation: string
          org_region: string
          organization_id: string
          processing_region: string | null
          resource_id: string | null
          resource_type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          decision: string
          enforcement_mode: string
          id?: string
          metadata?: Json
          operation: string
          org_region: string
          organization_id: string
          processing_region?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          decision?: string
          enforcement_mode?: string
          id?: string
          metadata?: Json
          operation?: string
          org_region?: string
          organization_id?: string
          processing_region?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "residency_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      retainers: {
        Row: {
          client_name: string
          created_at: string
          engagement_id: string | null
          hours_allocated: number
          hours_consumed: number
          id: string
          monthly_value: number | null
          notes: string | null
          organization_id: string
          period_end: string
          period_start: string
          rollover_allowed: boolean
          status: string
          updated_at: string
        }
        Insert: {
          client_name: string
          created_at?: string
          engagement_id?: string | null
          hours_allocated?: number
          hours_consumed?: number
          id?: string
          monthly_value?: number | null
          notes?: string | null
          organization_id: string
          period_end: string
          period_start: string
          rollover_allowed?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          client_name?: string
          created_at?: string
          engagement_id?: string | null
          hours_allocated?: number
          hours_consumed?: number
          id?: string
          monthly_value?: number | null
          notes?: string | null
          organization_id?: string
          period_end?: string
          period_start?: string
          rollover_allowed?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retainers_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "client_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retainers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rfis: {
        Row: {
          assigned_to: string | null
          created_at: string
          due_date: string | null
          id: string
          organization_id: string
          priority: string
          project_id: string | null
          question: string
          responded_at: string | null
          response: string | null
          rfi_number: string
          status: string
          subject: string
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          organization_id: string
          priority?: string
          project_id?: string | null
          question: string
          responded_at?: string | null
          response?: string | null
          rfi_number: string
          status?: string
          subject: string
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          organization_id?: string
          priority?: string
          project_id?: string | null
          question?: string
          responded_at?: string | null
          response?: string | null
          rfi_number?: string
          status?: string
          subject?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfis_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfis_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      risks: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          date_identified: string | null
          description: string | null
          id: string
          impact: string
          organization_id: string
          owner_id: string | null
          probability: string
          product_id: string | null
          programme_id: string | null
          project_id: string | null
          reference_number: string | null
          response: string | null
          review_date: string | null
          score: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          date_identified?: string | null
          description?: string | null
          id?: string
          impact?: string
          organization_id: string
          owner_id?: string | null
          probability?: string
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          reference_number?: string | null
          response?: string | null
          review_date?: string | null
          score?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          date_identified?: string | null
          description?: string | null
          id?: string
          impact?: string
          organization_id?: string
          owner_id?: string | null
          probability?: string
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          reference_number?: string | null
          response?: string | null
          review_date?: string | null
          score?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risks_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      role_field_permissions: {
        Row: {
          created_at: string
          field_name: string
          id: string
          module_key: string
          role_id: string
          visibility: string
        }
        Insert: {
          created_at?: string
          field_name: string
          id?: string
          module_key: string
          role_id: string
          visibility?: string
        }
        Update: {
          created_at?: string
          field_name?: string
          id?: string
          module_key?: string
          role_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_field_permissions_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "permission_modules"
            referencedColumns: ["module_key"]
          },
          {
            foreignKeyName: "role_field_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_module_permissions: {
        Row: {
          can_approve: boolean
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_export: boolean
          can_view: boolean
          created_at: string
          id: string
          module_key: string
          role_id: string
          updated_at: string
        }
        Insert: {
          can_approve?: boolean
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module_key: string
          role_id: string
          updated_at?: string
        }
        Update: {
          can_approve?: boolean
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module_key?: string
          role_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_module_permissions_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "permission_modules"
            referencedColumns: ["module_key"]
          },
          {
            foreignKeyName: "role_module_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_reports: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          organization_id: string | null
          query: string
          template_key: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          organization_id?: string | null
          query: string
          template_key?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          organization_id?: string | null
          query?: string
          template_key?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_reports: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          format: string
          frequency: string
          id: string
          last_run_at: string | null
          next_run_at: string | null
          organization_id: string | null
          query: string
          recipients: string[]
          template_key: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          format?: string
          frequency?: string
          id?: string
          last_run_at?: string | null
          next_run_at?: string | null
          organization_id?: string | null
          query: string
          recipients?: string[]
          template_key?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          format?: string
          frequency?: string
          id?: string
          last_run_at?: string | null
          next_run_at?: string | null
          organization_id?: string | null
          query?: string
          recipients?: string[]
          template_key?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scim_group_role_mappings: {
        Row: {
          access_level: string
          created_at: string
          created_by: string | null
          custom_role_id: string | null
          id: string
          organization_id: string
          priority: number
          scim_group_name: string
          updated_at: string
        }
        Insert: {
          access_level: string
          created_at?: string
          created_by?: string | null
          custom_role_id?: string | null
          id?: string
          organization_id: string
          priority?: number
          scim_group_name: string
          updated_at?: string
        }
        Update: {
          access_level?: string
          created_at?: string
          created_by?: string | null
          custom_role_id?: string | null
          id?: string
          organization_id?: string
          priority?: number
          scim_group_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scim_group_role_mappings_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scim_group_role_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scim_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          default_access_level: string
          expires_at: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          name: string
          organization_id: string
          revoked_at: string | null
          revoked_by: string | null
          token_hash: string
          token_prefix: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_access_level?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name: string
          organization_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          token_hash: string
          token_prefix: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_access_level?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          organization_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          token_hash?: string
          token_prefix?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scim_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scim_user_sync_state: {
        Row: {
          active: boolean
          created_at: string
          external_id: string
          id: string
          last_synced_at: string
          organization_id: string
          scim_groups: string[]
          scim_username: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          external_id: string
          id?: string
          last_synced_at?: string
          organization_id: string
          scim_groups?: string[]
          scim_username?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          external_id?: string
          id?: string
          last_synced_at?: string
          organization_id?: string
          scim_groups?: string[]
          scim_username?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scim_user_sync_state_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_catalog_categories: {
        Row: {
          color: string
          created_at: string
          description: string | null
          icon: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      service_catalog_item_fields: {
        Row: {
          created_at: string
          field_key: string
          field_type: string
          help_text: string | null
          id: string
          is_required: boolean
          item_id: string
          label: string
          options: Json
          placeholder: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          field_key: string
          field_type: string
          help_text?: string | null
          id?: string
          is_required?: boolean
          item_id: string
          label: string
          options?: Json
          placeholder?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          field_key?: string
          field_type?: string
          help_text?: string | null
          id?: string
          is_required?: boolean
          item_id?: string
          label?: string
          options?: Json
          placeholder?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_catalog_item_fields_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "service_catalog_items"
            referencedColumns: ["id"]
          },
        ]
      }
      service_catalog_item_tasks: {
        Row: {
          created_at: string
          default_assignee_id: string | null
          default_priority: string
          description: string | null
          estimated_hours: number | null
          id: string
          item_id: string
          organization_id: string
          step_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_assignee_id?: string | null
          default_priority?: string
          description?: string | null
          estimated_hours?: number | null
          id?: string
          item_id: string
          organization_id: string
          step_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_assignee_id?: string | null
          default_priority?: string
          description?: string | null
          estimated_hours?: number | null
          id?: string
          item_id?: string
          organization_id?: string
          step_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_catalog_item_tasks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "service_catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_catalog_item_tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_catalog_items: {
        Row: {
          approval_policy: string
          approver_role: string | null
          approver_user_ids: string[]
          category_id: string | null
          cost_currency: string
          cost_estimate: number | null
          created_at: string
          created_by: string | null
          default_assignee_id: string | null
          default_assignee_team: string | null
          default_priority: Database["public"]["Enums"]["helpdesk_ticket_priority"]
          description: string | null
          estimated_fulfillment_hours: number | null
          icon: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          short_description: string | null
          sort_order: number
          tags: string[]
          updated_at: string
        }
        Insert: {
          approval_policy?: string
          approver_role?: string | null
          approver_user_ids?: string[]
          category_id?: string | null
          cost_currency?: string
          cost_estimate?: number | null
          created_at?: string
          created_by?: string | null
          default_assignee_id?: string | null
          default_assignee_team?: string | null
          default_priority?: Database["public"]["Enums"]["helpdesk_ticket_priority"]
          description?: string | null
          estimated_fulfillment_hours?: number | null
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          short_description?: string | null
          sort_order?: number
          tags?: string[]
          updated_at?: string
        }
        Update: {
          approval_policy?: string
          approver_role?: string | null
          approver_user_ids?: string[]
          category_id?: string | null
          cost_currency?: string
          cost_estimate?: number | null
          created_at?: string
          created_by?: string | null
          default_assignee_id?: string | null
          default_assignee_team?: string | null
          default_priority?: Database["public"]["Enums"]["helpdesk_ticket_priority"]
          description?: string | null
          estimated_fulfillment_hours?: number | null
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          short_description?: string | null
          sort_order?: number
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_catalog_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_catalog_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      service_catalog_request_approvals: {
        Row: {
          approver_user_id: string
          chain_id: string | null
          comment: string | null
          created_at: string
          decided_at: string | null
          id: string
          is_optional: boolean
          mode: string
          organization_id: string
          status: string
          step_name: string | null
          step_order: number
          ticket_id: string
          updated_at: string
        }
        Insert: {
          approver_user_id: string
          chain_id?: string | null
          comment?: string | null
          created_at?: string
          decided_at?: string | null
          id?: string
          is_optional?: boolean
          mode?: string
          organization_id: string
          status?: string
          step_name?: string | null
          step_order?: number
          ticket_id: string
          updated_at?: string
        }
        Update: {
          approver_user_id?: string
          chain_id?: string | null
          comment?: string | null
          created_at?: string
          decided_at?: string | null
          id?: string
          is_optional?: boolean
          mode?: string
          organization_id?: string
          status?: string
          step_name?: string | null
          step_order?: number
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_catalog_request_approvals_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_approval_chains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_catalog_request_approvals_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      service_catalog_request_data: {
        Row: {
          answers: Json
          cost_estimate: number | null
          created_at: string
          id: string
          item_id: string
          organization_id: string
          ticket_id: string
        }
        Insert: {
          answers?: Json
          cost_estimate?: number | null
          created_at?: string
          id?: string
          item_id: string
          organization_id: string
          ticket_id: string
        }
        Update: {
          answers?: Json
          cost_estimate?: number | null
          created_at?: string
          id?: string
          item_id?: string
          organization_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_catalog_request_data_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "service_catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_catalog_request_data_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "helpdesk_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      siem_export_log: {
        Row: {
          attempt: number
          created_at: string
          duration_ms: number | null
          event_count: number
          exporter_id: string
          http_status: number | null
          id: string
          organization_id: string
          response_body: string | null
          status: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          duration_ms?: number | null
          event_count?: number
          exporter_id: string
          http_status?: number | null
          id?: string
          organization_id: string
          response_body?: string | null
          status: string
        }
        Update: {
          attempt?: number
          created_at?: string
          duration_ms?: number | null
          event_count?: number
          exporter_id?: string
          http_status?: number | null
          id?: string
          organization_id?: string
          response_body?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "siem_export_log_exporter_id_fkey"
            columns: ["exporter_id"]
            isOneToOne: false
            referencedRelation: "siem_exporters"
            referencedColumns: ["id"]
          },
        ]
      }
      siem_exporters: {
        Row: {
          auth_header_name: string | null
          auth_secret_name: string | null
          consecutive_failures: number
          created_at: string
          created_by: string | null
          destination_type: string
          endpoint_url: string
          event_categories: string[]
          format: string
          id: string
          is_active: boolean
          last_delivery_at: string | null
          last_delivery_status: string | null
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          auth_header_name?: string | null
          auth_secret_name?: string | null
          consecutive_failures?: number
          created_at?: string
          created_by?: string | null
          destination_type: string
          endpoint_url: string
          event_categories?: string[]
          format?: string
          id?: string
          is_active?: boolean
          last_delivery_at?: string | null
          last_delivery_status?: string | null
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          auth_header_name?: string | null
          auth_secret_name?: string | null
          consecutive_failures?: number
          created_at?: string
          created_by?: string | null
          destination_type?: string
          endpoint_url?: string
          event_categories?: string[]
          format?: string
          id?: string
          is_active?: boolean
          last_delivery_at?: string | null
          last_delivery_status?: string | null
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "siem_exporters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      software_licenses: {
        Row: {
          auto_renew: boolean
          cost: number | null
          cost_currency: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          license_key: string | null
          license_type: string
          name: string
          notes: string | null
          organization_id: string
          purchase_date: string | null
          software_name: string
          status: string
          total_seats: number
          updated_at: string
          vendor: string | null
        }
        Insert: {
          auto_renew?: boolean
          cost?: number | null
          cost_currency?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          license_key?: string | null
          license_type?: string
          name: string
          notes?: string | null
          organization_id: string
          purchase_date?: string | null
          software_name: string
          status?: string
          total_seats?: number
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          auto_renew?: boolean
          cost?: number | null
          cost_currency?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          license_key?: string | null
          license_type?: string
          name?: string
          notes?: string | null
          organization_id?: string
          purchase_date?: string | null
          software_name?: string
          status?: string
          total_seats?: number
          updated_at?: string
          vendor?: string | null
        }
        Relationships: []
      }
      sprints: {
        Row: {
          capacity_points: number | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          organization_id: string
          product_id: string | null
          programme_id: string | null
          project_id: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          capacity_points?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          organization_id: string
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          capacity_points?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          organization_id?: string
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sprints_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprints_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprints_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      sso_configurations: {
        Row: {
          acs_url: string | null
          activated_at: string | null
          allowed_domains: string[]
          attribute_mapping: Json
          created_at: string
          default_access_level: string
          domains_verified_at: string | null
          entity_id: string | null
          id: string
          metadata_url: string | null
          notes: string | null
          oidc_client_id: string | null
          oidc_client_secret_name: string | null
          oidc_issuer_url: string | null
          oidc_scopes: string[]
          organization_id: string
          provider_type: string
          provisioning_notes: string | null
          requested_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sso_config_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          acs_url?: string | null
          activated_at?: string | null
          allowed_domains?: string[]
          attribute_mapping?: Json
          created_at?: string
          default_access_level?: string
          domains_verified_at?: string | null
          entity_id?: string | null
          id?: string
          metadata_url?: string | null
          notes?: string | null
          oidc_client_id?: string | null
          oidc_client_secret_name?: string | null
          oidc_issuer_url?: string | null
          oidc_scopes?: string[]
          organization_id: string
          provider_type?: string
          provisioning_notes?: string | null
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sso_config_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          acs_url?: string | null
          activated_at?: string | null
          allowed_domains?: string[]
          attribute_mapping?: Json
          created_at?: string
          default_access_level?: string
          domains_verified_at?: string | null
          entity_id?: string | null
          id?: string
          metadata_url?: string | null
          notes?: string | null
          oidc_client_id?: string | null
          oidc_client_secret_name?: string | null
          oidc_issuer_url?: string | null
          oidc_scopes?: string[]
          organization_id?: string
          provider_type?: string
          provisioning_notes?: string | null
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sso_config_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sso_configurations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sso_jit_provisioning_log: {
        Row: {
          access_level_granted: string | null
          created_at: string
          email: string
          email_domain: string
          error_message: string | null
          id: string
          metadata: Json
          organization_id: string
          provider: string
          sso_config_id: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          access_level_granted?: string | null
          created_at?: string
          email: string
          email_domain: string
          error_message?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          provider: string
          sso_config_id?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          access_level_granted?: string | null
          created_at?: string
          email?: string
          email_domain?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          provider?: string
          sso_config_id?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sso_jit_provisioning_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sso_jit_provisioning_log_sso_config_id_fkey"
            columns: ["sso_config_id"]
            isOneToOne: false
            referencedRelation: "sso_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_gate_approvals: {
        Row: {
          comments: string | null
          conditions: string | null
          created_at: string
          decision: string
          id: string
          is_required: boolean
          organization_id: string
          reviewer_id: string
          reviewer_role: string | null
          signed_at: string | null
          stage_gate_id: string
          updated_at: string
        }
        Insert: {
          comments?: string | null
          conditions?: string | null
          created_at?: string
          decision?: string
          id?: string
          is_required?: boolean
          organization_id: string
          reviewer_id: string
          reviewer_role?: string | null
          signed_at?: string | null
          stage_gate_id: string
          updated_at?: string
        }
        Update: {
          comments?: string | null
          conditions?: string | null
          created_at?: string
          decision?: string
          id?: string
          is_required?: boolean
          organization_id?: string
          reviewer_id?: string
          reviewer_role?: string | null
          signed_at?: string | null
          stage_gate_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_gate_approvals_stage_gate_id_fkey"
            columns: ["stage_gate_id"]
            isOneToOne: false
            referencedRelation: "stage_gates"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_gates: {
        Row: {
          actual_date: string | null
          attendees: string[] | null
          created_at: string
          created_by: string | null
          criteria_met: Json | null
          decision_date: string | null
          decision_notes: string | null
          description: string | null
          entry_criteria: string[] | null
          exit_criteria: string[] | null
          gate_decision: Database["public"]["Enums"]["gate_decision"]
          id: string
          name: string
          organization_id: string
          owner_id: string | null
          planned_date: string | null
          programme_id: string | null
          project_id: string | null
          reference_number: string | null
          review_date: string | null
          reviewed_by: string | null
          stage_number: number
          updated_at: string
        }
        Insert: {
          actual_date?: string | null
          attendees?: string[] | null
          created_at?: string
          created_by?: string | null
          criteria_met?: Json | null
          decision_date?: string | null
          decision_notes?: string | null
          description?: string | null
          entry_criteria?: string[] | null
          exit_criteria?: string[] | null
          gate_decision?: Database["public"]["Enums"]["gate_decision"]
          id?: string
          name: string
          organization_id: string
          owner_id?: string | null
          planned_date?: string | null
          programme_id?: string | null
          project_id?: string | null
          reference_number?: string | null
          review_date?: string | null
          reviewed_by?: string | null
          stage_number: number
          updated_at?: string
        }
        Update: {
          actual_date?: string | null
          attendees?: string[] | null
          created_at?: string
          created_by?: string | null
          criteria_met?: Json | null
          decision_date?: string | null
          decision_notes?: string | null
          description?: string | null
          entry_criteria?: string[] | null
          exit_criteria?: string[] | null
          gate_decision?: Database["public"]["Enums"]["gate_decision"]
          id?: string
          name?: string
          organization_id?: string
          owner_id?: string | null
          planned_date?: string | null
          programme_id?: string | null
          project_id?: string | null
          reference_number?: string | null
          review_date?: string | null
          reviewed_by?: string | null
          stage_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_gates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_gates_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_gates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      stakeholder_portal_access: {
        Row: {
          created_at: string
          expires_at: string | null
          granted_by: string | null
          id: string
          organization_id: string
          scope_id: string
          scope_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          organization_id: string
          scope_id: string
          scope_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          organization_id?: string
          scope_id?: string
          scope_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stakeholder_portal_access_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stakeholders: {
        Row: {
          communication_frequency: string | null
          created_at: string
          created_by: string | null
          email: string | null
          engagement: string
          id: string
          influence: string
          interest: string
          last_contact: string | null
          name: string
          organization: string | null
          organization_id: string
          product_id: string | null
          programme_id: string | null
          project_id: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          communication_frequency?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          engagement?: string
          id?: string
          influence?: string
          interest?: string
          last_contact?: string | null
          name: string
          organization?: string | null
          organization_id: string
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          communication_frequency?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          engagement?: string
          id?: string
          influence?: string
          interest?: string
          last_contact?: string | null
          name?: string
          organization?: string | null
          organization_id?: string
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stakeholders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stakeholders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stakeholders_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stakeholders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      status_history: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          new_status: string
          old_status: string | null
          reason: string | null
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          new_status: string
          old_status?: string | null
          reason?: string | null
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          new_status?: string
          old_status?: string | null
          reason?: string | null
        }
        Relationships: []
      }
      status_page_components: {
        Row: {
          ci_id: string | null
          created_at: string
          current_status: string
          description: string | null
          display_order: number
          group_name: string | null
          id: string
          is_public: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          ci_id?: string | null
          created_at?: string
          current_status?: string
          description?: string | null
          display_order?: number
          group_name?: string | null
          id?: string
          is_public?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          ci_id?: string | null
          created_at?: string
          current_status?: string
          description?: string | null
          display_order?: number
          group_name?: string | null
          id?: string
          is_public?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_page_components_ci_id_fkey"
            columns: ["ci_id"]
            isOneToOne: false
            referencedRelation: "cmdb_ci_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_page_components_ci_id_fkey"
            columns: ["ci_id"]
            isOneToOne: false
            referencedRelation: "configuration_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_page_components_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      status_page_incident_updates: {
        Row: {
          created_at: string
          id: string
          message: string
          organization_id: string
          posted_by: string | null
          status: string
          status_incident_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          organization_id: string
          posted_by?: string | null
          status: string
          status_incident_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          organization_id?: string
          posted_by?: string | null
          status?: string
          status_incident_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_page_incident_updates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_page_incident_updates_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_page_incident_updates_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_page_incident_updates_status_incident_id_fkey"
            columns: ["status_incident_id"]
            isOneToOne: false
            referencedRelation: "status_page_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      status_page_incidents: {
        Row: {
          affected_component_ids: string[] | null
          created_at: string
          created_by: string | null
          id: string
          impact: string
          is_published: boolean
          major_incident_id: string | null
          organization_id: string
          resolved_at: string | null
          started_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          affected_component_ids?: string[] | null
          created_at?: string
          created_by?: string | null
          id?: string
          impact?: string
          is_published?: boolean
          major_incident_id?: string | null
          organization_id: string
          resolved_at?: string | null
          started_at?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          affected_component_ids?: string[] | null
          created_at?: string
          created_by?: string | null
          id?: string
          impact?: string
          is_published?: boolean
          major_incident_id?: string | null
          organization_id?: string
          resolved_at?: string | null
          started_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_page_incidents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_page_incidents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_page_incidents_major_incident_id_fkey"
            columns: ["major_incident_id"]
            isOneToOne: false
            referencedRelation: "major_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_page_incidents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      status_page_subscribers: {
        Row: {
          confirmed_at: string | null
          created_at: string
          email: string
          id: string
          organization_id: string
          unsubscribe_token: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          email: string
          id?: string
          organization_id: string
          unsubscribe_token?: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          email?: string
          id?: string
          organization_id?: string
          unsubscribe_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_page_subscribers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      submittals: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          organization_id: string
          project_id: string | null
          reviewed_at: string | null
          reviewer: string | null
          spec_section: string | null
          status: string
          submittal_number: string
          submitted_by: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id: string
          project_id?: string | null
          reviewed_at?: string | null
          reviewer?: string | null
          spec_section?: string | null
          status?: string
          submittal_number: string
          submitted_by?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id?: string
          project_id?: string | null
          reviewed_at?: string | null
          reviewer?: string | null
          spec_section?: string | null
          status?: string
          submittal_number?: string
          submitted_by?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submittals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submittals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          billing_interval: string
          billing_model: string
          created_at: string
          cta_label: string | null
          currency: string
          description: string | null
          features: Json | null
          highlight: boolean
          id: string
          is_active: boolean | null
          is_addon: boolean
          is_archived: boolean
          is_public: boolean
          last_synced_at: string | null
          max_products: number | null
          max_programmes: number | null
          max_projects: number | null
          max_storage_mb: number | null
          max_users: number | null
          name: string
          plan_kind: string
          price_monthly: number | null
          price_yearly: number | null
          sort_order: number | null
          stripe_lookup_key_monthly: string | null
          stripe_lookup_key_yearly: string | null
          stripe_price_id_monthly: string | null
          stripe_price_id_yearly: string | null
          stripe_product_id: string | null
          sync_status: string | null
          target_audience: string | null
          trial_days: number
          updated_at: string
        }
        Insert: {
          billing_interval?: string
          billing_model?: string
          created_at?: string
          cta_label?: string | null
          currency?: string
          description?: string | null
          features?: Json | null
          highlight?: boolean
          id?: string
          is_active?: boolean | null
          is_addon?: boolean
          is_archived?: boolean
          is_public?: boolean
          last_synced_at?: string | null
          max_products?: number | null
          max_programmes?: number | null
          max_projects?: number | null
          max_storage_mb?: number | null
          max_users?: number | null
          name: string
          plan_kind?: string
          price_monthly?: number | null
          price_yearly?: number | null
          sort_order?: number | null
          stripe_lookup_key_monthly?: string | null
          stripe_lookup_key_yearly?: string | null
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          stripe_product_id?: string | null
          sync_status?: string | null
          target_audience?: string | null
          trial_days?: number
          updated_at?: string
        }
        Update: {
          billing_interval?: string
          billing_model?: string
          created_at?: string
          cta_label?: string | null
          currency?: string
          description?: string | null
          features?: Json | null
          highlight?: boolean
          id?: string
          is_active?: boolean | null
          is_addon?: boolean
          is_archived?: boolean
          is_public?: boolean
          last_synced_at?: string | null
          max_products?: number | null
          max_programmes?: number | null
          max_projects?: number | null
          max_storage_mb?: number | null
          max_users?: number | null
          name?: string
          plan_kind?: string
          price_monthly?: number | null
          price_yearly?: number | null
          sort_order?: number | null
          stripe_lookup_key_monthly?: string | null
          stripe_lookup_key_yearly?: string | null
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          stripe_product_id?: string | null
          sync_status?: string | null
          target_audience?: string | null
          trial_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      success_plans: {
        Row: {
          created_at: string
          created_by: string | null
          critical_success_factors: string | null
          id: string
          key_milestones: string | null
          organization_id: string
          programme_id: string
          resource_requirements: string | null
          review_schedule: string | null
          risk_mitigation: string | null
          success_measures: string | null
          target_outcomes: string | null
          timeline_summary: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          critical_success_factors?: string | null
          id?: string
          key_milestones?: string | null
          organization_id: string
          programme_id: string
          resource_requirements?: string | null
          review_schedule?: string | null
          risk_mitigation?: string | null
          success_measures?: string | null
          target_outcomes?: string | null
          timeline_summary?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          critical_success_factors?: string | null
          id?: string
          key_milestones?: string | null
          organization_id?: string
          programme_id?: string
          resource_requirements?: string | null
          review_schedule?: string | null
          risk_mitigation?: string | null
          success_measures?: string | null
          target_outcomes?: string | null
          timeline_summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "success_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "success_plans_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: true
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          is_internal: boolean
          ticket_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          organization_id: string | null
          priority: string
          resolution: string | null
          resolved_at: string | null
          status: string
          subject: string
          type: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          organization_id?: string | null
          priority?: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          subject: string
          type?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          organization_id?: string | null
          priority?: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          subject?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      task_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          organization_id: string | null
          role: string | null
          task_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          organization_id?: string | null
          role?: string | null
          task_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          organization_id?: string | null
          role?: string | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string
          body: string | null
          completion_percentage: number | null
          created_at: string
          id: string
          new_status: Database["public"]["Enums"]["task_status"] | null
          organization_id: string
          previous_status: Database["public"]["Enums"]["task_status"] | null
          task_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body?: string | null
          completion_percentage?: number | null
          created_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["task_status"] | null
          organization_id: string
          previous_status?: Database["public"]["Enums"]["task_status"] | null
          task_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string | null
          completion_percentage?: number | null
          created_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["task_status"] | null
          organization_id?: string
          previous_status?: Database["public"]["Enums"]["task_status"] | null
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_end: string | null
          actual_hours: number | null
          actual_start: string | null
          assigned_to: string | null
          completion_percentage: number
          created_at: string
          created_by: string | null
          depends_on: string[] | null
          description: string | null
          estimated_hours: number | null
          feature_id: string | null
          id: string
          issue_id: string | null
          milestone_id: string | null
          name: string
          organization_id: string
          parent_task_id: string | null
          planned_end: string | null
          planned_start: string | null
          priority: string
          product_id: string | null
          programme_id: string | null
          project_id: string | null
          reference_number: string | null
          risk_id: string | null
          sprint_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          story_points: number | null
          updated_at: string
          work_package_id: string | null
        }
        Insert: {
          actual_end?: string | null
          actual_hours?: number | null
          actual_start?: string | null
          assigned_to?: string | null
          completion_percentage?: number
          created_at?: string
          created_by?: string | null
          depends_on?: string[] | null
          description?: string | null
          estimated_hours?: number | null
          feature_id?: string | null
          id?: string
          issue_id?: string | null
          milestone_id?: string | null
          name: string
          organization_id: string
          parent_task_id?: string | null
          planned_end?: string | null
          planned_start?: string | null
          priority?: string
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          reference_number?: string | null
          risk_id?: string | null
          sprint_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          story_points?: number | null
          updated_at?: string
          work_package_id?: string | null
        }
        Update: {
          actual_end?: string | null
          actual_hours?: number | null
          actual_start?: string | null
          assigned_to?: string | null
          completion_percentage?: number
          created_at?: string
          created_by?: string | null
          depends_on?: string[] | null
          description?: string | null
          estimated_hours?: number | null
          feature_id?: string | null
          id?: string
          issue_id?: string | null
          milestone_id?: string | null
          name?: string
          organization_id?: string
          parent_task_id?: string | null
          planned_end?: string | null
          planned_start?: string | null
          priority?: string
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          reference_number?: string | null
          risk_id?: string | null
          sprint_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          story_points?: number | null
          updated_at?: string
          work_package_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "product_features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_risk_id_fkey"
            columns: ["risk_id"]
            isOneToOne: false
            referencedRelation: "risks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_requirements: {
        Row: {
          acceptance_criteria: string | null
          business_requirement_id: string | null
          category: string
          created_at: string
          created_by: string | null
          dependencies: string | null
          description: string | null
          id: string
          name: string
          organization_id: string
          owner_id: string | null
          priority: string
          product_id: string | null
          programme_id: string | null
          project_id: string | null
          reference_number: string
          status: string
          technical_specification: string | null
          updated_at: string
        }
        Insert: {
          acceptance_criteria?: string | null
          business_requirement_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          dependencies?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id: string
          owner_id?: string | null
          priority?: string
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          reference_number: string
          status?: string
          technical_specification?: string | null
          updated_at?: string
        }
        Update: {
          acceptance_criteria?: string | null
          business_requirement_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          dependencies?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          owner_id?: string | null
          priority?: string
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          reference_number?: string
          status?: string
          technical_specification?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_requirements_business_requirement_id_fkey"
            columns: ["business_requirement_id"]
            isOneToOne: false
            referencedRelation: "business_requirements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_requirements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_requirements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_requirements_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_requirements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_entries: {
        Row: {
          created_at: string
          description: string | null
          hours_fri: number
          hours_mon: number
          hours_sat: number
          hours_sun: number
          hours_thu: number
          hours_tue: number
          hours_wed: number
          id: string
          product_id: string | null
          programme_id: string | null
          project_id: string | null
          sort_order: number
          task_id: string | null
          ticket_id: string | null
          timesheet_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          hours_fri?: number
          hours_mon?: number
          hours_sat?: number
          hours_sun?: number
          hours_thu?: number
          hours_tue?: number
          hours_wed?: number
          id?: string
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          sort_order?: number
          task_id?: string | null
          ticket_id?: string | null
          timesheet_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          hours_fri?: number
          hours_mon?: number
          hours_sat?: number
          hours_sun?: number
          hours_thu?: number
          hours_tue?: number
          hours_wed?: number
          id?: string
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          sort_order?: number
          task_id?: string | null
          ticket_id?: string | null
          timesheet_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_entries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_entries_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_entries_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_entries_timesheet_id_fkey"
            columns: ["timesheet_id"]
            isOneToOne: false
            referencedRelation: "timesheets"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheets: {
        Row: {
          approver_id: string | null
          approver_signature_image: string | null
          approver_signature_ip: string | null
          approver_signature_name: string | null
          created_at: string
          decided_at: string | null
          decision_notes: string | null
          id: string
          notes: string | null
          organization_id: string
          period_end: string
          period_start: string
          reference_number: string | null
          status: Database["public"]["Enums"]["timesheet_status"]
          submitted_at: string | null
          submitter_signature_image: string | null
          submitter_signature_ip: string | null
          submitter_signature_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approver_id?: string | null
          approver_signature_image?: string | null
          approver_signature_ip?: string | null
          approver_signature_name?: string | null
          created_at?: string
          decided_at?: string | null
          decision_notes?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          period_end: string
          period_start: string
          reference_number?: string | null
          status?: Database["public"]["Enums"]["timesheet_status"]
          submitted_at?: string | null
          submitter_signature_image?: string | null
          submitter_signature_ip?: string | null
          submitter_signature_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approver_id?: string | null
          approver_signature_image?: string | null
          approver_signature_ip?: string | null
          approver_signature_name?: string | null
          created_at?: string
          decided_at?: string | null
          decision_notes?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          period_end?: string
          period_start?: string
          reference_number?: string | null
          status?: Database["public"]["Enums"]["timesheet_status"]
          submitted_at?: string | null
          submitter_signature_image?: string | null
          submitter_signature_ip?: string | null
          submitter_signature_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tranches: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          created_at: string
          created_by: string | null
          description: string | null
          gate_decision: Database["public"]["Enums"]["gate_decision"] | null
          gate_notes: string | null
          gate_review_date: string | null
          id: string
          name: string
          objectives: string[] | null
          organization_id: string
          owner_id: string | null
          planned_end: string | null
          planned_start: string | null
          programme_id: string
          progress: number | null
          sequence_number: number
          status: string
          updated_at: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          gate_decision?: Database["public"]["Enums"]["gate_decision"] | null
          gate_notes?: string | null
          gate_review_date?: string | null
          id?: string
          name: string
          objectives?: string[] | null
          organization_id: string
          owner_id?: string | null
          planned_end?: string | null
          planned_start?: string | null
          programme_id: string
          progress?: number | null
          sequence_number: number
          status?: string
          updated_at?: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          gate_decision?: Database["public"]["Enums"]["gate_decision"] | null
          gate_notes?: string | null
          gate_review_date?: string | null
          id?: string
          name?: string
          objectives?: string[] | null
          organization_id?: string
          owner_id?: string | null
          planned_end?: string | null
          planned_start?: string | null
          programme_id?: string
          progress?: number | null
          sequence_number?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tranches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tranches_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      update_frequency_settings: {
        Row: {
          created_at: string
          created_by: string | null
          custom_interval_days: number | null
          entity_id: string | null
          entity_type: string
          frequency: string
          id: string
          is_mandatory: boolean
          organization_id: string | null
          reminder_hours_before: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          custom_interval_days?: number | null
          entity_id?: string | null
          entity_type?: string
          frequency?: string
          id?: string
          is_mandatory?: boolean
          organization_id?: string | null
          reminder_hours_before?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          custom_interval_days?: number | null
          entity_id?: string | null
          entity_type?: string
          frequency?: string
          id?: string
          is_mandatory?: boolean
          organization_id?: string | null
          reminder_hours_before?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "update_frequency_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_dashboard_prefs: {
        Row: {
          created_at: string
          default_tab: string
          id: string
          quick_actions: Json
          sidebar_favorites: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_tab?: string
          id?: string
          quick_actions?: Json
          sidebar_favorites?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_tab?: string
          id?: string
          quick_actions?: Json
          sidebar_favorites?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_mfa_factors: {
        Row: {
          created_at: string
          factor_type: string
          friendly_name: string | null
          id: string
          last_used_at: string | null
          secret_encrypted: string
          updated_at: string
          user_id: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          factor_type?: string
          friendly_name?: string | null
          id?: string
          last_used_at?: string | null
          secret_encrypted: string
          updated_at?: string
          user_id: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          factor_type?: string
          friendly_name?: string | null
          id?: string
          last_used_at?: string | null
          secret_encrypted?: string
          updated_at?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      user_mfa_recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_organization_access: {
        Row: {
          access_level: string
          created_at: string
          disabled_at: string | null
          disabled_by: string | null
          disabled_reason: string | null
          id: string
          is_disabled: boolean
          organization_id: string
          user_id: string
        }
        Insert: {
          access_level?: string
          created_at?: string
          disabled_at?: string | null
          disabled_by?: string | null
          disabled_reason?: string | null
          id?: string
          is_disabled?: boolean
          organization_id: string
          user_id: string
        }
        Update: {
          access_level?: string
          created_at?: string
          disabled_at?: string | null
          disabled_by?: string | null
          disabled_reason?: string | null
          id?: string
          is_disabled?: boolean
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_organization_access_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_organization_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_organization_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_pinned_entities: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string
          href: string
          id: string
          label: string
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type: string
          href: string
          id?: string
          label: string
          position?: number
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          href?: string
          id?: string
          label?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      user_product_access: {
        Row: {
          access_level: string
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          access_level?: string
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          access_level?: string
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_product_access_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_programme_access: {
        Row: {
          access_level: string
          created_at: string
          id: string
          programme_id: string
          user_id: string
        }
        Insert: {
          access_level?: string
          created_at?: string
          id?: string
          programme_id: string
          user_id: string
        }
        Update: {
          access_level?: string
          created_at?: string
          id?: string
          programme_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_programme_access_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_project_access: {
        Row: {
          access_level: string
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          access_level?: string
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          access_level?: string
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_project_access_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_recent_entities: {
        Row: {
          entity_id: string | null
          entity_type: string
          href: string
          id: string
          label: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          entity_id?: string | null
          entity_type: string
          href: string
          id?: string
          label: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          entity_id?: string | null
          entity_type?: string
          href?: string
          id?: string
          label?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string
          device_label: string | null
          id: string
          ip_address: string | null
          last_seen_at: string
          organization_id: string | null
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          session_token_hash: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_label?: string | null
          id?: string
          ip_address?: string | null
          last_seen_at?: string
          organization_id?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          session_token_hash: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_label?: string | null
          id?: string
          ip_address?: string | null
          last_seen_at?: string
          organization_id?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          session_token_hash?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vertical_entities: {
        Row: {
          created_at: string
          created_by: string | null
          default_status_options: string[]
          description: string | null
          fields: Json
          icon: string | null
          id: string
          is_active: boolean
          name: string
          name_plural: string
          slug: string
          sort_order: number
          updated_at: string
          vertical_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_status_options?: string[]
          description?: string | null
          fields?: Json
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_plural: string
          slug: string
          sort_order?: number
          updated_at?: string
          vertical_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_status_options?: string[]
          description?: string | null
          fields?: Json
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_plural?: string
          slug?: string
          sort_order?: number
          updated_at?: string
          vertical_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vertical_entities_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "industry_verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      vertical_entity_records: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          data: Json
          due_date: string | null
          entity_id: string
          id: string
          organization_id: string
          priority: string | null
          project_id: string | null
          record_number: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          data?: Json
          due_date?: string | null
          entity_id: string
          id?: string
          organization_id: string
          priority?: string | null
          project_id?: string | null
          record_number?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          data?: Json
          due_date?: string | null
          entity_id?: string
          id?: string
          organization_id?: string
          priority?: string | null
          project_id?: string | null
          record_number?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vertical_entity_records_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "vertical_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vertical_entity_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vertical_entity_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_reports: {
        Row: {
          ai_summary: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          highlights: string[] | null
          id: string
          next_week: string[] | null
          organization_id: string | null
          overall_health: string
          product_id: string | null
          product_summary: string | null
          programme_id: string | null
          programme_summary: string | null
          project_id: string | null
          project_summary: string | null
          report_type: string
          risks_issues: string[] | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          task_summary: string | null
          updated_at: string
          week_ending: string
        }
        Insert: {
          ai_summary?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          highlights?: string[] | null
          id?: string
          next_week?: string[] | null
          organization_id?: string | null
          overall_health?: string
          product_id?: string | null
          product_summary?: string | null
          programme_id?: string | null
          programme_summary?: string | null
          project_id?: string | null
          project_summary?: string | null
          report_type?: string
          risks_issues?: string[] | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          task_summary?: string | null
          updated_at?: string
          week_ending: string
        }
        Update: {
          ai_summary?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          highlights?: string[] | null
          id?: string
          next_week?: string[] | null
          organization_id?: string | null
          overall_health?: string
          product_id?: string | null
          product_summary?: string | null
          programme_id?: string | null
          programme_summary?: string | null
          project_id?: string | null
          project_summary?: string | null
          report_type?: string
          risks_issues?: string[] | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          task_summary?: string | null
          updated_at?: string
          week_ending?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_reports_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_reports_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      work_packages: {
        Row: {
          assigned_to: string | null
          constraints: string | null
          created_at: string
          created_by: string | null
          deliverables: string | null
          description: string | null
          id: string
          name: string
          organization_id: string
          progress: number
          project_id: string | null
          reporting_requirements: string | null
          status: string
          target_end: string | null
          target_start: string | null
          tolerances: string | null
          updated_at: string
          work_description: string | null
        }
        Insert: {
          assigned_to?: string | null
          constraints?: string | null
          created_at?: string
          created_by?: string | null
          deliverables?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id: string
          progress?: number
          project_id?: string | null
          reporting_requirements?: string | null
          status?: string
          target_end?: string | null
          target_start?: string | null
          tolerances?: string | null
          updated_at?: string
          work_description?: string | null
        }
        Update: {
          assigned_to?: string | null
          constraints?: string | null
          created_at?: string
          created_by?: string | null
          deliverables?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          progress?: number
          project_id?: string | null
          reporting_requirements?: string | null
          status?: string
          target_end?: string | null
          target_start?: string | null
          tolerances?: string | null
          updated_at?: string
          work_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_packages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_packages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_approval_comments: {
        Row: {
          approval_id: string
          author_id: string
          comment: string
          created_at: string
          id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          approval_id: string
          author_id: string
          comment: string
          created_at?: string
          id?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          approval_id?: string
          author_id?: string
          comment?: string
          created_at?: string
          id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_approval_comments_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "workflow_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_approval_comments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_approvals: {
        Row: {
          approval_role: string
          comments: string | null
          conditions: string | null
          created_at: string
          created_by: string | null
          decision: string
          entity_id: string
          entity_type: string
          id: string
          is_required: boolean
          organization_id: string
          reviewer_id: string
          reviewer_role: string | null
          signed_at: string | null
          updated_at: string
        }
        Insert: {
          approval_role?: string
          comments?: string | null
          conditions?: string | null
          created_at?: string
          created_by?: string | null
          decision?: string
          entity_id: string
          entity_type: string
          id?: string
          is_required?: boolean
          organization_id: string
          reviewer_id: string
          reviewer_role?: string | null
          signed_at?: string | null
          updated_at?: string
        }
        Update: {
          approval_role?: string
          comments?: string | null
          conditions?: string | null
          created_at?: string
          created_by?: string | null
          decision?: string
          entity_id?: string
          entity_type?: string
          id?: string
          is_required?: boolean
          organization_id?: string
          reviewer_id?: string
          reviewer_role?: string | null
          signed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_evidence: {
        Row: {
          attested_at: string | null
          attested_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          document_id: string | null
          entity_id: string
          entity_type: string
          evidence_label: string
          id: string
          is_required: boolean
          organization_id: string
        }
        Insert: {
          attested_at?: string | null
          attested_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_id?: string | null
          entity_id: string
          entity_type: string
          evidence_label: string
          id?: string
          is_required?: boolean
          organization_id: string
        }
        Update: {
          attested_at?: string | null
          attested_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_id?: string | null
          entity_id?: string
          entity_type?: string
          evidence_label?: string
          id?: string
          is_required?: boolean
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_evidence_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_evidence_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_notifiers: {
        Row: {
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
          notify_role: string | null
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          notify_role?: string | null
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          notify_role?: string | null
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_notifiers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      cmdb_ci_health: {
        Row: {
          critical_ticket_count: number | null
          criticality: string | null
          environment: string | null
          health_state: string | null
          id: string | null
          is_public_facing: boolean | null
          name: string | null
          open_ticket_count: number | null
          organization_id: string | null
          reference_number: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "configuration_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      problem_summary: {
        Row: {
          assignee_id: string | null
          category: string | null
          closed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string | null
          identified_at: string | null
          is_known_error: boolean | null
          linked_incident_count: number | null
          metadata: Json | null
          open_incident_count: number | null
          organization_id: string | null
          priority: string | null
          product_id: string | null
          programme_id: string | null
          project_id: string | null
          reference_number: string | null
          reporter_user_id: string | null
          resolution: string | null
          resolved_at: string | null
          root_cause: string | null
          status: string | null
          tags: string[] | null
          title: string | null
          updated_at: string | null
          workaround: string | null
        }
        Insert: {
          assignee_id?: string | null
          category?: string | null
          closed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string | null
          identified_at?: string | null
          is_known_error?: boolean | null
          linked_incident_count?: never
          metadata?: Json | null
          open_incident_count?: never
          organization_id?: string | null
          priority?: string | null
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          reference_number?: string | null
          reporter_user_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          root_cause?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string | null
          workaround?: string | null
        }
        Update: {
          assignee_id?: string | null
          category?: string | null
          closed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string | null
          identified_at?: string | null
          is_known_error?: boolean | null
          linked_incident_count?: never
          metadata?: Json | null
          open_incident_count?: never
          organization_id?: string | null
          priority?: string | null
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          reference_number?: string | null
          reporter_user_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          root_cause?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string | null
          workaround?: string | null
        }
        Relationships: []
      }
      profiles_directory: {
        Row: {
          archived: boolean | null
          avatar_url: string | null
          created_at: string | null
          default_organization_id: string | null
          department: string | null
          email: string | null
          first_name: string | null
          full_name: string | null
          id: string | null
          last_name: string | null
          preferred_language: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          archived?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          default_organization_id?: string | null
          department?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string | null
          last_name?: string | null
          preferred_language?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          archived?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          default_organization_id?: string | null
          department?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string | null
          last_name?: string | null
          preferred_language?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_organization_id_fkey"
            columns: ["default_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation: { Args: { _token: string }; Returns: Json }
      apply_addon_feature_overrides: {
        Args: { _addon_sub_id: string }
        Returns: undefined
      }
      archive_organization: {
        Args: { _archive?: boolean; _org_id: string }
        Returns: undefined
      }
      can_user_log_time_on_task: {
        Args: { _task_id: string; _user_id: string }
        Returns: boolean
      }
      check_plan_limit: {
        Args: { _org_id: string; _resource_type: string }
        Returns: boolean
      }
      check_residency_policy: {
        Args: { _org_id: string; _processing_region: string }
        Returns: Json
      }
      ci_blast_radius: {
        Args: { _ci_id: string; _max_depth?: number }
        Returns: {
          ci_id: string
          ci_type_id: string
          ci_type_label: string
          criticality: string
          depth: number
          environment: string
          name: string
          open_incident_count: number
          reference_number: string
          shortest_path: string[]
          status: string
        }[]
      }
      compute_compliance_score: {
        Args: { _scope_id: string; _scope_type: string }
        Returns: Json
      }
      consume_ai_credits: {
        Args: {
          _action_type?: string
          _amount?: number
          _metadata?: Json
          _model?: string
          _org_id: string
          _user_id?: string
        }
        Returns: Json
      }
      create_org_for_new_user: { Args: { _org_name: string }; Returns: string }
      cron_flush_siem_exporters: { Args: never; Returns: Json }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_organization_cascade: {
        Args: { _org_id: string }
        Returns: undefined
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      generate_reference_number: {
        Args: { _entity_type: string; _organization_id: string }
        Returns: string
      }
      get_ai_credit_status: { Args: { _org_id: string }; Returns: Json }
      get_csat_by_token: {
        Args: { _token: string }
        Returns: {
          comment: string
          expires_at: string
          follow_up_answer: string
          id: string
          organization_id: string
          rating: number
          responded_at: string
          sent_at: string
          ticket_id: string
        }[]
      }
      get_deployment_mode: { Args: { _org_id: string }; Returns: string }
      get_effective_ai_provider: { Args: { _org_id?: string }; Returns: Json }
      get_effective_retention_days: {
        Args: { _org_id: string }
        Returns: number
      }
      get_invitation_by_token: {
        Args: { _token: string }
        Returns: {
          access_level: string
          email: string
          expires_at: string
          organization_id: string
          organization_name: string
          status: string
        }[]
      }
      get_license_entitlements: { Args: { _org_id: string }; Returns: Json }
      get_org_admin_emails: {
        Args: { _org_id: string }
        Returns: {
          email: string
          full_name: string
          user_id: string
        }[]
      }
      get_org_credit_purchase_history: {
        Args: { _limit?: number; _org_id: string }
        Returns: {
          amount_cents: number
          created_at: string
          credits: number
          currency: string
          environment: string
          id: string
          pack_id: string
          period_start: string
          status: string
        }[]
      }
      get_org_feature_value: {
        Args: { _feature_key: string; _org_id: string }
        Returns: Json
      }
      get_org_limit: {
        Args: { _feature_key: string; _org_id: string }
        Returns: number
      }
      get_org_sso_config_by_domain: {
        Args: { _email: string }
        Returns: {
          default_access_level: string
          oidc_client_id: string
          oidc_issuer_url: string
          organization_id: string
          organization_name: string
          provider_type: string
          saml_provider_id: string
          sso_config_id: string
        }[]
      }
      get_request_approval_state: {
        Args: { _ticket_id: string }
        Returns: string
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      grant_ai_credits: {
        Args: {
          _amount_cents: number
          _credits: number
          _currency: string
          _environment: string
          _metadata?: Json
          _org_id: string
          _pack_id: string
          _stripe_payment_intent: string
          _stripe_session_id: string
          _user_id?: string
        }
        Returns: Json
      }
      has_active_license: { Args: { _org_id: string }; Returns: boolean }
      has_feature: {
        Args: { _feature_key: string; _org_id: string }
        Returns: boolean
      }
      has_module_permission: {
        Args: { _action?: string; _module_key: string; _user_id: string }
        Returns: boolean
      }
      has_org_access: {
        Args: { _min_level?: string; _org_id: string; _user_id: string }
        Returns: boolean
      }
      has_paid_plan: { Args: { _org_id: string }; Returns: boolean }
      has_product_access: {
        Args: { _product_id: string; _user_id: string }
        Returns: boolean
      }
      has_programme_access: {
        Args: { _programme_id: string; _user_id: string }
        Returns: boolean
      }
      has_project_access: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_stakeholder_access: {
        Args: { _scope_id: string; _scope_type: string; _user_id: string }
        Returns: boolean
      }
      helpdesk_evaluate_approvals: {
        Args: { _ticket_id: string }
        Returns: string
      }
      helpdesk_instantiate_approval_chain: {
        Args: { _chain_id: string; _ticket_id: string }
        Returns: number
      }
      helpdesk_report_compute_next_run: {
        Args: { _interval: string }
        Returns: string
      }
      helpdesk_sla_sweep_breaches: { Args: never; Returns: number }
      helpdesk_spawn_next_catalog_task: {
        Args: { _parent_ticket_id: string }
        Returns: string
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_helpdesk_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_admin_of: {
        Args: { _caller: string; _target_user: string }
        Returns: boolean
      }
      is_org_manager_of: {
        Args: { _caller: string; _target_user: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_suspended: { Args: { _org_id: string }; Returns: boolean }
      kb_increment_view: { Args: { p_article_id: string }; Returns: undefined }
      log_audit_event: {
        Args: {
          _event_category?: string
          _event_type: string
          _ip_address?: string
          _metadata?: Json
          _organization_id?: string
          _status?: string
          _target_entity_id?: string
          _target_entity_type?: string
          _target_user_id?: string
          _user_agent?: string
        }
        Returns: string
      }
      mark_summaries_stale_for_scope: {
        Args: { _scope_id: string; _scope_type: string }
        Returns: undefined
      }
      match_kb_chunks: {
        Args: {
          _match_count?: number
          _match_threshold?: number
          _org_id: string
          _query_embedding: string
        }
        Returns: {
          article_id: string
          category: string
          chunk_id: string
          content: string
          similarity: number
          status: string
          summary: string
          title: string
          visibility: string
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      purge_expired_audit_logs: { Args: never; Returns: Json }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      resolve_scim_groups_to_access_level: {
        Args: { _groups: string[]; _org_id: string }
        Returns: string
      }
      set_license_status: {
        Args: { _license_id: string; _reason?: string; _status: string }
        Returns: Json
      }
      set_org_member_disabled: {
        Args: {
          _disable: boolean
          _org_id: string
          _reason?: string
          _user_id: string
        }
        Returns: Json
      }
      set_organization_suspension: {
        Args: {
          _kind?: string
          _org_id: string
          _reason?: string
          _suspend: boolean
        }
        Returns: Json
      }
      submit_csat_response_by_token: {
        Args: {
          _comment?: string
          _follow_up_answer?: string
          _rating: number
          _token: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "programme_owner"
        | "project_manager"
        | "product_manager"
        | "product_team_member"
        | "project_team_member"
        | "org_stakeholder"
        | "programme_stakeholder"
        | "project_stakeholder"
        | "product_stakeholder"
        | "org_admin"
        | "stakeholder"
      change_status:
        | "pending"
        | "under_review"
        | "approved"
        | "rejected"
        | "implemented"
        | "withdrawn"
        | "needs_information"
      cm_approval_decision: "pending" | "approved" | "rejected" | "abstain"
      cm_approval_kind:
        | "technical"
        | "business"
        | "cab"
        | "security"
        | "operational"
      cm_change_type: "standard" | "normal" | "emergency" | "operational"
      cm_impact: "low" | "medium" | "high" | "critical"
      cm_status:
        | "draft"
        | "submitted"
        | "in_review"
        | "cab_review"
        | "needs_information"
        | "approved"
        | "rejected"
        | "scheduled"
        | "in_progress"
        | "implemented"
        | "closed"
        | "cancelled"
        | "failed"
      cm_urgency: "low" | "medium" | "high" | "critical"
      email_transport: "lovable" | "smtp" | "resend"
      exception_status:
        | "raised"
        | "under_review"
        | "escalated"
        | "resolved"
        | "closed"
      gate_decision:
        | "pending"
        | "approved"
        | "conditional"
        | "rejected"
        | "deferred"
      helpdesk_resolution_code:
        | "fixed"
        | "not_fixed"
        | "duplicate"
        | "wont_fix"
        | "cannot_reproduce"
        | "known_error"
        | "workaround_provided"
      helpdesk_ticket_priority: "low" | "medium" | "high" | "urgent"
      helpdesk_ticket_source:
        | "portal"
        | "email"
        | "api"
        | "phone"
        | "chat"
        | "internal"
      helpdesk_ticket_status:
        | "new"
        | "open"
        | "pending"
        | "on_hold"
        | "resolved"
        | "closed"
        | "cancelled"
      helpdesk_ticket_type:
        | "support"
        | "incident"
        | "service_request"
        | "question"
        | "problem"
      milestone_status:
        | "planned"
        | "in_progress"
        | "achieved"
        | "missed"
        | "deferred"
      quality_status:
        | "planned"
        | "in_progress"
        | "passed"
        | "failed"
        | "conditional"
      task_status:
        | "not_started"
        | "in_progress"
        | "on_hold"
        | "completed"
        | "cancelled"
      timesheet_status: "draft" | "submitted" | "approved" | "rejected"
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
      app_role: [
        "admin",
        "programme_owner",
        "project_manager",
        "product_manager",
        "product_team_member",
        "project_team_member",
        "org_stakeholder",
        "programme_stakeholder",
        "project_stakeholder",
        "product_stakeholder",
        "org_admin",
        "stakeholder",
      ],
      change_status: [
        "pending",
        "under_review",
        "approved",
        "rejected",
        "implemented",
        "withdrawn",
        "needs_information",
      ],
      cm_approval_decision: ["pending", "approved", "rejected", "abstain"],
      cm_approval_kind: [
        "technical",
        "business",
        "cab",
        "security",
        "operational",
      ],
      cm_change_type: ["standard", "normal", "emergency", "operational"],
      cm_impact: ["low", "medium", "high", "critical"],
      cm_status: [
        "draft",
        "submitted",
        "in_review",
        "cab_review",
        "needs_information",
        "approved",
        "rejected",
        "scheduled",
        "in_progress",
        "implemented",
        "closed",
        "cancelled",
        "failed",
      ],
      cm_urgency: ["low", "medium", "high", "critical"],
      email_transport: ["lovable", "smtp", "resend"],
      exception_status: [
        "raised",
        "under_review",
        "escalated",
        "resolved",
        "closed",
      ],
      gate_decision: [
        "pending",
        "approved",
        "conditional",
        "rejected",
        "deferred",
      ],
      helpdesk_resolution_code: [
        "fixed",
        "not_fixed",
        "duplicate",
        "wont_fix",
        "cannot_reproduce",
        "known_error",
        "workaround_provided",
      ],
      helpdesk_ticket_priority: ["low", "medium", "high", "urgent"],
      helpdesk_ticket_source: [
        "portal",
        "email",
        "api",
        "phone",
        "chat",
        "internal",
      ],
      helpdesk_ticket_status: [
        "new",
        "open",
        "pending",
        "on_hold",
        "resolved",
        "closed",
        "cancelled",
      ],
      helpdesk_ticket_type: [
        "support",
        "incident",
        "service_request",
        "question",
        "problem",
      ],
      milestone_status: [
        "planned",
        "in_progress",
        "achieved",
        "missed",
        "deferred",
      ],
      quality_status: [
        "planned",
        "in_progress",
        "passed",
        "failed",
        "conditional",
      ],
      task_status: [
        "not_started",
        "in_progress",
        "on_hold",
        "completed",
        "cancelled",
      ],
      timesheet_status: ["draft", "submitted", "approved", "rejected"],
    },
  },
} as const
