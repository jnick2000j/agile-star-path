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
          programme_id: string | null
          realization: number
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
          programme_id?: string | null
          realization?: number
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
          programme_id?: string | null
          realization?: number
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
            foreignKeyName: "benefits_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      branding_settings: {
        Row: {
          accent_color: string | null
          created_at: string
          font_family: string | null
          id: string
          logo_url: string | null
          organization_id: string | null
          primary_color: string | null
          secondary_color: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          font_family?: string | null
          id?: string
          logo_url?: string | null
          organization_id?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          font_family?: string | null
          id?: string
          logo_url?: string | null
          organization_id?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
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
          programme_id: string | null
          project_id: string | null
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
          programme_id?: string | null
          project_id?: string | null
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
          programme_id?: string | null
          project_id?: string | null
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
          programme_id: string | null
          project_id: string | null
          project_stage: string | null
          recommendation: string | null
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
          programme_id?: string | null
          project_id?: string | null
          project_stage?: string | null
          recommendation?: string | null
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
          programme_id?: string | null
          project_id?: string | null
          project_stage?: string | null
          recommendation?: string | null
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
          reach_score: number | null
          revenue_target: string | null
          secondary_metrics: string[] | null
          stage: string
          status: string
          target_market: string | null
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
          reach_score?: number | null
          revenue_target?: string | null
          secondary_metrics?: string[] | null
          stage?: string
          status?: string
          target_market?: string | null
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
          reach_score?: number | null
          revenue_target?: string | null
          secondary_metrics?: string[] | null
          stage?: string
          status?: string
          target_market?: string | null
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
          full_name: string | null
          id: string
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
          full_name?: string | null
          id?: string
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
          full_name?: string | null
          id?: string
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
          sponsor: string | null
          start_date: string | null
          status: string
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
          sponsor?: string | null
          start_date?: string | null
          status?: string
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
          sponsor?: string | null
          start_date?: string | null
          status?: string
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
          stage: string
          start_date: string | null
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
          stage?: string
          start_date?: string | null
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
          stage?: string
          start_date?: string | null
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
          programme_id: string | null
          project_id: string | null
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
          programme_id?: string | null
          project_id?: string | null
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
          programme_id?: string | null
          project_id?: string | null
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
          approved_at: string | null
          approved_by: string | null
          created_at: string
          highlights: string[] | null
          id: string
          next_week: string[] | null
          overall_health: string
          programme_id: string
          risks_issues: string[] | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
          week_ending: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          highlights?: string[] | null
          id?: string
          next_week?: string[] | null
          overall_health?: string
          programme_id: string
          risks_issues?: string[] | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          week_ending: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          highlights?: string[] | null
          id?: string
          next_week?: string[] | null
          overall_health?: string
          programme_id?: string
          risks_issues?: string[] | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          week_ending?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_reports_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_org_access: {
        Args: { _min_level?: string; _org_id: string; _user_id: string }
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
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "programme_owner" | "project_manager" | "stakeholder"
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
      app_role: ["admin", "programme_owner", "project_manager", "stakeholder"],
    },
  },
} as const
