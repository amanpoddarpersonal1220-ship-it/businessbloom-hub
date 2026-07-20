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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          id: string
          target: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          id?: string
          target?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          id?: string
          target?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          assigned_employee_id: string | null
          company_name: string
          contact_name: string | null
          created_at: string
          credit_limit: number
          credit_terms: number
          email: string | null
          gst_number: string | null
          id: string
          pan: string | null
          penalty_rate: number
          phone: string | null
          profile_id: string | null
          verified: boolean
        }
        Insert: {
          assigned_employee_id?: string | null
          company_name: string
          contact_name?: string | null
          created_at?: string
          credit_limit?: number
          credit_terms?: number
          email?: string | null
          gst_number?: string | null
          id?: string
          pan?: string | null
          penalty_rate?: number
          phone?: string | null
          profile_id?: string | null
          verified?: boolean
        }
        Update: {
          assigned_employee_id?: string | null
          company_name?: string
          contact_name?: string | null
          created_at?: string
          credit_limit?: number
          credit_terms?: number
          email?: string | null
          gst_number?: string | null
          id?: string
          pan?: string | null
          penalty_rate?: number
          phone?: string | null
          profile_id?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "clients_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_purse: {
        Row: {
          client_id: string
          credit_limit: number
          id: string
          remaining: number
          updated_at: string
          used: number
        }
        Insert: {
          client_id: string
          credit_limit?: number
          id?: string
          remaining?: number
          updated_at?: string
          used?: number
        }
        Update: {
          client_id?: string
          credit_limit?: number
          id?: string
          remaining?: number
          updated_at?: string
          used?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_purse_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          allowances: number
          base_salary: number
          created_at: string
          duty_status: Database["public"]["Enums"]["duty_status"]
          email: string | null
          hra: number
          id: string
          name: string
          order_limit: number
          phone: string | null
          profile_id: string | null
        }
        Insert: {
          allowances?: number
          base_salary?: number
          created_at?: string
          duty_status?: Database["public"]["Enums"]["duty_status"]
          email?: string | null
          hra?: number
          id?: string
          name: string
          order_limit?: number
          phone?: string | null
          profile_id?: string | null
        }
        Update: {
          allowances?: number
          base_salary?: number
          created_at?: string
          duty_status?: Database["public"]["Enums"]["duty_status"]
          email?: string | null
          hra?: number
          id?: string
          name?: string
          order_limit?: number
          phone?: string | null
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gst_verification: {
        Row: {
          checked_at: string | null
          client_id: string
          created_at: string
          gst_number: string | null
          id: string
          provider: string
          status: string
        }
        Insert: {
          checked_at?: string | null
          client_id: string
          created_at?: string
          gst_number?: string | null
          id?: string
          provider?: string
          status?: string
        }
        Update: {
          checked_at?: string | null
          client_id?: string
          created_at?: string
          gst_number?: string | null
          id?: string
          provider?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gst_verification_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          approval: Database["public"]["Enums"]["confirmation_status"]
          client_id: string
          created_at: string
          due_date: string
          id: string
          invoice_no: string
          issued_at: string
          order_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
        }
        Insert: {
          amount?: number
          approval?: Database["public"]["Enums"]["confirmation_status"]
          client_id: string
          created_at?: string
          due_date?: string
          id?: string
          invoice_no?: string
          issued_at?: string
          order_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
        }
        Update: {
          amount?: number
          approval?: Database["public"]["Enums"]["confirmation_status"]
          client_id?: string
          created_at?: string
          due_date?: string
          id?: string
          invoice_no?: string
          issued_at?: string
          order_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          description: string | null
          entry_date: string
          id: string
          running_balance: number
          type: Database["public"]["Enums"]["ledger_type"]
        }
        Insert: {
          amount?: number
          client_id: string
          created_at?: string
          description?: string | null
          entry_date?: string
          id?: string
          running_balance?: number
          type: Database["public"]["Enums"]["ledger_type"]
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          description?: string | null
          entry_date?: string
          id?: string
          running_balance?: number
          type?: Database["public"]["Enums"]["ledger_type"]
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          read: boolean
          title: string
          tone: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          read?: boolean
          title: string
          tone?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          read?: boolean
          title?: string
          tone?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          client_id: string
          confirmation: Database["public"]["Enums"]["confirmation_status"]
          created_at: string
          employee_id: string | null
          id: string
          items: Json
          needs_admin_approval: boolean
          order_no: string
          status: Database["public"]["Enums"]["order_status"]
          type: Database["public"]["Enums"]["order_type"]
          value: number
        }
        Insert: {
          client_id: string
          confirmation?: Database["public"]["Enums"]["confirmation_status"]
          created_at?: string
          employee_id?: string | null
          id?: string
          items?: Json
          needs_admin_approval?: boolean
          order_no?: string
          status?: Database["public"]["Enums"]["order_status"]
          type?: Database["public"]["Enums"]["order_type"]
          value?: number
        }
        Update: {
          client_id?: string
          confirmation?: Database["public"]["Enums"]["confirmation_status"]
          created_at?: string
          employee_id?: string | null
          id?: string
          items?: Json
          needs_admin_approval?: boolean
          order_no?: string
          status?: Database["public"]["Enums"]["order_status"]
          type?: Database["public"]["Enums"]["order_type"]
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          phone_masked: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          name?: string
          phone_masked?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone_masked?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      realtime_events_log: {
        Row: {
          actor_id: string | null
          channel: string
          created_at: string
          event_type: string
          id: string
          payload: Json
        }
        Insert: {
          actor_id?: string | null
          channel: string
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
        }
        Update: {
          actor_id?: string | null
          channel?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
        }
        Relationships: []
      }
      tasks: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          employee_id: string
          id: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          employee_id: string
          id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          employee_id?: string
          id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "employee" | "client"
      confirmation_status:
        | "Pending"
        | "Accepted"
        | "Declined"
        | "ChangesRequested"
      duty_status: "On" | "Off"
      invoice_status: "Sent" | "Approved" | "Declined" | "Overdue"
      ledger_type: "charge" | "payment" | "penalty"
      order_status: "Pending" | "Confirmed" | "Invoiced" | "Paid"
      order_type: "PO" | "SO"
      task_status: "Todo" | "InProgress" | "Done"
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
      app_role: ["admin", "employee", "client"],
      confirmation_status: [
        "Pending",
        "Accepted",
        "Declined",
        "ChangesRequested",
      ],
      duty_status: ["On", "Off"],
      invoice_status: ["Sent", "Approved", "Declined", "Overdue"],
      ledger_type: ["charge", "payment", "penalty"],
      order_status: ["Pending", "Confirmed", "Invoiced", "Paid"],
      order_type: ["PO", "SO"],
      task_status: ["Todo", "InProgress", "Done"],
    },
  },
} as const
