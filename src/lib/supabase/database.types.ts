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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
