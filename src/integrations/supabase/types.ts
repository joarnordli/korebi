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
      broadcast_log: {
        Row: {
          audience: string
          body: string
          created_at: string
          expired_cleaned: number
          failed_count: number
          id: string
          recipients_count: number
          sent_by: string
          sent_count: number
          title: string
          url: string | null
        }
        Insert: {
          audience: string
          body: string
          created_at?: string
          expired_cleaned?: number
          failed_count?: number
          id?: string
          recipients_count?: number
          sent_by: string
          sent_count?: number
          title: string
          url?: string | null
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          expired_cleaned?: number
          failed_count?: number
          id?: string
          recipients_count?: number
          sent_by?: string
          sent_count?: number
          title?: string
          url?: string | null
        }
        Relationships: []
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
      engagement_run_log: {
        Row: {
          comeback_sent: number
          duration_ms: number
          expired_cleaned: number
          failed: number
          id: string
          recap_sent: number
          run_at: string
          streak_sent: number
          total_users: number
        }
        Insert: {
          comeback_sent?: number
          duration_ms?: number
          expired_cleaned?: number
          failed?: number
          id?: string
          recap_sent?: number
          run_at?: string
          streak_sent?: number
          total_users?: number
        }
        Update: {
          comeback_sent?: number
          duration_ms?: number
          expired_cleaned?: number
          failed?: number
          id?: string
          recap_sent?: number
          run_at?: string
          streak_sent?: number
          total_users?: number
        }
        Relationships: []
      }
      engagement_sends: {
        Row: {
          id: string
          metadata: Json | null
          sent_at: string
          trigger: string
          user_id: string
        }
        Insert: {
          id?: string
          metadata?: Json | null
          sent_at?: string
          trigger: string
          user_id: string
        }
        Update: {
          id?: string
          metadata?: Json | null
          sent_at?: string
          trigger?: string
          user_id?: string
        }
        Relationships: []
      }
      memories: {
        Row: {
          created_at: string
          date: string
          encryption_iv: string | null
          id: string
          image_url: string
          latitude: number | null
          longitude: number | null
          note: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          encryption_iv?: string | null
          id?: string
          image_url: string
          latitude?: number | null
          longitude?: number | null
          note?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          encryption_iv?: string | null
          id?: string
          image_url?: string
          latitude?: number | null
          longitude?: number | null
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_send_events: {
        Row: {
          body: string | null
          id: string
          metadata: Json | null
          open_count: number
          opened_at: string | null
          sent_at: string
          source: string
          title: string | null
          user_id: string | null
        }
        Insert: {
          body?: string | null
          id?: string
          metadata?: Json | null
          open_count?: number
          opened_at?: string | null
          sent_at?: string
          source: string
          title?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string | null
          id?: string
          metadata?: Json | null
          open_count?: number
          opened_at?: string | null
          sent_at?: string
          source?: string
          title?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_sent_date: string | null
          p256dh: string
          reminder_enabled: boolean
          reminder_window_end: number
          reminder_window_start: number
          timezone: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_sent_date?: string | null
          p256dh: string
          reminder_enabled?: boolean
          reminder_window_end?: number
          reminder_window_start?: number
          timezone?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_sent_date?: string | null
          p256dh?: string
          reminder_enabled?: boolean
          reminder_window_end?: number
          reminder_window_start?: number
          timezone?: string
          user_id?: string
        }
        Relationships: []
      }
      reminder_run_log: {
        Row: {
          duration_ms: number
          eligible: number
          expired_cleaned: number
          failed: number
          id: string
          run_at: string
          sent: number
          skipped_already_captured: number
          total_subscriptions: number
        }
        Insert: {
          duration_ms?: number
          eligible?: number
          expired_cleaned?: number
          failed?: number
          id?: string
          run_at?: string
          sent?: number
          skipped_already_captured?: number
          total_subscriptions?: number
        }
        Update: {
          duration_ms?: number
          eligible?: number
          expired_cleaned?: number
          failed?: number
          id?: string
          run_at?: string
          sent?: number
          skipped_already_captured?: number
          total_subscriptions?: number
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          active: boolean
          is_trialing: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          is_trialing?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          is_trialing?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      trial_usage: {
        Row: {
          email: string
          first_signup_at: string
        }
        Insert: {
          email: string
          first_signup_at?: string
        }
        Update: {
          email?: string
          first_signup_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_active_subscription: { Args: { _user_id: string }; Returns: boolean }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_push_open: { Args: { _event_id: string }; Returns: undefined }
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
