export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type NotificationType =
  | 'new_application'
  | 'ready_for_deliberation'
  | 'new_deliberation_notes'
  | 'decision_made'
  | 'ticket_assigned'
  | 'ticket_archived'
  | 'ticket_status_changed'

export type TicketSource = 'partner' | 'founder_feedback'
export type FeedbackType = 'bug_report' | 'suggestion' | 'question'

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      companies: {
        Row: {
          city: string | null
          country: string | null
          created_at: string | null
          entity_type: string | null
          founded_year: number | null
          id: string
          industry: string | null
          is_active: boolean | null

          is_deal_prospect: boolean | null

          logo_url: string | null
          name: string
          previous_names: string[] | null
          short_description: string | null
          stage: string | null
          tags: string[] | null
          updated_at: string | null
          website: string | null
          yc_batch: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          entity_type?: string | null
          founded_year?: number | null
          id?: string
          industry?: string | null
          is_active?: boolean | null

          is_deal_prospect?: boolean | null

          logo_url?: string | null
          name: string
          previous_names?: string[] | null
          short_description?: string | null
          stage?: string | null
          tags?: string[] | null
          updated_at?: string | null
          website?: string | null
          yc_batch?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          entity_type?: string | null
          founded_year?: number | null
          id?: string
          industry?: string | null
          is_active?: boolean | null

          is_deal_prospect?: boolean | null

          logo_url?: string | null
          name?: string
          previous_names?: string[] | null
          short_description?: string | null
          stage?: string | null
          tags?: string[] | null
          updated_at?: string | null
          website?: string | null
          yc_batch?: string | null
        }
        Relationships: []
      }
      company_people: {
        Row: {
          company_id: string
          created_at: string | null
          end_date: string | null
          id: string
          is_primary_contact: boolean | null
          relationship_type: string | null
          start_date: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_primary_contact?: boolean | null
          relationship_type?: string | null
          start_date?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_primary_contact?: boolean | null
          relationship_type?: string | null
          start_date?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_people_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_people_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      investments: {
        Row: {
          acquirer: string | null
          amount: number | null
          common_shares: number | null
          company_id: string
          created_at: string | null
          discount: number | null
          exit_date: string | null
          fd_shares: number | null
          id: string
          investment_date: string
          lead_partner_id: string | null
          notes: string | null
          other_funders: string | null
          post_money_valuation: number | null
          preferred_shares: number | null
          round: string | null
          share_cert_numbers: string[] | null
          share_location: string | null
          shares: number | null
          stealthy: boolean | null
          status: string | null
          terms: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          acquirer?: string | null
          amount?: number | null
          common_shares?: number | null
          company_id: string
          created_at?: string | null
          discount?: number | null
          exit_date?: string | null
          fd_shares?: number | null
          id?: string
          investment_date: string
          lead_partner_id?: string | null
          notes?: string | null
          other_funders?: string | null
          post_money_valuation?: number | null
          preferred_shares?: number | null
          round?: string | null
          share_cert_numbers?: string[] | null
          share_location?: string | null
          shares?: number | null
          stealthy?: boolean | null
          status?: string | null
          terms?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          acquirer?: string | null
          amount?: number | null
          common_shares?: number | null
          company_id?: string
          created_at?: string | null
          discount?: number | null
          exit_date?: string | null
          fd_shares?: number | null
          id?: string
          investment_date?: string
          lead_partner_id?: string | null
          notes?: string | null
          other_funders?: string | null
          post_money_valuation?: number | null
          preferred_shares?: number | null
          round?: string | null
          share_cert_numbers?: string[] | null
          share_location?: string | null
          shares?: number | null
          stealthy?: boolean | null
          status?: string | null
          terms?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investments_lead_partner_id_fkey"
            columns: ["lead_partner_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_notes: {
        Row: {
          author_id: string
          content: string
          created_at: string | null
          id: string
          meeting_id: string
          updated_at: string | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string | null
          id?: string
          meeting_id: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string | null
          id?: string
          meeting_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_notes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          content: string | null
          created_at: string | null
          created_by: string
          id: string
          meeting_date: string
          title: string
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          created_by: string
          id?: string
          meeting_date: string
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          created_by?: string
          id?: string
          meeting_date?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          email: string | null
          first_met_date: string | null
          first_name: string | null
          id: string
          introduced_by: string | null
          introduction_context: string | null
          last_name: string | null
          linkedin_url: string | null
          location: string | null
          mobile_phone: string | null
          name: string | null
          phone_verified: boolean | null
          relationship_notes: string | null
          role: string
          sms_notification_types: string[] | null
          sms_notifications_enabled: boolean | null
          status: string | null
          tags: string[] | null
          title: string | null
          twitter_url: string | null
          updated_at: string | null
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          first_met_date?: string | null
          first_name?: string | null
          id?: string
          introduced_by?: string | null
          introduction_context?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          location?: string | null
          mobile_phone?: string | null
          name?: string | null
          phone_verified?: boolean | null
          relationship_notes?: string | null
          role: string
          sms_notification_types?: string[] | null
          sms_notifications_enabled?: boolean | null
          status?: string | null
          tags?: string[] | null
          title?: string | null
          twitter_url?: string | null
          updated_at?: string | null
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          first_met_date?: string | null
          first_name?: string | null
          id?: string
          introduced_by?: string | null
          introduction_context?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          location?: string | null
          mobile_phone?: string | null
          name?: string | null
          phone_verified?: boolean | null
          relationship_notes?: string | null
          role?: string
          sms_notification_types?: string[] | null
          sms_notifications_enabled?: boolean | null
          status?: string | null
          tags?: string[] | null
          title?: string | null
          twitter_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_introduced_by_fkey"
            columns: ["introduced_by"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          category: string | null
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          usage_count: number | null
        }
        Insert: {
          color?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          usage_count?: number | null
        }
        Update: {
          color?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          is_final_comment: boolean
          is_testing_comment: boolean
          is_reactivated_comment: boolean
          ticket_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          is_final_comment?: boolean
          is_testing_comment?: boolean
          is_reactivated_comment?: boolean
          ticket_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          is_final_comment?: boolean
          is_testing_comment?: boolean
          is_reactivated_comment?: boolean
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          application_id: string | null
          archived_at: string | null
          assigned_to: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          feedback_type: FeedbackType | null
          id: string
          is_flagged: boolean
          priority: Database["public"]["Enums"]["ticket_priority"]
          related_company: string | null
          related_person: string | null
          source: TicketSource
          status: Database["public"]["Enums"]["ticket_status"]
          tags: string[] | null
          title: string
          updated_at: string
          was_unassigned_at_creation: boolean | null
        }
        Insert: {
          application_id?: string | null
          archived_at?: string | null
          assigned_to?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          feedback_type?: FeedbackType | null
          id?: string
          is_flagged?: boolean
          priority?: Database["public"]["Enums"]["ticket_priority"]
          related_company?: string | null
          related_person?: string | null
          source?: TicketSource
          status?: Database["public"]["Enums"]["ticket_status"]
          tags?: string[] | null
          title: string
          updated_at?: string
          was_unassigned_at_creation?: boolean | null
        }
        Update: {
          application_id?: string | null
          archived_at?: string | null
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          feedback_type?: FeedbackType | null
          id?: string
          is_flagged?: boolean
          priority?: Database["public"]["Enums"]["ticket_priority"]
          related_company?: string | null
          related_person?: string | null
          source?: TicketSource
          status?: Database["public"]["Enums"]["ticket_status"]
          tags?: string[] | null
          title?: string
          updated_at?: string
          was_unassigned_at_creation?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_related_company_fkey"
            columns: ["related_company"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_related_person_fkey"
            columns: ["related_person"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_reports: {
        Row: {
          id: string
          report_type: 'daily' | 'weekly'
          period_start: string
          period_end: string
          total_completed: number
          summary: string | null
          report_data: {
            ticketsByPerson?: {
              name: string
              completed: number
              tickets: string[]
            }[]
            highlights?: string[]
            carryOver?: string[]
          }
          generated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          report_type: 'daily' | 'weekly'
          period_start: string
          period_end: string
          total_completed?: number
          summary?: string | null
          report_data?: object
          generated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          report_type?: 'daily' | 'weekly'
          period_start?: string
          period_end?: string
          total_completed?: number
          summary?: string | null
          report_data?: object
          generated_at?: string
          created_at?: string
        }
        Relationships: []
      }
      news_articles: {
        Row: {
          id: string
          title: string
          description: string | null
          url: string
          source_name: string | null
          source_id: string | null
          author: string | null
          image_url: string | null
          published_at: string
          topic: 'llm' | 'robotics' | 'regulation' | 'business' | 'research' | 'healthcare' | 'ai_safety' | 'general'
          is_ai_safety: boolean
          classification_confidence: number | null
          fetched_at: string
          fetch_date: string
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          url: string
          source_name?: string | null
          source_id?: string | null
          author?: string | null
          image_url?: string | null
          published_at: string
          topic: 'llm' | 'robotics' | 'regulation' | 'business' | 'research' | 'healthcare' | 'ai_safety' | 'general'
          is_ai_safety?: boolean
          classification_confidence?: number | null
          fetched_at?: string
          fetch_date?: string
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          url?: string
          source_name?: string | null
          source_id?: string | null
          author?: string | null
          image_url?: string | null
          published_at?: string
          topic?: 'llm' | 'robotics' | 'regulation' | 'business' | 'research' | 'healthcare' | 'ai_safety' | 'general'
          is_ai_safety?: boolean
          classification_confidence?: number | null
          fetched_at?: string
          fetch_date?: string
          created_at?: string
        }
        Relationships: []
      }
      applications: {
        Row: {
          all_votes_in: boolean | null
          comments: string | null
          company_description: string | null
          company_id: string | null
          company_name: string
          created_at: string | null
          deck_link: string | null
          draft_rejection_email: string | null
          email_sender_id: string | null
          email_sent: boolean | null
          email_sent_at: string | null
          founder_bios: string | null
          founder_linkedins: string | null
          founder_names: string | null
          id: string
          meeting_decision: string | null
          original_draft_email: string | null
          previous_funding: string | null
          primary_email: string | null
          stage: string | null
          submission_id: string | null
          submitted_at: string | null
          updated_at: string | null
          votes_revealed: boolean | null
          website: string | null
        }
        Insert: {
          all_votes_in?: boolean | null
          comments?: string | null
          company_description?: string | null
          company_id?: string | null
          company_name: string
          created_at?: string | null
          deck_link?: string | null
          draft_rejection_email?: string | null
          email_sender_id?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          founder_bios?: string | null
          founder_linkedins?: string | null
          founder_names?: string | null
          id?: string
          meeting_decision?: string | null
          original_draft_email?: string | null
          previous_funding?: string | null
          primary_email?: string | null
          stage?: string | null
          submission_id?: string | null
          submitted_at?: string | null
          updated_at?: string | null
          votes_revealed?: boolean | null
          website?: string | null
        }
        Update: {
          all_votes_in?: boolean | null
          comments?: string | null
          company_description?: string | null
          company_id?: string | null
          company_name?: string
          created_at?: string | null
          deck_link?: string | null
          draft_rejection_email?: string | null
          email_sender_id?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          founder_bios?: string | null
          founder_linkedins?: string | null
          founder_names?: string | null
          id?: string
          meeting_decision?: string | null
          original_draft_email?: string | null
          previous_funding?: string | null
          primary_email?: string | null
          stage?: string | null
          submission_id?: string | null
          submitted_at?: string | null
          updated_at?: string | null
          votes_revealed?: boolean | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_email_sender_id_fkey"
            columns: ["email_sender_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      deliberations: {
        Row: {
          application_id: string
          created_at: string | null
          decision: string | null
          id: string
          idea_summary: string | null
          meeting_date: string | null
          status: string | null
          thoughts: string | null
          updated_at: string | null
        }
        Insert: {
          application_id: string
          created_at?: string | null
          decision?: string | null
          id?: string
          idea_summary?: string | null
          meeting_date?: string | null
          status?: string | null
          thoughts?: string | null
          updated_at?: string | null
        }
        Update: {
          application_id?: string
          created_at?: string | null
          decision?: string | null
          id?: string
          idea_summary?: string | null
          meeting_date?: string | null
          status?: string | null
          thoughts?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliberations_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "deliberation_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliberations_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliberations_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliberations_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "vote_summary"
            referencedColumns: ["application_id"]
          },
        ]
      }
      investment_notes: {
        Row: {
          content: string
          created_at: string | null
          id: string
          investment_id: string
          meeting_date: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          investment_id: string
          meeting_date?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          investment_id?: string
          meeting_date?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_notes_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "portfolio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_notes_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_investments: {
        Row: {
          amount: number | null
          application_id: string | null
          company_id: string | null
          company_name: string
          contact_email: string | null
          contact_name: string | null
          created_at: string | null
          description: string | null
          founders: string | null
          id: string
          investment_date: string | null
          notes: string | null
          other_funders: string | null
          stealthy: boolean | null
          terms: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          amount?: number | null
          application_id?: string | null
          company_id?: string | null
          company_name: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string | null
          description?: string | null
          founders?: string | null
          id?: string
          investment_date?: string | null
          notes?: string | null
          other_funders?: string | null
          stealthy?: boolean | null
          terms?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          amount?: number | null
          application_id?: string | null
          company_id?: string | null
          company_name?: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string | null
          description?: string | null
          founders?: string | null
          id?: string
          investment_date?: string | null
          notes?: string | null
          other_funders?: string | null
          stealthy?: boolean | null
          terms?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "deliberation_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "vote_summary"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "legacy_investments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      application_notes: {
        Row: {
          application_id: string
          content: string
          created_at: string | null
          id: string
          meeting_date: string | null
          user_id: string
        }
        Insert: {
          application_id: string
          content: string
          created_at?: string | null
          id?: string
          meeting_date?: string | null
          user_id: string
        }
        Update: {
          application_id?: string
          content?: string
          created_at?: string | null
          id?: string
          meeting_date?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "deliberation_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "vote_summary"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "meeting_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_posts: {
        Row: {
          id: string
          author_id: string
          content: string
          tags: string[]
          is_pinned: boolean
          pinned_at: string | null
          pinned_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          author_id: string
          content: string
          tags?: string[]
          is_pinned?: boolean
          pinned_at?: string | null
          pinned_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          author_id?: string
          content?: string
          tags?: string[]
          is_pinned?: boolean
          pinned_at?: string | null
          pinned_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_replies: {
        Row: {
          id: string
          post_id: string
          author_id: string
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          post_id: string
          author_id: string
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          author_id?: string
          content?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_replies_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_reactions: {
        Row: {
          id: string
          user_id: string
          post_id: string | null
          reply_id: string | null
          emoji: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          post_id?: string | null
          reply_id?: string | null
          emoji: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          post_id?: string | null
          reply_id?: string | null
          emoji?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_reactions_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "forum_replies"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_mentions: {
        Row: {
          id: string
          mentioned_person_id: string
          post_id: string | null
          reply_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          mentioned_person_id: string
          post_id?: string | null
          reply_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          mentioned_person_id?: string
          post_id?: string | null
          reply_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_mentions_mentioned_person_id_fkey"
            columns: ["mentioned_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_mentions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_mentions_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "forum_replies"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          application_id: string | null
          created_at: string | null
          dismissed_at: string | null
          expires_at: string | null
          forum_post_id: string | null
          id: string
          link: string | null
          message: string | null
          read_at: string | null
          recipient_id: string
          ticket_id: string | null
          title: string
          type: NotificationType
        }
        Insert: {
          actor_id?: string | null
          application_id?: string | null
          created_at?: string | null
          dismissed_at?: string | null
          expires_at?: string | null
          forum_post_id?: string | null
          id?: string
          link?: string | null
          message?: string | null
          read_at?: string | null
          recipient_id: string
          ticket_id?: string | null
          title: string
          type: NotificationType
        }
        Update: {
          actor_id?: string | null
          application_id?: string | null
          created_at?: string | null
          dismissed_at?: string | null
          expires_at?: string | null
          forum_post_id?: string | null
          id?: string
          link?: string | null
          message?: string | null
          read_at?: string | null
          recipient_id?: string
          ticket_id?: string | null
          title?: string
          type?: NotificationType
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "deliberation_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "vote_summary"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      people_notes: {
        Row: {
          content: string
          created_at: string | null
          id: string
          meeting_date: string | null
          person_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          meeting_date?: string | null
          person_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          meeting_date?: string | null
          person_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_notes_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      company_notes: {
        Row: {
          id: string
          company_id: string
          user_id: string
          content: string
          meeting_date: string
          context_type: string | null
          context_id: string | null
          migrated_from_table: string | null
          migrated_from_id: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          company_id: string
          user_id: string
          content?: string
          meeting_date?: string
          context_type?: string | null
          context_id?: string | null
          migrated_from_table?: string | null
          migrated_from_id?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          user_id?: string
          content?: string
          meeting_date?: string
          context_type?: string | null
          context_id?: string | null
          migrated_from_table?: string | null
          migrated_from_id?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          application_id: string
          created_at: string | null
          id: string
          is_revealed: boolean | null
          notes: string | null
          user_id: string
          vote: string
          vote_type: string
        }
        Insert: {
          application_id: string
          created_at?: string | null
          id?: string
          is_revealed?: boolean | null
          notes?: string | null
          user_id: string
          vote: string
          vote_type: string
        }
        Update: {
          application_id?: string
          created_at?: string | null
          id?: string
          is_revealed?: boolean | null
          notes?: string | null
          user_id?: string
          vote?: string
          vote_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "deliberation_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "vote_summary"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name?: string | null
          role?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          role?: string
        }
        Relationships: []
      }
      website_blog_posts: {
        Row: {
          author_id: string | null
          content: string | null
          created_at: string | null
          excerpt: string | null
          id: string
          published: boolean | null
          published_at: string | null
          slug: string
          source: string | null
          source_url: string | null
          title: string
        }
        Insert: {
          author_id?: string | null
          content?: string | null
          created_at?: string | null
          excerpt?: string | null
          id?: string
          published?: boolean | null
          published_at?: string | null
          slug: string
          source?: string | null
          source_url?: string | null
          title: string
        }
        Update: {
          author_id?: string | null
          content?: string | null
          created_at?: string | null
          excerpt?: string | null
          id?: string
          published?: boolean | null
          published_at?: string | null
          slug?: string
          source?: string | null
          source_url?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_blog_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "website_team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      website_investment_themes: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      website_portfolio_companies: {
        Row: {
          company_id: string | null
          created_at: string | null
          description: string | null
          featured: boolean | null
          id: string
          logo_url: string | null
          name: string
          sort_order: number | null
          tagline: string | null
          theme_id: string | null
          website_url: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          featured?: boolean | null
          id?: string
          logo_url?: string | null
          name: string
          sort_order?: number | null
          tagline?: string | null
          theme_id?: string | null
          website_url?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          featured?: boolean | null
          id?: string
          logo_url?: string | null
          name?: string
          sort_order?: number | null
          tagline?: string | null
          theme_id?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "website_portfolio_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_portfolio_companies_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "website_investment_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      website_team_members: {
        Row: {
          bio: string | null
          created_at: string | null
          id: string
          linkedin_url: string | null
          name: string
          photo_url: string | null
          role: string
          sort_order: number | null
          twitter_url: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          id?: string
          linkedin_url?: string | null
          name: string
          photo_url?: string | null
          role: string
          sort_order?: number | null
          twitter_url?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          id?: string
          linkedin_url?: string | null
          name?: string
          photo_url?: string | null
          role?: string
          sort_order?: number | null
          twitter_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      deliberation_queue: {
        Row: {
          company_description: string | null
          company_name: string | null
          decision: string | null
          id: string | null
          idea_summary: string | null
          meeting_date: string | null
          primary_email: string | null
          status: string | null
          thoughts: string | null
        }
        Relationships: []
      }
      pipeline: {
        Row: {
          all_votes_in: boolean | null
          comments: string | null
          company_description: string | null
          company_name: string | null
          created_at: string | null
          deck_link: string | null
          founder_bios: string | null
          founder_linkedins: string | null
          founder_names: string | null
          id: string | null
          meeting_decision: string | null
          previous_funding: string | null
          primary_email: string | null
          stage: string | null
          submission_id: string | null
          submitted_at: string | null
          updated_at: string | null
          vote_count: number | null
          votes_revealed: boolean | null
          website: string | null
        }
        Relationships: []
      }
      portfolio: {
        Row: {
          amount: number | null
          application_id: string | null
          company_description: string | null
          company_name: string | null
          contact_email: string | null
          contact_name: string | null
          created_at: string | null
          description: string | null
          founder_bios: string | null
          founder_names: string | null
          founders: string | null
          id: string | null
          investment_date: string | null
          notes: string | null
          other_funders: string | null
          stealthy: boolean | null
          terms: string | null
          updated_at: string | null
          website: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "deliberation_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "vote_summary"
            referencedColumns: ["application_id"]
          },
        ]
      }
      investments_with_ownership: {
        Row: {
          acquirer: string | null
          amount: number | null
          common_shares: number | null
          company_id: string | null
          company_name: string | null
          created_at: string | null
          discount: number | null
          exit_date: string | null
          fd_shares: number | null
          id: string | null
          investment_date: string | null
          lead_partner_id: string | null
          ownership_percentage: number | null
          post_money_valuation: number | null
          preferred_shares: number | null
          round: string | null
          share_cert_numbers: string[] | null
          share_location: string | null
          shares: number | null
          status: string | null
          type: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investments_lead_partner_id_fkey"
            columns: ["lead_partner_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      vote_summary: {
        Row: {
          application_id: string | null
          company_name: string | null
          maybe_votes: number | null
          no_votes: number | null
          total_votes: number | null
          votes_revealed: boolean | null
          yes_votes: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      clean_founder_name: { Args: { name: string }; Returns: string }
      get_auth_email: { Args: never; Returns: string }
      get_portfolio_company_ids: {
        Args: never
        Returns: {
          company_id: string
        }[]
      }
      get_user_company_ids: {
        Args: never
        Returns: {
          company_id: string
        }[]
      }
      get_user_founder_company_ids: {
        Args: never
        Returns: {
          company_id: string
        }[]
      }
      increment_tag_usage: { Args: { tag_name: string }; Returns: undefined }
      get_portfolio_stats: {
        Args: never
        Returns: {
          total_investments: number
          total_invested: number
          average_check: number
        }[]
      }
      get_application_stats: {
        Args: never
        Returns: {
          pipeline: number
          deliberation: number
          invested: number
          rejected: number
        }[]
      }
      get_unverified_signups: {
        Args: { check_emails: string[] }
        Returns: { email: string }[]
      }
    }
    Enums: {
      ticket_priority: "high" | "medium" | "low"
      ticket_status: "open" | "in_progress" | "testing" | "archived"
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
      ticket_priority: ["high", "medium", "low"],
      ticket_status: ["open", "in_progress", "testing", "archived"],
    },
  },
} as const

// Helper types
export type Meeting = Database['public']['Tables']['meetings']['Row']
export type MeetingNote = Database['public']['Tables']['meeting_notes']['Row']
export type Person = Database['public']['Tables']['people']['Row']
export type Company = Database['public']['Tables']['companies']['Row']
export type CompanyStage = Database['public']['Tables']['companies']['Row']['stage']
export type CompanyPerson = Database['public']['Tables']['company_people']['Row']
export type RelationshipType = Database['public']['Tables']['company_people']['Row']['relationship_type']
export type UserRole = Database['public']['Tables']['people']['Row']['role']
export type UserStatus = Database['public']['Tables']['people']['Row']['status']
export type TicketStatus = Database['public']['Tables']['tickets']['Row']['status']
export type TicketPriority = Database['public']['Tables']['tickets']['Row']['priority']
export type TicketComment = Database['public']['Tables']['ticket_comments']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']

// Helper type for notification with actor info
export type NotificationWithActor = Notification & {
  actor?: Database['public']['Tables']['people']['Row'] | null
}

// AI News Article types
export type AINewsArticle = Database['public']['Tables']['news_articles']['Row']
export type AINewsTopic = AINewsArticle['topic']

// Forum types
export type ForumPost = Database['public']['Tables']['forum_posts']['Row']
export type ForumReply = Database['public']['Tables']['forum_replies']['Row']
export type ForumReaction = Database['public']['Tables']['forum_reactions']['Row']
export type ForumMention = Database['public']['Tables']['forum_mentions']['Row']

export type ForumPostWithAuthor = ForumPost & {
  author: Pick<Person, 'id' | 'first_name' | 'last_name' | 'avatar_url' | 'role'> | null
}

export type ForumTagData = {
  id: string
  name: string
  color: string | null
  category: string | null
}

export type CompanyInfo = {
  id: string
  name: string
}

export type ForumReplyWithAuthor = ForumReply & {
  author: Pick<Person, 'id' | 'first_name' | 'last_name' | 'avatar_url' | 'role'> | null
}

export type ReactionEmoji = 'thumbsup' | 'heart' | 'tada' | 'bulb'

export type ReactionSummary = {
  emoji: ReactionEmoji
  count: number
  reacted: boolean
}
