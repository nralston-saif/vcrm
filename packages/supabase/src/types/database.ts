// Database type definitions for CRM
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Shared enums
export type UserRole = 'partner' | 'founder' | 'advisor' | 'employee' | 'board_member' | 'investor' | 'contact'
export type UserStatus = 'active' | 'eligible' | 'tracked'
export type CompanyStage = 'portfolio' | 'prospect' | 'diligence' | 'passed' | 'archived' | 'tracked'
export type EntityType = 'for_profit' | 'pbc' | 'nonprofit' | 'government' | 'other'
export type RelationshipType = 'founder' | 'employee' | 'advisor' | 'board_member' | 'partner'

// CRM-specific enums
export type ApplicationStage = 'new' | 'application' | 'interview' | 'portfolio' | 'rejected'
export type VoteType = 'initial' | 'final'
export type DeliberationDecision = 'pending' | 'maybe' | 'yes' | 'no'
export type TicketStatus = 'open' | 'in_progress' | 'archived'
export type TicketPriority = 'high' | 'medium' | 'low'

export interface Database {
  public: {
    Tables: {
      // ========================================
      // SHARED TABLES (used by both apps)
      // ========================================
      people: {
        Row: {
          id: string
          auth_user_id: string | null
          email: string | null
          alternative_emails: string[] | null
          role: UserRole
          status: UserStatus
          first_name: string | null
          last_name: string | null
          name: string | null // CRM uses 'name' field
          title: string | null
          bio: string | null
          avatar_url: string | null
          linkedin_url: string | null
          twitter_url: string | null
          mobile_phone: string | null
          location: string | null
          tags: string[]
          sms_notifications_enabled: boolean
          sms_notification_types: string[]
          phone_verified: boolean
          first_met_date: string | null
          introduced_by: string | null
          introduction_context: string | null
          relationship_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          auth_user_id?: string | null
          email?: string | null
          alternative_emails?: string[] | null
          role: UserRole
          status?: UserStatus
          first_name?: string | null
          last_name?: string | null
          name?: string | null
          title?: string | null
          bio?: string | null
          avatar_url?: string | null
          linkedin_url?: string | null
          twitter_url?: string | null
          mobile_phone?: string | null
          location?: string | null
          tags?: string[]
          sms_notifications_enabled?: boolean
          sms_notification_types?: string[]
          phone_verified?: boolean
          first_met_date?: string | null
          introduced_by?: string | null
          introduction_context?: string | null
          relationship_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          auth_user_id?: string | null
          email?: string | null
          alternative_emails?: string[] | null
          role?: UserRole
          status?: UserStatus
          first_name?: string | null
          last_name?: string | null
          name?: string | null
          title?: string | null
          bio?: string | null
          avatar_url?: string | null
          linkedin_url?: string | null
          twitter_url?: string | null
          mobile_phone?: string | null
          location?: string | null
          tags?: string[]
          sms_notifications_enabled?: boolean
          sms_notification_types?: string[]
          phone_verified?: boolean
          first_met_date?: string | null
          introduced_by?: string | null
          introduction_context?: string | null
          relationship_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_introduced_by_fkey"
            columns: ["introduced_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          }
        ]
      }
      companies: {
        Row: {
          id: string
          name: string
          previous_names: string[] | null
          short_description: string | null
          website: string | null
          logo_url: string | null
          industry: string | null
          founded_year: number | null

          yc_batch: string | null
          city: string | null
          country: string | null
          stage: CompanyStage
          entity_type: EntityType
          is_deal_prospect: boolean
          is_active: boolean
          tags: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          previous_names?: string[] | null
          short_description?: string | null
          website?: string | null
          logo_url?: string | null
          industry?: string | null
          founded_year?: number | null

          yc_batch?: string | null
          city?: string | null
          country?: string | null
          stage?: CompanyStage
          entity_type?: EntityType
          is_deal_prospect?: boolean
          is_active?: boolean
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          previous_names?: string[] | null
          short_description?: string | null
          website?: string | null
          logo_url?: string | null
          industry?: string | null
          founded_year?: number | null

          yc_batch?: string | null
          city?: string | null
          country?: string | null
          stage?: CompanyStage
          entity_type?: EntityType
          is_deal_prospect?: boolean
          is_active?: boolean
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_people: {
        Row: {
          id: string
          company_id: string
          user_id: string
          relationship_type: RelationshipType
          title: string | null
          is_primary_contact: boolean
          start_date: string | null
          end_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          user_id: string
          relationship_type: RelationshipType
          title?: string | null
          is_primary_contact?: boolean
          start_date?: string | null
          end_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          user_id?: string
          relationship_type?: RelationshipType
          title?: string | null
          is_primary_contact?: boolean
          start_date?: string | null
          end_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_people_company_id_fkey"
            columns: ["company_id"]
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_people_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          }
        ]
      }
      investments: {
        Row: {
          id: string
          company_id: string
          investment_date: string
          type: string | null
          amount: number | null
          round: string | null
          post_money_valuation: number | null
          discount: number | null
          shares: number | null
          common_shares: number | null
          preferred_shares: number | null
          FD_shares: number | null
          share_location: string | null
          share_cert_numbers: string[] | null
          lead_partner_id: string | null
          status: string | null
          exit_date: string | null
          acquirer: string | null
          terms: string | null
          other_funders: string | null
          stealthy: boolean | null
          notes: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          company_id: string
          investment_date: string
          type?: string | null
          amount?: number | null
          round?: string | null
          post_money_valuation?: number | null
          discount?: number | null
          shares?: number | null
          common_shares?: number | null
          preferred_shares?: number | null
          FD_shares?: number | null
          share_location?: string | null
          share_cert_numbers?: string[] | null
          lead_partner_id?: string | null
          status?: string | null
          exit_date?: string | null
          acquirer?: string | null
          terms?: string | null
          other_funders?: string | null
          stealthy?: boolean | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          investment_date?: string
          type?: string | null
          amount?: number | null
          round?: string | null
          post_money_valuation?: number | null
          discount?: number | null
          shares?: number | null
          common_shares?: number | null
          preferred_shares?: number | null
          FD_shares?: number | null
          share_location?: string | null
          share_cert_numbers?: string[] | null
          lead_partner_id?: string | null
          status?: string | null
          exit_date?: string | null
          acquirer?: string | null
          terms?: string | null
          other_funders?: string | null
          stealthy?: boolean | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investments_company_id_fkey"
            columns: ["company_id"]
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investments_lead_partner_id_fkey"
            columns: ["lead_partner_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          }
        ]
      }

      // ========================================
      // CRM-SPECIFIC TABLES
      // ========================================
      applications: {
        Row: {
          id: string
          company_name: string
          company_id: string | null
          founder_names: string | null
          founder_linkedins: string | null
          founder_bios: string | null
          primary_email: string | null
          company_description: string | null
          website: string | null
          previous_funding: string | null
          deck_link: string | null
          stage: ApplicationStage
          previous_stage: ApplicationStage | null
          email_sender_id: string | null
          email_sent: boolean
          votes_revealed: boolean
          submitted_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_name: string
          company_id?: string | null
          founder_names?: string | null
          founder_linkedins?: string | null
          founder_bios?: string | null
          primary_email?: string | null
          company_description?: string | null
          website?: string | null
          previous_funding?: string | null
          deck_link?: string | null
          stage?: ApplicationStage
          previous_stage?: ApplicationStage | null
          email_sender_id?: string | null
          email_sent?: boolean
          votes_revealed?: boolean
          submitted_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_name?: string
          company_id?: string | null
          founder_names?: string | null
          founder_linkedins?: string | null
          founder_bios?: string | null
          primary_email?: string | null
          company_description?: string | null
          website?: string | null
          previous_funding?: string | null
          deck_link?: string | null
          stage?: ApplicationStage
          previous_stage?: ApplicationStage | null
          email_sender_id?: string | null
          email_sent?: boolean
          votes_revealed?: boolean
          submitted_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_email_sender_id_fkey"
            columns: ["email_sender_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_company_id_fkey"
            columns: ["company_id"]
            referencedRelation: "companies"
            referencedColumns: ["id"]
          }
        ]
      }
      votes: {
        Row: {
          id: string
          application_id: string
          user_id: string
          vote_type: VoteType
          vote: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          application_id: string
          user_id: string
          vote_type?: VoteType
          vote?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          application_id?: string
          user_id?: string
          vote_type?: VoteType
          vote?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_application_id_fkey"
            columns: ["application_id"]
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          }
        ]
      }
      deliberations: {
        Row: {
          id: string
          application_id: string
          decision: DeliberationDecision
          status: string | null
          notes: string | null
          meeting_date: string | null
          idea_summary: string | null
          thoughts: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          application_id: string
          decision?: DeliberationDecision
          status?: string | null
          notes?: string | null
          meeting_date?: string | null
          idea_summary?: string | null
          thoughts?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          application_id?: string
          decision?: DeliberationDecision
          status?: string | null
          notes?: string | null
          meeting_date?: string | null
          idea_summary?: string | null
          thoughts?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliberations_application_id_fkey"
            columns: ["application_id"]
            referencedRelation: "applications"
            referencedColumns: ["id"]
          }
        ]
      }
      application_notes: {
        Row: {
          id: string
          application_id: string
          user_id: string
          content: string
          meeting_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          application_id: string
          user_id: string
          content: string
          meeting_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          application_id?: string
          user_id?: string
          content?: string
          meeting_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_notes_application_id_fkey"
            columns: ["application_id"]
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_notes_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          }
        ]
      }
      investment_notes: {
        Row: {
          id: string
          investment_id: string
          user_id: string
          content: string
          meeting_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          investment_id: string
          user_id: string
          content: string
          meeting_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          investment_id?: string
          user_id?: string
          content?: string
          meeting_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_notes_investment_id_fkey"
            columns: ["investment_id"]
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_notes_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          }
        ]
      }
      people_notes: {
        Row: {
          id: string
          person_id: string
          user_id: string
          content: string
          meeting_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          person_id: string
          user_id: string
          content: string
          meeting_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          person_id?: string
          user_id?: string
          content?: string
          meeting_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_notes_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_notes_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          }
        ]
      }
      tickets: {
        Row: {
          id: string
          title: string
          description: string | null
          status: TicketStatus
          priority: TicketPriority
          due_date: string | null
          created_at: string
          updated_at: string
          archived_at: string | null
          assigned_to: string | null
          created_by: string
          related_company: string | null
          related_person: string | null
          tags: string[] | null
          was_unassigned_at_creation: boolean | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          status?: TicketStatus
          priority?: TicketPriority
          due_date?: string | null
          created_at?: string
          updated_at?: string
          archived_at?: string | null
          assigned_to?: string | null
          created_by: string
          related_company?: string | null
          related_person?: string | null
          tags?: string[] | null
          was_unassigned_at_creation?: boolean | null
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          status?: TicketStatus
          priority?: TicketPriority
          due_date?: string | null
          created_at?: string
          updated_at?: string
          archived_at?: string | null
          assigned_to?: string | null
          created_by?: string
          related_company?: string | null
          related_person?: string | null
          tags?: string[] | null
          was_unassigned_at_creation?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_related_company_fkey"
            columns: ["related_company"]
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_related_person_fkey"
            columns: ["related_person"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          }
        ]
      }
      tags: {
        Row: {
          id: string
          name: string
          color: string
          category: string
          created_at: string
          created_by: string | null
          usage_count: number
        }
        Insert: {
          id?: string
          name: string
          color?: string
          category?: string
          created_at?: string
          created_by?: string | null
          usage_count?: number
        }
        Update: {
          id?: string
          name?: string
          color?: string
          category?: string
          created_at?: string
          created_by?: string | null
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "tags_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          }
        ]
      }
      meetings: {
        Row: {
          id: string
          title: string
          meeting_date: string
          content: string
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          meeting_date: string
          content?: string
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          meeting_date?: string
          content?: string
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          }
        ]
      }
      meeting_notes: {
        Row: {
          id: string
          meeting_id: string
          author_id: string
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          author_id: string
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          meeting_id?: string
          author_id?: string
          content?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_notes_meeting_id_fkey"
            columns: ["meeting_id"]
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_notes_author_id_fkey"
            columns: ["author_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          }
        ]
      }
      company_notes: {
        Row: {
          id: string
          company_id: string
          user_id: string
          content: string
          meeting_date: string | null
          context_type: 'deal' | 'portfolio' | 'person' | 'company' | null
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
          content: string
          meeting_date?: string | null
          context_type?: 'deal' | 'portfolio' | 'person' | 'company' | null
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
          meeting_date?: string | null
          context_type?: 'deal' | 'portfolio' | 'person' | 'company' | null
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
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_notes_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ========================================
// HELPER TYPES
// ========================================

// Shared types
export type Person = Database['public']['Tables']['people']['Row']
export type Company = Database['public']['Tables']['companies']['Row']
export type CompanyPerson = Database['public']['Tables']['company_people']['Row']
export type Investment = Database['public']['Tables']['investments']['Row']
export type Ticket = Database['public']['Tables']['tickets']['Row']
export type Tag = Database['public']['Tables']['tags']['Row']
export type Meeting = Database['public']['Tables']['meetings']['Row']
export type MeetingNote = Database['public']['Tables']['meeting_notes']['Row']

// CRM types
export type Application = Database['public']['Tables']['applications']['Row']
export type Vote = Database['public']['Tables']['votes']['Row']
export type Deliberation = Database['public']['Tables']['deliberations']['Row']
export type CrmInvestment = Database['public']['Tables']['investments']['Row']
export type InvestmentNote = Database['public']['Tables']['investment_notes']['Row']
export type PeopleNote = Database['public']['Tables']['people_notes']['Row']
export type CompanyNote = Database['public']['Tables']['company_notes']['Row']
export type NoteContextType = 'deal' | 'portfolio' | 'person' | 'company'

// Composite types
export type PersonWithCompany = Person & {
  companies?: (CompanyPerson & {
    company: Company
  })[]
}

export type CompanyWithPeople = Company & {
  people?: (CompanyPerson & {
    person: Person
  })[]
}

export type ApplicationWithVotes = Application & {
  votes?: Vote[]
  deliberations?: Deliberation[]
  people?: Person
}
