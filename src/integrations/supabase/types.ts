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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
      benefit_measurements: {
        Row: {
          actual_value: number | null
          benefit_id: string
          created_at: string
          evidence_document_id: string | null
          id: string
          measurement_date: string
          notes: string | null
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
      custom_roles: {
        Row: {
          can_manage_benefits: boolean | null
          can_manage_change_requests: boolean | null
          can_manage_exceptions: boolean | null
          can_manage_issues: boolean | null
          can_manage_lessons: boolean | null
          can_manage_milestones: boolean | null
          can_manage_products: boolean | null
          can_manage_programmes: boolean | null
          can_manage_projects: boolean | null
          can_manage_quality: boolean | null
          can_manage_requirements: boolean | null
          can_manage_risks: boolean | null
          can_manage_stage_gates: boolean | null
          can_manage_stakeholders: boolean | null
          can_manage_tranches: boolean | null
          can_manage_users: boolean | null
          can_manage_work_packages: boolean | null
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
          can_manage_benefits?: boolean | null
          can_manage_change_requests?: boolean | null
          can_manage_exceptions?: boolean | null
          can_manage_issues?: boolean | null
          can_manage_lessons?: boolean | null
          can_manage_milestones?: boolean | null
          can_manage_products?: boolean | null
          can_manage_programmes?: boolean | null
          can_manage_projects?: boolean | null
          can_manage_quality?: boolean | null
          can_manage_requirements?: boolean | null
          can_manage_risks?: boolean | null
          can_manage_stage_gates?: boolean | null
          can_manage_stakeholders?: boolean | null
          can_manage_tranches?: boolean | null
          can_manage_users?: boolean | null
          can_manage_work_packages?: boolean | null
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
          can_manage_benefits?: boolean | null
          can_manage_change_requests?: boolean | null
          can_manage_exceptions?: boolean | null
          can_manage_issues?: boolean | null
          can_manage_lessons?: boolean | null
          can_manage_milestones?: boolean | null
          can_manage_products?: boolean | null
          can_manage_programmes?: boolean | null
          can_manage_projects?: boolean | null
          can_manage_quality?: boolean | null
          can_manage_requirements?: boolean | null
          can_manage_risks?: boolean | null
          can_manage_stage_gates?: boolean | null
          can_manage_stakeholders?: boolean | null
          can_manage_tranches?: boolean | null
          can_manage_users?: boolean | null
          can_manage_work_packages?: boolean | null
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
      entity_updates: {
        Row: {
          created_at: string
          created_by: string
          entity_id: string
          entity_type: string
          id: string
          is_risk_flagged: boolean
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          organization_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          exception_id: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          organization_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          exception_id?: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          organization_id?: string | null
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
      issues: {
        Row: {
          created_at: string
          created_by: string | null
          date_raised: string | null
          description: string | null
          id: string
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
      lesson_applications: {
        Row: {
          application_notes: string | null
          applied_by: string | null
          applied_to_id: string
          applied_to_type: string
          created_at: string
          id: string
          lesson_id: string
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          organization_id: string | null
          tag_name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          organization_id?: string | null
          tag_name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          organization_id?: string | null
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          organization_id: string | null
          owner_id: string | null
          product_id: string | null
          programme_id: string | null
          project_id: string | null
          reference_number: string | null
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
          organization_id?: string | null
          owner_id?: string | null
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          reference_number?: string | null
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
          organization_id?: string | null
          owner_id?: string | null
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          reference_number?: string | null
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
      organization_plan_overrides: {
        Row: {
          created_at: string
          created_by: string | null
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
          created_at: string
          created_by: string | null
          id: string
          logo_url: string | null
          name: string
          primary_color: string | null
          secondary_color: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string | null
          secondary_color?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          secondary_color?: string | null
          slug?: string
          updated_at?: string
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
          priority: string
          product_id: string
          reach_score: number | null
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
          priority?: string
          product_id: string
          reach_score?: number | null
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
          priority?: string
          product_id?: string
          reach_score?: number | null
          sprint_id?: string | null
          status?: string
          story_points?: number | null
          target_release?: string | null
          updated_at?: string
        }
        Relationships: [
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
      projects: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          health: string
          id: string
          manager_id: string | null
          methodology: string
          name: string
          organization_id: string | null
          priority: string
          programme_id: string | null
          reference_number: string | null
          stage: string
          start_date: string | null
          timesheets_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          health?: string
          id?: string
          manager_id?: string | null
          methodology?: string
          name: string
          organization_id?: string | null
          priority?: string
          programme_id?: string | null
          reference_number?: string | null
          stage?: string
          start_date?: string | null
          timesheets_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          health?: string
          id?: string
          manager_id?: string | null
          methodology?: string
          name?: string
          organization_id?: string | null
          priority?: string
          programme_id?: string | null
          reference_number?: string | null
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
      risks: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          date_identified: string | null
          description: string | null
          id: string
          impact: string
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
      sprints: {
        Row: {
          capacity_points: number | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          created_at: string
          default_access_level: string
          entity_id: string | null
          id: string
          metadata_url: string | null
          notes: string | null
          organization_id: string
          provisioning_notes: string | null
          requested_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          acs_url?: string | null
          activated_at?: string | null
          allowed_domains?: string[]
          created_at?: string
          default_access_level?: string
          entity_id?: string | null
          id?: string
          metadata_url?: string | null
          notes?: string | null
          organization_id: string
          provisioning_notes?: string | null
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          acs_url?: string | null
          activated_at?: string | null
          allowed_domains?: string[]
          created_at?: string
          default_access_level?: string
          entity_id?: string | null
          id?: string
          metadata_url?: string | null
          notes?: string | null
          organization_id?: string
          provisioning_notes?: string | null
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
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
      stage_gate_approvals: {
        Row: {
          comments: string | null
          conditions: string | null
          created_at: string
          decision: string
          id: string
          is_required: boolean
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
      subscription_plans: {
        Row: {
          billing_interval: string
          created_at: string
          cta_label: string | null
          currency: string
          description: string | null
          features: Json | null
          highlight: boolean
          id: string
          is_active: boolean | null
          is_archived: boolean
          is_public: boolean
          last_synced_at: string | null
          max_products: number | null
          max_programmes: number | null
          max_projects: number | null
          max_storage_mb: number | null
          max_users: number | null
          name: string
          price_monthly: number | null
          price_yearly: number | null
          sort_order: number | null
          stripe_lookup_key_monthly: string | null
          stripe_lookup_key_yearly: string | null
          stripe_price_id_monthly: string | null
          stripe_price_id_yearly: string | null
          stripe_product_id: string | null
          sync_status: string | null
          trial_days: number
          updated_at: string
        }
        Insert: {
          billing_interval?: string
          created_at?: string
          cta_label?: string | null
          currency?: string
          description?: string | null
          features?: Json | null
          highlight?: boolean
          id?: string
          is_active?: boolean | null
          is_archived?: boolean
          is_public?: boolean
          last_synced_at?: string | null
          max_products?: number | null
          max_programmes?: number | null
          max_projects?: number | null
          max_storage_mb?: number | null
          max_users?: number | null
          name: string
          price_monthly?: number | null
          price_yearly?: number | null
          sort_order?: number | null
          stripe_lookup_key_monthly?: string | null
          stripe_lookup_key_yearly?: string | null
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          stripe_product_id?: string | null
          sync_status?: string | null
          trial_days?: number
          updated_at?: string
        }
        Update: {
          billing_interval?: string
          created_at?: string
          cta_label?: string | null
          currency?: string
          description?: string | null
          features?: Json | null
          highlight?: boolean
          id?: string
          is_active?: boolean | null
          is_archived?: boolean
          is_public?: boolean
          last_synced_at?: string | null
          max_products?: number | null
          max_programmes?: number | null
          max_projects?: number | null
          max_storage_mb?: number | null
          max_users?: number | null
          name?: string
          price_monthly?: number | null
          price_yearly?: number | null
          sort_order?: number | null
          stripe_lookup_key_monthly?: string | null
          stripe_lookup_key_yearly?: string | null
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          stripe_product_id?: string | null
          sync_status?: string | null
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          id: string
          milestone_id: string | null
          name: string
          organization_id: string | null
          parent_task_id: string | null
          planned_end: string | null
          planned_start: string | null
          priority: string
          product_id: string | null
          programme_id: string | null
          project_id: string | null
          reference_number: string | null
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
          id?: string
          milestone_id?: string | null
          name: string
          organization_id?: string | null
          parent_task_id?: string | null
          planned_end?: string | null
          planned_start?: string | null
          priority?: string
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          reference_number?: string | null
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
          id?: string
          milestone_id?: string | null
          name?: string
          organization_id?: string | null
          parent_task_id?: string | null
          planned_end?: string | null
          planned_start?: string | null
          priority?: string
          product_id?: string | null
          programme_id?: string | null
          project_id?: string | null
          reference_number?: string | null
          sprint_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          story_points?: number | null
          updated_at?: string
          work_package_id?: string | null
        }
        Relationships: [
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
      user_organization_access: {
        Row: {
          access_level: string
          created_at: string
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          access_level?: string
          created_at?: string
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          access_level?: string
          created_at?: string
          id?: string
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          approval_id: string
          author_id: string
          comment: string
          created_at?: string
          id?: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          approval_id?: string
          author_id?: string
          comment?: string
          created_at?: string
          id?: string
          organization_id?: string | null
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          organization_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          notify_role?: string | null
          organization_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          notify_role?: string | null
          organization_id?: string | null
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
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { _token: string }; Returns: Json }
      check_plan_limit: {
        Args: { _org_id: string; _resource_type: string }
        Returns: boolean
      }
      compute_compliance_score: {
        Args: { _scope_id: string; _scope_type: string }
        Returns: Json
      }
      create_org_for_new_user: { Args: { _org_name: string }; Returns: string }
      generate_reference_number: {
        Args: { _entity_type: string; _organization_id: string }
        Returns: string
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
          organization_id: string
          organization_name: string
          sso_config_id: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_feature: {
        Args: { _feature_key: string; _org_id: string }
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
      is_admin: { Args: { _user_id: string }; Returns: boolean }
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
      change_status:
        | "pending"
        | "under_review"
        | "approved"
        | "rejected"
        | "implemented"
        | "withdrawn"
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
      ],
      change_status: [
        "pending",
        "under_review",
        "approved",
        "rejected",
        "implemented",
        "withdrawn",
      ],
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
