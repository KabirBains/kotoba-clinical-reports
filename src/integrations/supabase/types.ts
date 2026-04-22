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
      clients: {
        Row: {
          client_name: string
          created_at: string
          id: string
          ndis_number: string | null
          primary_diagnosis: string | null
          referral_reason: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_name: string
          created_at?: string
          id?: string
          ndis_number?: string | null
          primary_diagnosis?: string | null
          referral_reason?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_name?: string
          created_at?: string
          id?: string
          ndis_number?: string | null
          primary_diagnosis?: string | null
          referral_reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      collateral_interviews: {
        Row: {
          created_at: string | null
          custom_questions: Json | null
          general_notes: string | null
          id: string
          interview_date: string | null
          interview_method: string | null
          interviewee_name: string | null
          interviewee_role: string | null
          report_id: string
          responses: Json | null
          template_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          custom_questions?: Json | null
          general_notes?: string | null
          id?: string
          interview_date?: string | null
          interview_method?: string | null
          interviewee_name?: string | null
          interviewee_role?: string | null
          report_id: string
          responses?: Json | null
          template_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          custom_questions?: Json | null
          general_notes?: string | null
          id?: string
          interview_date?: string | null
          interview_method?: string | null
          interviewee_name?: string | null
          interviewee_role?: string | null
          report_id?: string
          responses?: Json | null
          template_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collateral_interviews_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ahpra_number: string | null
          clinician_name: string | null
          created_at: string
          id: string
          practice_name: string | null
          qualifications: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ahpra_number?: string | null
          clinician_name?: string | null
          created_at?: string
          id?: string
          practice_name?: string | null
          qualifications?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ahpra_number?: string | null
          clinician_name?: string | null
          created_at?: string
          id?: string
          practice_name?: string | null
          qualifications?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      report_activity: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json
          report_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json
          report_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json
          report_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_activity_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_collaborators: {
        Row: {
          added_at: string
          added_by: string
          id: string
          report_id: string
          role: Database["public"]["Enums"]["app_collab_role"]
          user_id: string
        }
        Insert: {
          added_at?: string
          added_by: string
          id?: string
          report_id: string
          role: Database["public"]["Enums"]["app_collab_role"]
          user_id: string
        }
        Update: {
          added_at?: string
          added_by?: string
          id?: string
          report_id?: string
          role?: Database["public"]["Enums"]["app_collab_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_collaborators_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          client_id: string
          created_at: string
          dismissed_issue_keys: Json | null
          id: string
          is_current: boolean
          issue_statuses: Json | null
          notes: Json
          quality_scorecard: Json | null
          report_content: Json | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          client_id: string
          created_at?: string
          dismissed_issue_keys?: Json | null
          id?: string
          is_current?: boolean
          issue_statuses?: Json | null
          notes?: Json
          quality_scorecard?: Json | null
          report_content?: Json | null
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          dismissed_issue_keys?: Json | null
          id?: string
          is_current?: boolean
          issue_statuses?: Json | null
          notes?: Json
          quality_scorecard?: Json | null
          report_content?: Json | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      whitelisted_emails: {
        Row: {
          added_at: string
          email: string
          note: string | null
        }
        Insert: {
          added_at?: string
          email: string
          note?: string | null
        }
        Update: {
          added_at?: string
          email?: string
          note?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      find_user_id_by_email: { Args: { _email: string }; Returns: string }
      get_accessible_clients: {
        Args: never
        Returns: {
          client_name: string
          id: string
          is_shared: boolean
          ndis_number: string
          owner_user_id: string
          status: string
          updated_at: string
        }[]
      }
      get_collaborator_emails: {
        Args: { _report: string }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      is_email_whitelisted: { Args: { _email: string }; Returns: boolean }
      is_report_collaborator: {
        Args: { _report: string; _user: string }
        Returns: boolean
      }
      last_editor_for_report: {
        Args: { _report: string }
        Returns: {
          clinician_name: string
          edited_at: string
          email: string
          user_id: string
        }[]
      }
      report_role: {
        Args: { _report: string; _user: string }
        Returns: Database["public"]["Enums"]["app_collab_role"]
      }
    }
    Enums: {
      app_collab_role: "owner" | "editor" | "viewer"
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
      app_collab_role: ["owner", "editor", "viewer"],
    },
  },
} as const
