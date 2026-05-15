export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      langclaw_wallet_users: {
        Row: {
          created_at: string;
          id: string;
          last_login_message: string | null;
          last_seen_at: string;
          last_signature: string | null;
          updated_at: string;
          wallet_address: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          last_login_message?: string | null;
          last_seen_at?: string;
          last_signature?: string | null;
          updated_at?: string;
          wallet_address: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          last_login_message?: string | null;
          last_seen_at?: string;
          last_signature?: string | null;
          updated_at?: string;
          wallet_address?: string;
        };
        Relationships: [];
      };
      langclaw_chat_sessions: {
        Row: {
          created_at: string;
          id: string;
          pinned: boolean;
          title: string;
          updated_at: string;
          wallet_user_id: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          pinned?: boolean;
          title: string;
          updated_at?: string;
          wallet_user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          pinned?: boolean;
          title?: string;
          updated_at?: string;
          wallet_user_id?: string;
        };
        Relationships: [];
      };
      langclaw_chat_messages: {
        Row: {
          content: string;
          created_at: string;
          direct_answer: Json | null;
          error: string | null;
          id: string;
          position: number;
          progress_events: Json | null;
          result: Json | null;
          role: "assistant" | "user";
          session_id: string;
          stopped: boolean;
          wallet_user_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          direct_answer?: Json | null;
          error?: string | null;
          id: string;
          position?: number;
          progress_events?: Json | null;
          result?: Json | null;
          role: "assistant" | "user";
          session_id: string;
          stopped?: boolean;
          wallet_user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          direct_answer?: Json | null;
          error?: string | null;
          id?: string;
          position?: number;
          progress_events?: Json | null;
          result?: Json | null;
          role?: "assistant" | "user";
          session_id?: string;
          stopped?: boolean;
          wallet_user_id?: string;
        };
        Relationships: [];
      };
      langclaw_research_runs: {
        Row: {
          created_at: string;
          id: string;
          message_id: string | null;
          proof: Json | null;
          result: Json;
          session_id: string;
          topic: string;
          wallet_user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          message_id?: string | null;
          proof?: Json | null;
          result: Json;
          session_id: string;
          topic: string;
          wallet_user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          message_id?: string | null;
          proof?: Json | null;
          result?: Json;
          session_id?: string;
          topic?: string;
          wallet_user_id?: string;
        };
        Relationships: [];
      };
      langclaw_usage_accounts: {
        Row: {
          available_neuron: string;
          created_at: string;
          lifetime_charged_neuron: string;
          lifetime_deposited_neuron: string;
          reserved_neuron: string;
          updated_at: string;
          wallet_address: string;
          wallet_user_id: string;
        };
        Insert: {
          available_neuron?: string;
          created_at?: string;
          lifetime_charged_neuron?: string;
          lifetime_deposited_neuron?: string;
          reserved_neuron?: string;
          updated_at?: string;
          wallet_address: string;
          wallet_user_id: string;
        };
        Update: {
          available_neuron?: string;
          created_at?: string;
          lifetime_charged_neuron?: string;
          lifetime_deposited_neuron?: string;
          reserved_neuron?: string;
          updated_at?: string;
          wallet_address?: string;
          wallet_user_id?: string;
        };
        Relationships: [];
      };
      langclaw_usage_deposits: {
        Row: {
          amount_neuron: string;
          block_number: string;
          created_at: string;
          id: string;
          log_index: number;
          reference: string | null;
          status: "credited" | "duplicate" | "rejected";
          tx_hash: string;
          wallet_address: string;
          wallet_user_id: string;
        };
        Insert: {
          amount_neuron: string;
          block_number: string;
          created_at?: string;
          id?: string;
          log_index: number;
          reference?: string | null;
          status?: "credited" | "duplicate" | "rejected";
          tx_hash: string;
          wallet_address: string;
          wallet_user_id: string;
        };
        Update: {
          amount_neuron?: string;
          block_number?: string;
          created_at?: string;
          id?: string;
          log_index?: number;
          reference?: string | null;
          status?: "credited" | "duplicate" | "rejected";
          tx_hash?: string;
          wallet_address?: string;
          wallet_user_id?: string;
        };
        Relationships: [];
      };
      langclaw_usage_reservations: {
        Row: {
          balance_after_reserve_neuron: string;
          balance_before_neuron: string;
          charged_neuron: string;
          completion_price_neuron: string;
          completion_tokens: number | null;
          created_at: string;
          estimated_completion_tokens: number;
          estimated_prompt_tokens: number;
          id: string;
          model: string;
          prompt_price_neuron: string;
          prompt_tokens: number | null;
          released_neuron: string;
          reserved_neuron: string;
          status:
            | "reserved"
            | "charged"
            | "estimated"
            | "refunded"
            | "failed_after_charge";
          topic: string | null;
          total_tokens: number | null;
          updated_at: string;
          wallet_address: string;
          wallet_user_id: string;
        };
        Insert: {
          balance_after_reserve_neuron: string;
          balance_before_neuron: string;
          charged_neuron?: string;
          completion_price_neuron: string;
          completion_tokens?: number | null;
          created_at?: string;
          estimated_completion_tokens: number;
          estimated_prompt_tokens: number;
          id: string;
          model: string;
          prompt_price_neuron: string;
          prompt_tokens?: number | null;
          released_neuron?: string;
          reserved_neuron: string;
          status?:
            | "reserved"
            | "charged"
            | "estimated"
            | "refunded"
            | "failed_after_charge";
          topic?: string | null;
          total_tokens?: number | null;
          updated_at?: string;
          wallet_address: string;
          wallet_user_id: string;
        };
        Update: {
          balance_after_reserve_neuron?: string;
          balance_before_neuron?: string;
          charged_neuron?: string;
          completion_price_neuron?: string;
          completion_tokens?: number | null;
          created_at?: string;
          estimated_completion_tokens?: number;
          estimated_prompt_tokens?: number;
          id?: string;
          model?: string;
          prompt_price_neuron?: string;
          prompt_tokens?: number | null;
          released_neuron?: string;
          reserved_neuron?: string;
          status?:
            | "reserved"
            | "charged"
            | "estimated"
            | "refunded"
            | "failed_after_charge";
          topic?: string | null;
          total_tokens?: number | null;
          updated_at?: string;
          wallet_address?: string;
          wallet_user_id?: string;
        };
        Relationships: [];
      };
      langclaw_usage_charges: {
        Row: {
          charged_neuron: string;
          completion_price_neuron: string;
          completion_tokens: number;
          created_at: string;
          id: string;
          model: string;
          prompt_price_neuron: string;
          prompt_tokens: number;
          released_neuron: string;
          reservation_id: string;
          reserved_neuron: string;
          status: "charged" | "estimated" | "refunded" | "failed_after_charge";
          topic: string | null;
          total_tokens: number;
          wallet_address: string;
          wallet_user_id: string;
        };
        Insert: {
          charged_neuron: string;
          completion_price_neuron: string;
          completion_tokens?: number;
          created_at?: string;
          id?: string;
          model: string;
          prompt_price_neuron: string;
          prompt_tokens?: number;
          released_neuron: string;
          reservation_id: string;
          reserved_neuron: string;
          status: "charged" | "estimated" | "refunded" | "failed_after_charge";
          topic?: string | null;
          total_tokens?: number;
          wallet_address: string;
          wallet_user_id: string;
        };
        Update: {
          charged_neuron?: string;
          completion_price_neuron?: string;
          completion_tokens?: number;
          created_at?: string;
          id?: string;
          model?: string;
          prompt_price_neuron?: string;
          prompt_tokens?: number;
          released_neuron?: string;
          reservation_id?: string;
          reserved_neuron?: string;
          status?: "charged" | "estimated" | "refunded" | "failed_after_charge";
          topic?: string | null;
          total_tokens?: number;
          wallet_address?: string;
          wallet_user_id?: string;
        };
        Relationships: [];
      };
      langclaw_usage_refunds: {
        Row: {
          amount_neuron: string;
          created_at: string;
          id: string;
          reason: string | null;
          reservation_id: string;
          wallet_address: string;
          wallet_user_id: string;
        };
        Insert: {
          amount_neuron: string;
          created_at?: string;
          id?: string;
          reason?: string | null;
          reservation_id: string;
          wallet_address: string;
          wallet_user_id: string;
        };
        Update: {
          amount_neuron?: string;
          created_at?: string;
          id?: string;
          reason?: string | null;
          reservation_id?: string;
          wallet_address?: string;
          wallet_user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      langclaw_usage_credit_deposit: {
        Args: {
          p_amount_neuron: string;
          p_block_number: string;
          p_log_index: number;
          p_reference: string | null;
          p_tx_hash: string;
          p_wallet_address: string;
          p_wallet_user_id: string;
        };
        Returns: {
          balance_after_neuron: string;
          balance_before_neuron: string;
          credited: boolean;
        }[];
      };
      langclaw_usage_finalize_reservation: {
        Args: {
          p_charged_neuron: string;
          p_completion_tokens: number;
          p_prompt_tokens: number;
          p_reservation_id: string;
          p_status: string;
          p_topic: string;
          p_total_tokens: number;
        };
        Returns: {
          balance_after_neuron: string;
          charged_neuron: string;
          released_neuron: string;
          status: string;
        }[];
      };
      langclaw_usage_refund_reservation: {
        Args: {
          p_reason: string;
          p_reservation_id: string;
        };
        Returns: {
          balance_after_neuron: string;
          released_neuron: string;
        }[];
      };
      langclaw_usage_reserve_balance: {
        Args: {
          p_completion_price_neuron: string;
          p_estimated_completion_tokens: number;
          p_estimated_prompt_tokens: number;
          p_model: string;
          p_prompt_price_neuron: string;
          p_reservation_id: string;
          p_reserved_neuron: string;
          p_wallet_address: string;
          p_wallet_user_id: string;
        };
        Returns: {
          balance_after_neuron: string;
          balance_before_neuron: string;
          reservation_id: string;
          reserved_neuron: string;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
