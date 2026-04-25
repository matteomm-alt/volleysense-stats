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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          athlete_id: string
          created_at: string
          id: string
          notes: string | null
          recorded_by: string | null
          session_date: string
          status: Database["public"]["Enums"]["attendance_status"]
          team_id: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          session_date: string
          status?: Database["public"]["Enums"]["attendance_status"]
          team_id: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          session_date?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      esercizi_catalogo: {
        Row: {
          category: Database["public"]["Enums"]["exercise_category"]
          created_at: string
          created_by: string | null
          default_unit: string | null
          description: string | null
          id: string
          image_url: string | null
          is_public: boolean
          muscle_group: string | null
          name: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["exercise_category"]
          created_at?: string
          created_by?: string | null
          default_unit?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_public?: boolean
          muscle_group?: string | null
          name: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["exercise_category"]
          created_at?: string
          created_by?: string | null
          default_unit?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_public?: boolean
          muscle_group?: string | null
          name?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      infortuni: {
        Row: {
          actual_return_date: string | null
          athlete_id: string
          body_zone: string
          created_at: string
          created_by: string | null
          description: string | null
          diagnosis: string | null
          expected_return_date: string | null
          id: string
          injury_date: string
          severity: Database["public"]["Enums"]["injury_severity"]
          side: string | null
          status: Database["public"]["Enums"]["injury_status"]
          team_id: string | null
          updated_at: string
        }
        Insert: {
          actual_return_date?: string | null
          athlete_id: string
          body_zone: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          diagnosis?: string | null
          expected_return_date?: string | null
          id?: string
          injury_date?: string
          severity?: Database["public"]["Enums"]["injury_severity"]
          side?: string | null
          status?: Database["public"]["Enums"]["injury_status"]
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          actual_return_date?: string | null
          athlete_id?: string
          body_zone?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          diagnosis?: string | null
          expected_return_date?: string | null
          id?: string
          injury_date?: string
          severity?: Database["public"]["Enums"]["injury_severity"]
          side?: string | null
          status?: Database["public"]["Enums"]["injury_status"]
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "infortuni_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      infortuni_esercizi: {
        Row: {
          created_at: string
          custom_name: string | null
          esercizio_id: string | null
          frequency: string | null
          id: string
          infortunio_id: string
          notes: string | null
          order_index: number
          reps: string | null
          sets: number | null
        }
        Insert: {
          created_at?: string
          custom_name?: string | null
          esercizio_id?: string | null
          frequency?: string | null
          id?: string
          infortunio_id: string
          notes?: string | null
          order_index?: number
          reps?: string | null
          sets?: number | null
        }
        Update: {
          created_at?: string
          custom_name?: string | null
          esercizio_id?: string | null
          frequency?: string | null
          id?: string
          infortunio_id?: string
          notes?: string | null
          order_index?: number
          reps?: string | null
          sets?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "infortuni_esercizi_esercizio_id_fkey"
            columns: ["esercizio_id"]
            isOneToOne: false
            referencedRelation: "esercizi_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "infortuni_esercizi_infortunio_id_fkey"
            columns: ["infortunio_id"]
            isOneToOne: false
            referencedRelation: "infortuni"
            referencedColumns: ["id"]
          },
        ]
      }
      infortuni_log: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          infortunio_id: string
          log_date: string
          mobility_level: number | null
          notes: string | null
          pain_level: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          infortunio_id: string
          log_date?: string
          mobility_level?: number | null
          notes?: string | null
          pain_level?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          infortunio_id?: string
          log_date?: string
          mobility_level?: number | null
          notes?: string | null
          pain_level?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "infortuni_log_infortunio_id_fkey"
            columns: ["infortunio_id"]
            isOneToOne: false
            referencedRelation: "infortuni"
            referencedColumns: ["id"]
          },
        ]
      }
      periodi: {
        Row: {
          created_at: string
          description: string | null
          end_date: string
          id: string
          name: string
          order_index: number
          start_date: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date: string
          id?: string
          name: string
          order_index?: number
          start_date: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string
          id?: string
          name?: string
          order_index?: number
          start_date?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "periodi_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          birth_date: string | null
          created_at: string
          full_name: string | null
          id: string
          onboarded: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          onboarded?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          onboarded?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scheda_esercizi: {
        Row: {
          created_at: string
          esercizio_id: string
          id: string
          load_unit: string | null
          load_value: number | null
          notes: string | null
          order_index: number
          reps: string | null
          rest_seconds: number | null
          rpe_target: number | null
          scheda_id: string
          sets: number | null
          tempo: string | null
        }
        Insert: {
          created_at?: string
          esercizio_id: string
          id?: string
          load_unit?: string | null
          load_value?: number | null
          notes?: string | null
          order_index?: number
          reps?: string | null
          rest_seconds?: number | null
          rpe_target?: number | null
          scheda_id: string
          sets?: number | null
          tempo?: string | null
        }
        Update: {
          created_at?: string
          esercizio_id?: string
          id?: string
          load_unit?: string | null
          load_value?: number | null
          notes?: string | null
          order_index?: number
          reps?: string | null
          rest_seconds?: number | null
          rpe_target?: number | null
          scheda_id?: string
          sets?: number | null
          tempo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheda_esercizi_esercizio_id_fkey"
            columns: ["esercizio_id"]
            isOneToOne: false
            referencedRelation: "esercizi_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheda_esercizi_scheda_id_fkey"
            columns: ["scheda_id"]
            isOneToOne: false
            referencedRelation: "schede"
            referencedColumns: ["id"]
          },
        ]
      }
      schede: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_template: boolean
          order_index: number
          periodo_id: string | null
          team_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_template?: boolean
          order_index?: number
          periodo_id?: string | null
          team_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_template?: boolean
          order_index?: number
          periodo_id?: string | null
          team_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schede_periodo_id_fkey"
            columns: ["periodo_id"]
            isOneToOne: false
            referencedRelation: "periodi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schede_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          athlete_id: string
          completed: boolean
          created_at: string
          duration_minutes: number | null
          id: string
          notes: string | null
          rpe: number | null
          scheda_id: string | null
          session_date: string
          team_id: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          completed?: boolean
          created_at?: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          rpe?: number | null
          scheda_id?: string | null
          session_date?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          completed?: boolean
          created_at?: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          rpe?: number | null
          scheda_id?: string | null
          session_date?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_scheda_id_fkey"
            columns: ["scheda_id"]
            isOneToOne: false
            referencedRelation: "schede"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      set_logs: {
        Row: {
          completed: boolean
          created_at: string
          esercizio_id: string
          id: string
          load_unit: string | null
          load_value: number | null
          notes: string | null
          reps: number | null
          rpe: number | null
          scheda_esercizio_id: string | null
          session_id: string
          set_number: number
        }
        Insert: {
          completed?: boolean
          created_at?: string
          esercizio_id: string
          id?: string
          load_unit?: string | null
          load_value?: number | null
          notes?: string | null
          reps?: number | null
          rpe?: number | null
          scheda_esercizio_id?: string | null
          session_id: string
          set_number: number
        }
        Update: {
          completed?: boolean
          created_at?: string
          esercizio_id?: string
          id?: string
          load_unit?: string | null
          load_value?: number | null
          notes?: string | null
          reps?: number | null
          rpe?: number | null
          scheda_esercizio_id?: string | null
          session_id?: string
          set_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "set_logs_esercizio_id_fkey"
            columns: ["esercizio_id"]
            isOneToOne: false
            referencedRelation: "esercizi_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_logs_scheda_esercizio_id_fkey"
            columns: ["scheda_esercizio_id"]
            isOneToOne: false
            referencedRelation: "scheda_esercizi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      team_coaches: {
        Row: {
          added_at: string
          coach_id: string
          id: string
          team_id: string
        }
        Insert: {
          added_at?: string
          coach_id: string
          id?: string
          team_id: string
        }
        Update: {
          added_at?: string
          coach_id?: string
          id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_coaches_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          athlete_id: string
          id: string
          jersey_number: number | null
          joined_at: string
          position: string | null
          team_id: string
        }
        Insert: {
          athlete_id: string
          id?: string
          jersey_number?: number | null
          joined_at?: string
          position?: string | null
          team_id: string
        }
        Update: {
          athlete_id?: string
          id?: string
          jersey_number?: number | null
          joined_at?: string
          position?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          invite_code: string
          name: string
          owner_coach_id: string
          season: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          invite_code?: string
          name: string
          owner_coach_id: string
          season?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          invite_code?: string
          name?: string
          owner_coach_id?: string
          season?: string | null
          updated_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      coach_owns_athlete: {
        Args: { _athlete_id: string; _coach_id: string }
        Returns: boolean
      }
      generate_invite_code: { Args: never; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      infortunio_athlete_id: {
        Args: { _infortunio_id: string }
        Returns: string
      }
      is_team_coach: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      join_team_with_code: { Args: { _code: string }; Returns: string }
      scheda_team_id: { Args: { _scheda_id: string }; Returns: string }
      session_athlete_id: { Args: { _session_id: string }; Returns: string }
      session_team_id: { Args: { _session_id: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "coach" | "atleta"
      attendance_status: "presente" | "assente" | "giustificato" | "infortunato"
      exercise_category:
        | "forza"
        | "potenza"
        | "resistenza"
        | "mobilita"
        | "pliometria"
        | "tecnica"
        | "riscaldamento"
        | "recupero"
        | "core"
        | "altro"
      injury_severity: "lieve" | "moderato" | "grave"
      injury_status: "attivo" | "in_recupero" | "risolto"
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
      app_role: ["admin", "coach", "atleta"],
      attendance_status: ["presente", "assente", "giustificato", "infortunato"],
      exercise_category: [
        "forza",
        "potenza",
        "resistenza",
        "mobilita",
        "pliometria",
        "tecnica",
        "riscaldamento",
        "recupero",
        "core",
        "altro",
      ],
      injury_severity: ["lieve", "moderato", "grave"],
      injury_status: ["attivo", "in_recupero", "risolto"],
    },
  },
} as const
