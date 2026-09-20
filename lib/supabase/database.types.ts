// Généré par `npm run db:types:local` à partir de supabase/migrations — ne pas modifier à la main.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_type: Database["public"]["Enums"]["actor_type"];
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: number;
          organization_id: string;
          payload: Json;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_type: Database["public"]["Enums"]["actor_type"];
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: never;
          organization_id: string;
          payload?: Json;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_type?: Database["public"]["Enums"]["actor_type"];
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: never;
          organization_id?: string;
          payload?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      debtors: {
        Row: {
          address: string | null;
          client_type: Database["public"]["Enums"]["client_type"];
          contact_email: string | null;
          contact_name: string | null;
          created_at: string;
          id: string;
          is_legal_entity: boolean;
          name: string;
          notes: string | null;
          organization_id: string;
          payment_behavior_days: number | null;
          phone: string | null;
          risk_score: number | null;
          siren: string | null;
        };
        Insert: {
          address?: string | null;
          client_type: Database["public"]["Enums"]["client_type"];
          contact_email?: string | null;
          contact_name?: string | null;
          created_at?: string;
          id?: string;
          is_legal_entity?: boolean;
          name: string;
          notes?: string | null;
          organization_id: string;
          payment_behavior_days?: number | null;
          phone?: string | null;
          risk_score?: number | null;
          siren?: string | null;
        };
        Update: {
          address?: string | null;
          client_type?: Database["public"]["Enums"]["client_type"];
          contact_email?: string | null;
          contact_name?: string | null;
          created_at?: string;
          id?: string;
          is_legal_entity?: boolean;
          name?: string;
          notes?: string | null;
          organization_id?: string;
          payment_behavior_days?: number | null;
          phone?: string | null;
          risk_score?: number | null;
          siren?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "debtors_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      email_accounts: {
        Row: {
          created_at: string;
          display_name: string | null;
          email_address: string;
          id: string;
          imap_host: string | null;
          imap_port: number | null;
          last_verified_at: string | null;
          oauth_access_token_secret_id: string | null;
          oauth_expires_at: string | null;
          oauth_refresh_token_secret_id: string | null;
          organization_id: string;
          provider: Database["public"]["Enums"]["email_provider"];
          replies_checked_at: string | null;
          replies_error: string | null;
          smtp_host: string | null;
          smtp_password_secret_id: string | null;
          smtp_port: number | null;
          smtp_user: string | null;
          status: Database["public"]["Enums"]["connection_status"];
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          email_address: string;
          id?: string;
          imap_host?: string | null;
          imap_port?: number | null;
          last_verified_at?: string | null;
          oauth_access_token_secret_id?: string | null;
          oauth_expires_at?: string | null;
          oauth_refresh_token_secret_id?: string | null;
          organization_id: string;
          provider: Database["public"]["Enums"]["email_provider"];
          replies_checked_at?: string | null;
          replies_error?: string | null;
          smtp_host?: string | null;
          smtp_password_secret_id?: string | null;
          smtp_port?: number | null;
          smtp_user?: string | null;
          status?: Database["public"]["Enums"]["connection_status"];
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          email_address?: string;
          id?: string;
          imap_host?: string | null;
          imap_port?: number | null;
          last_verified_at?: string | null;
          oauth_access_token_secret_id?: string | null;
          oauth_expires_at?: string | null;
          oauth_refresh_token_secret_id?: string | null;
          organization_id?: string;
          provider?: Database["public"]["Enums"]["email_provider"];
          replies_checked_at?: string | null;
          replies_error?: string | null;
          smtp_host?: string | null;
          smtp_password_secret_id?: string | null;
          smtp_port?: number | null;
          smtp_user?: string | null;
          status?: Database["public"]["Enums"]["connection_status"];
        };
        Relationships: [
          {
            foreignKeyName: "email_accounts_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      integrations: {
        Row: {
          created_at: string;
          credentials_secret_id: string | null;
          id: string;
          last_sync_at: string | null;
          organization_id: string;
          provider: Database["public"]["Enums"]["integration_provider"];
          status: Database["public"]["Enums"]["connection_status"];
        };
        Insert: {
          created_at?: string;
          credentials_secret_id?: string | null;
          id?: string;
          last_sync_at?: string | null;
          organization_id: string;
          provider: Database["public"]["Enums"]["integration_provider"];
          status?: Database["public"]["Enums"]["connection_status"];
        };
        Update: {
          created_at?: string;
          credentials_secret_id?: string | null;
          id?: string;
          last_sync_at?: string | null;
          organization_id?: string;
          provider?: Database["public"]["Enums"]["integration_provider"];
          status?: Database["public"]["Enums"]["connection_status"];
        };
        Relationships: [
          {
            foreignKeyName: "integrations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      invitations: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          organization_id: string;
          role: Database["public"]["Enums"]["member_role"];
          token_hash: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email: string;
          expires_at: string;
          id?: string;
          invited_by: string;
          organization_id: string;
          role?: Database["public"]["Enums"]["member_role"];
          token_hash: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          organization_id?: string;
          role?: Database["public"]["Enums"]["member_role"];
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_fkey";
            columns: ["invited_by", "organization_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "invitations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: {
          amount_ht: number;
          amount_ttc: number;
          closed_at: string | null;
          created_at: string;
          currency: string;
          debtor_id: string;
          due_at: string;
          external_id: string | null;
          factur_x_raw: Json | null;
          id: string;
          issued_at: string;
          number: string;
          organization_id: string;
          paid_at: string | null;
          reminders_paused_at: string | null;
          source: Database["public"]["Enums"]["invoice_source"];
          status: Database["public"]["Enums"]["invoice_status"];
        };
        Insert: {
          amount_ht: number;
          amount_ttc: number;
          closed_at?: string | null;
          created_at?: string;
          currency?: string;
          debtor_id: string;
          due_at: string;
          external_id?: string | null;
          factur_x_raw?: Json | null;
          id?: string;
          issued_at: string;
          number: string;
          organization_id: string;
          paid_at?: string | null;
          reminders_paused_at?: string | null;
          source?: Database["public"]["Enums"]["invoice_source"];
          status?: Database["public"]["Enums"]["invoice_status"];
        };
        Update: {
          amount_ht?: number;
          amount_ttc?: number;
          closed_at?: string | null;
          created_at?: string;
          currency?: string;
          debtor_id?: string;
          due_at?: string;
          external_id?: string | null;
          factur_x_raw?: Json | null;
          id?: string;
          issued_at?: string;
          number?: string;
          organization_id?: string;
          paid_at?: string | null;
          reminders_paused_at?: string | null;
          source?: Database["public"]["Enums"]["invoice_source"];
          status?: Database["public"]["Enums"]["invoice_status"];
        };
        Relationships: [
          {
            foreignKeyName: "invoices_debtor_fkey";
            columns: ["debtor_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "debtors";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "invoices_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          auto_send: boolean;
          cancel_at_period_end: boolean;
          created_at: string;
          current_period_end: string | null;
          default_currency: string;
          dpa_accepted_at: string;
          dpa_ip: string;
          dpa_version: string;
          id: string;
          name: string;
          plan: Database["public"]["Enums"]["plan_tier"];
          retention_months: number;
          siren: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_status: string | null;
          trial_ends_at: string;
        };
        Insert: {
          auto_send?: boolean;
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          default_currency?: string;
          dpa_accepted_at: string;
          dpa_ip: string;
          dpa_version: string;
          id?: string;
          name: string;
          plan?: Database["public"]["Enums"]["plan_tier"];
          retention_months?: number;
          siren?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string | null;
          trial_ends_at?: string;
        };
        Update: {
          auto_send?: boolean;
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          default_currency?: string;
          dpa_accepted_at?: string;
          dpa_ip?: string;
          dpa_version?: string;
          id?: string;
          name?: string;
          plan?: Database["public"]["Enums"]["plan_tier"];
          retention_months?: number;
          siren?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string | null;
          trial_ends_at?: string;
        };
        Relationships: [];
      };
      promises: {
        Row: {
          confidence: number | null;
          created_at: string;
          id: string;
          invoice_id: string;
          kept: boolean | null;
          organization_id: string;
          promised_amount: number | null;
          promised_date: string;
          reply_id: string | null;
          source: Database["public"]["Enums"]["promise_source"];
        };
        Insert: {
          confidence?: number | null;
          created_at?: string;
          id?: string;
          invoice_id: string;
          kept?: boolean | null;
          organization_id: string;
          promised_amount?: number | null;
          promised_date: string;
          reply_id?: string | null;
          source: Database["public"]["Enums"]["promise_source"];
        };
        Update: {
          confidence?: number | null;
          created_at?: string;
          id?: string;
          invoice_id?: string;
          kept?: boolean | null;
          organization_id?: string;
          promised_amount?: number | null;
          promised_date?: string;
          reply_id?: string | null;
          source?: Database["public"]["Enums"]["promise_source"];
        };
        Relationships: [
          {
            foreignKeyName: "promises_invoice_fkey";
            columns: ["invoice_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "promises_reply_fkey";
            columns: ["reply_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "replies";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      reminder_sequences: {
        Row: {
          client_type: Database["public"]["Enums"]["client_type"];
          created_at: string;
          id: string;
          is_default: boolean;
          name: string;
          organization_id: string;
        };
        Insert: {
          client_type: Database["public"]["Enums"]["client_type"];
          created_at?: string;
          id?: string;
          is_default?: boolean;
          name: string;
          organization_id: string;
        };
        Update: {
          client_type?: Database["public"]["Enums"]["client_type"];
          created_at?: string;
          id?: string;
          is_default?: boolean;
          name?: string;
          organization_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminder_sequences_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      reminder_steps: {
        Row: {
          channel: Database["public"]["Enums"]["reminder_channel"];
          created_at: string;
          id: string;
          offset_days: number;
          organization_id: string;
          position: number;
          sequence_id: string;
          template_id: string | null;
          tone: Database["public"]["Enums"]["reminder_tone"];
        };
        Insert: {
          channel?: Database["public"]["Enums"]["reminder_channel"];
          created_at?: string;
          id?: string;
          offset_days: number;
          organization_id: string;
          position: number;
          sequence_id: string;
          template_id?: string | null;
          tone: Database["public"]["Enums"]["reminder_tone"];
        };
        Update: {
          channel?: Database["public"]["Enums"]["reminder_channel"];
          created_at?: string;
          id?: string;
          offset_days?: number;
          organization_id?: string;
          position?: number;
          sequence_id?: string;
          template_id?: string | null;
          tone?: Database["public"]["Enums"]["reminder_tone"];
        };
        Relationships: [
          {
            foreignKeyName: "reminder_steps_sequence_fkey";
            columns: ["sequence_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "reminder_sequences";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "reminder_steps_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "templates";
            referencedColumns: ["id"];
          },
        ];
      };
      reminders: {
        Row: {
          ai_generated: boolean;
          approved_at: string | null;
          approved_by: string | null;
          body: string | null;
          claimed_at: string | null;
          created_at: string;
          error: string | null;
          id: string;
          invoice_id: string;
          organization_id: string;
          provider_message_id: string | null;
          provider_thread_id: string | null;
          scheduled_at: string;
          sent_at: string | null;
          status: Database["public"]["Enums"]["reminder_status"];
          step_id: string | null;
          subject: string | null;
        };
        Insert: {
          ai_generated?: boolean;
          approved_at?: string | null;
          approved_by?: string | null;
          body?: string | null;
          claimed_at?: string | null;
          created_at?: string;
          error?: string | null;
          id?: string;
          invoice_id: string;
          organization_id: string;
          provider_message_id?: string | null;
          provider_thread_id?: string | null;
          scheduled_at: string;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["reminder_status"];
          step_id?: string | null;
          subject?: string | null;
        };
        Update: {
          ai_generated?: boolean;
          approved_at?: string | null;
          approved_by?: string | null;
          body?: string | null;
          claimed_at?: string | null;
          created_at?: string;
          error?: string | null;
          id?: string;
          invoice_id?: string;
          organization_id?: string;
          provider_message_id?: string | null;
          provider_thread_id?: string | null;
          scheduled_at?: string;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["reminder_status"];
          step_id?: string | null;
          subject?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "reminders_approver_fkey";
            columns: ["approved_by", "organization_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "reminders_invoice_fkey";
            columns: ["invoice_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "reminders_step_fkey";
            columns: ["step_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "reminder_steps";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      replies: {
        Row: {
          ai_classified: boolean;
          confidence: number | null;
          created_at: string;
          excerpt: string | null;
          handled_at: string | null;
          handled_by: string | null;
          id: string;
          invoice_id: string;
          kind: Database["public"]["Enums"]["reply_kind"];
          organization_id: string;
          provider_message_id: string;
          received_at: string;
          reminder_id: string | null;
          status: Database["public"]["Enums"]["reply_status"];
        };
        Insert: {
          ai_classified?: boolean;
          confidence?: number | null;
          created_at?: string;
          excerpt?: string | null;
          handled_at?: string | null;
          handled_by?: string | null;
          id?: string;
          invoice_id: string;
          kind: Database["public"]["Enums"]["reply_kind"];
          organization_id: string;
          provider_message_id: string;
          received_at: string;
          reminder_id?: string | null;
          status?: Database["public"]["Enums"]["reply_status"];
        };
        Update: {
          ai_classified?: boolean;
          confidence?: number | null;
          created_at?: string;
          excerpt?: string | null;
          handled_at?: string | null;
          handled_by?: string | null;
          id?: string;
          invoice_id?: string;
          kind?: Database["public"]["Enums"]["reply_kind"];
          organization_id?: string;
          provider_message_id?: string;
          received_at?: string;
          reminder_id?: string | null;
          status?: Database["public"]["Enums"]["reply_status"];
        };
        Relationships: [
          {
            foreignKeyName: "replies_handler_fkey";
            columns: ["handled_by", "organization_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "replies_invoice_fkey";
            columns: ["invoice_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "replies_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "replies_reminder_fkey";
            columns: ["reminder_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "reminders";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      templates: {
        Row: {
          body_markdown: string;
          client_type: Database["public"]["Enums"]["client_type"];
          created_at: string;
          id: string;
          is_system: boolean;
          name: string;
          organization_id: string | null;
          subject: string;
          tone: Database["public"]["Enums"]["reminder_tone"];
          variables: Json;
        };
        Insert: {
          body_markdown: string;
          client_type: Database["public"]["Enums"]["client_type"];
          created_at?: string;
          id?: string;
          is_system?: boolean;
          name: string;
          organization_id?: string | null;
          subject: string;
          tone: Database["public"]["Enums"]["reminder_tone"];
          variables?: Json;
        };
        Update: {
          body_markdown?: string;
          client_type?: Database["public"]["Enums"]["client_type"];
          created_at?: string;
          id?: string;
          is_system?: boolean;
          name?: string;
          organization_id?: string | null;
          subject?: string;
          tone?: Database["public"]["Enums"]["reminder_tone"];
          variables?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "templates_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          organization_id: string;
          role: Database["public"]["Enums"]["member_role"];
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
          organization_id: string;
          role?: Database["public"]["Enums"]["member_role"];
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          organization_id?: string;
          role?: Database["public"]["Enums"]["member_role"];
        };
        Relationships: [
          {
            foreignKeyName: "users_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invitation: {
        Args: { p_token: string };
        Returns: string;
      };
      apply_stripe_subscription: {
        Args: { p_organization_id: string; p_customer_id: string; p_subscription_id: string; p_plan: Database["public"]["Enums"]["plan_tier"]; p_status: string; p_cancel_at_period_end: boolean; p_current_period_end?: string };
        Returns: undefined;
      };
      approve_reminder: {
        Args: { p_reminder_id: string; p_subject?: string; p_body?: string };
        Returns: string;
      };
      cancel_reminder: {
        Args: { p_reminder_id: string };
        Returns: undefined;
      };
      change_invoice_status: {
        Args: { p_invoice_id: string; p_action: string; p_paid_at?: string };
        Returns: Database["public"]["Enums"]["invoice_status"];
      };
      claim_due_reminders: {
        Args: { p_limit: number };
        Returns: Database["public"]["Tables"]["reminders"]["Row"][];
      };
      claim_reminder: {
        Args: { p_reminder_id: string };
        Returns: Database["public"]["Tables"]["reminders"]["Row"][];
      };
      create_invitation: {
        Args: { p_email: string; p_role?: Database["public"]["Enums"]["member_role"] };
        Returns: { invitation_id: string; token: string }[];
      };
      dashboard_summary: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      delete_debtor: {
        Args: { p_debtor_id: string };
        Returns: number;
      };
      email_account_credentials: {
        Args: { p_organization_id: string };
        Returns: { id: string; provider: Database["public"]["Enums"]["email_provider"]; email_address: string; display_name: string; status: Database["public"]["Enums"]["connection_status"]; access_token: string; refresh_token: string; expires_at: string; smtp_host: string; smtp_port: number; smtp_user: string; smtp_password: string }[];
      };
      erase_organization: {
        Args: { p_organization_id: string };
        Returns: string[];
      };
      export_debtor: {
        Args: { p_debtor_id: string };
        Returns: Json;
      };
      import_invoices: {
        Args: { p_rows: Json; p_source: Database["public"]["Enums"]["invoice_source"] };
        Returns: Json;
      };
      invoice_status_counts: {
        Args: Record<PropertyKey, never>;
        Returns: { status: Database["public"]["Enums"]["invoice_status"]; invoice_count: number }[];
      };
      list_debtors: {
        Args: { p_client_type?: Database["public"]["Enums"]["client_type"]; p_search?: string; p_limit?: number; p_offset?: number };
        Returns: { id: string; name: string; client_type: Database["public"]["Enums"]["client_type"]; siren: string; is_legal_entity: boolean; contact_email: string; risk_score: number; payment_behavior_days: number; invoice_count: number; open_amount: number; late_amount: number; total_count: number }[];
      };
      list_invoices: {
        Args: { p_statuses?: Database["public"]["Enums"]["invoice_status"][]; p_search?: string; p_sort?: string; p_limit?: number; p_offset?: number };
        Returns: { id: string; number: string; debtor_id: string; debtor_name: string; client_type: Database["public"]["Enums"]["client_type"]; amount_ttc: number; currency: string; issued_at: string; due_at: string; paid_at: string; status: Database["public"]["Enums"]["invoice_status"]; total_count: number }[];
      };
      provision_organization: {
        Args: { p_user_id: string; p_email: string; p_full_name: string; p_organization_name: string; p_siren: string; p_dpa_version: string; p_dpa_ip: string };
        Returns: string;
      };
      purge_expired_data: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      record_promise: {
        Args: { p_invoice_id: string; p_promised_date: string; p_promised_amount?: number; p_reply_id?: string };
        Returns: string;
      };
      record_reminder_result: {
        Args: { p_reminder_id: string; p_is_sent: boolean; p_provider_message_id?: string; p_error?: string; p_provider_thread_id?: string };
        Returns: undefined;
      };
      record_reply: {
        Args: { p_organization_id: string; p_reminder_id: string; p_provider_message_id: string; p_received_at: string; p_kind: Database["public"]["Enums"]["reply_kind"]; p_excerpt?: string; p_ai_classified?: boolean; p_confidence?: number; p_promised_date?: string; p_promised_amount?: number };
        Returns: string;
      };
      refresh_all_debtor_stats: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      replace_email_account: {
        Args: { p_organization_id: string; p_actor_id: string; p_provider: Database["public"]["Enums"]["email_provider"]; p_email_address: string; p_display_name: string; p_access_token?: string; p_refresh_token?: string; p_expires_at?: string; p_smtp_host?: string; p_smtp_port?: number; p_smtp_user?: string; p_smtp_password?: string; p_imap_host?: string; p_imap_port?: number };
        Returns: string;
      };
      resolve_reply: {
        Args: { p_reply_id: string; p_resolution: string; p_paid_at?: string };
        Returns: undefined;
      };
      resume_reminders: {
        Args: { p_invoice_id: string };
        Returns: undefined;
      };
      revoke_invitation: {
        Args: { p_invitation_id: string };
        Returns: undefined;
      };
      save_sequence_steps: {
        Args: { p_sequence_id: string; p_steps: Json };
        Returns: number;
      };
      settle_due_promises: {
        Args: { p_organization_id?: string };
        Returns: number;
      };
      store_email_account_tokens: {
        Args: { p_organization_id: string; p_account_id: string; p_access_token: string; p_expires_at: string; p_refresh_token?: string };
        Returns: undefined;
      };
      vault_delete_secret: {
        Args: { p_secret_id: string };
        Returns: undefined;
      };
      vault_read_secret: {
        Args: { p_secret_id: string };
        Returns: string;
      };
      vault_store_secret: {
        Args: { p_secret: string };
        Returns: string;
      };
      vault_update_secret: {
        Args: { p_secret_id: string; p_secret: string };
        Returns: undefined;
      };
    };
    Enums: {
      actor_type: "user" | "system" | "ai";
      client_type: "b2b" | "b2c";
      connection_status: "pending" | "active" | "error" | "revoked";
      email_provider: "gmail" | "outlook" | "smtp";
      integration_provider: "pennylane" | "qonto" | "stripe" | "sellsy";
      invoice_source: "manual" | "csv" | "pennylane" | "qonto" | "stripe" | "facturx";
      invoice_status: "pending" | "late" | "promised" | "paid" | "disputed" | "cancelled";
      member_role: "owner" | "admin" | "member";
      plan_tier: "trial" | "starter" | "pro" | "business";
      promise_source: "email_reply" | "manual";
      reminder_channel: "email";
      reminder_status: "scheduled" | "awaiting_approval" | "sent" | "cancelled" | "failed";
      reminder_tone: "courtois" | "ferme" | "mise_en_demeure";
      reply_kind: "promise" | "paid_claim" | "dispute" | "other" | "auto_reply" | "bounce";
      reply_status: "new" | "handled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
