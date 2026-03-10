-- ========================================
-- Migration: 001_core_schema.sql
-- ========================================

-- ============================================
-- VCRM Core Schema
-- People, Companies, Relationships, Investments
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- PEOPLE
-- ========================================
CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT UNIQUE,
  alternative_emails TEXT[],
  first_name TEXT,
  last_name TEXT,
  name TEXT,
  title TEXT,
  bio TEXT,
  avatar_url TEXT,
  linkedin_url TEXT,
  twitter_url TEXT,
  mobile_phone TEXT,
  location TEXT,
  tags TEXT[] DEFAULT '{}',
  sms_notifications_enabled BOOLEAN DEFAULT FALSE,
  sms_notification_types TEXT[] DEFAULT '{}',
  phone_verified BOOLEAN DEFAULT FALSE,
  first_met_date DATE,
  introduced_by UUID REFERENCES people(id) ON DELETE SET NULL,
  introduction_context TEXT,
  relationship_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_people_updated_at
  BEFORE UPDATE ON people
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX idx_people_email ON people(email);
CREATE INDEX idx_people_auth_user_id ON people(auth_user_id);
CREATE INDEX idx_people_first_name ON people(first_name);
CREATE INDEX idx_people_created_at ON people(created_at);

-- ========================================
-- COMPANIES
-- ========================================
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  previous_names TEXT[],
  short_description TEXT,
  website TEXT,
  logo_url TEXT,
  industry TEXT,
  founded_year INTEGER,
  yc_batch TEXT,
  city TEXT,
  country TEXT,
  stage TEXT DEFAULT 'prospect' CHECK (stage IN ('portfolio', 'prospect', 'diligence', 'passed', 'archived', 'tracked')),
  entity_type TEXT DEFAULT 'for_profit' CHECK (entity_type IN ('for_profit', 'pbc', 'nonprofit', 'government', 'other')),
  is_deal_prospect BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_companies_name ON companies(name);
CREATE INDEX idx_companies_stage ON companies(stage);
CREATE INDEX idx_companies_is_active ON companies(is_active);

-- ========================================
-- COMPANY-PEOPLE RELATIONSHIPS
-- ========================================
CREATE TABLE company_people (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('founder', 'employee', 'advisor', 'board_member', 'partner')),
  title TEXT,
  is_primary_contact BOOLEAN DEFAULT FALSE,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_company_people_updated_at
  BEFORE UPDATE ON company_people
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_company_people_company_id ON company_people(company_id);
CREATE INDEX idx_company_people_user_id ON company_people(user_id);

-- ========================================
-- INVESTMENTS
-- ========================================
CREATE TABLE investments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  investment_date DATE NOT NULL,
  type TEXT CHECK (type IN ('safe', 'note', 'equity', 'option')),
  amount NUMERIC,
  round TEXT,
  post_money_valuation NUMERIC,
  discount NUMERIC,
  shares NUMERIC,
  common_shares NUMERIC,
  preferred_shares NUMERIC,
  "FD_shares" NUMERIC,
  share_location TEXT,
  share_cert_numbers TEXT[],
  lead_partner_id UUID REFERENCES people(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'acquired', 'ipo', 'failed', 'written_off')),
  exit_date DATE,
  acquirer TEXT,
  terms TEXT,
  other_funders TEXT,
  stealthy BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_investments_updated_at
  BEFORE UPDATE ON investments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_investments_company_id ON investments(company_id);

-- ========================================
-- TAGS
-- ========================================
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6B7280',
  category TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES people(id) ON DELETE SET NULL,
  usage_count INTEGER DEFAULT 0
);


-- ========================================
-- Migration: 002_crm_tables.sql
-- ========================================

-- ============================================
-- VCRM Deal Flow & Notes
-- Applications, Voting, Deliberations, Notes
-- ============================================

-- ========================================
-- APPLICATIONS (Deal Intake)
-- ========================================
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  founder_names TEXT,
  founder_linkedins TEXT,
  founder_bios TEXT,
  primary_email TEXT,
  company_description TEXT,
  website TEXT,
  previous_funding TEXT,
  deck_link TEXT,
  stage TEXT DEFAULT 'new' CHECK (stage IN ('new', 'application', 'interview', 'portfolio', 'rejected')),
  previous_stage TEXT,
  email_sender_id UUID REFERENCES people(id) ON DELETE SET NULL,
  email_sent BOOLEAN DEFAULT FALSE,
  votes_revealed BOOLEAN DEFAULT FALSE,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_applications_stage ON applications(stage);
CREATE INDEX idx_applications_submitted_at ON applications(submitted_at);

-- ========================================
-- VOTES
-- ========================================
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  vote_type TEXT DEFAULT 'initial' CHECK (vote_type IN ('initial', 'final')),
  vote TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_votes_updated_at
  BEFORE UPDATE ON votes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_votes_application_id ON votes(application_id);
CREATE INDEX idx_votes_user_id ON votes(user_id);

-- ========================================
-- DELIBERATIONS
-- ========================================
CREATE TABLE deliberations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  decision TEXT DEFAULT 'pending' CHECK (decision IN ('pending', 'maybe', 'yes', 'no')),
  status TEXT,
  notes TEXT,
  meeting_date DATE,
  idea_summary TEXT,
  thoughts TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_deliberations_updated_at
  BEFORE UPDATE ON deliberations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_deliberations_application_id ON deliberations(application_id);

-- ========================================
-- NOTES (Various Types)
-- ========================================

-- Company notes
CREATE TABLE company_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  meeting_date DATE,
  context_type TEXT CHECK (context_type IN ('deal', 'portfolio', 'person', 'company')),
  context_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_company_notes_company_id ON company_notes(company_id);

-- People notes
CREATE TABLE people_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  meeting_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_people_notes_person_id ON people_notes(person_id);

-- Application meeting notes
CREATE TABLE application_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  meeting_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_application_notes_application_id ON application_notes(application_id);

-- Investment notes
CREATE TABLE investment_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investment_id UUID NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  meeting_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_investment_notes_investment_id ON investment_notes(investment_id);


-- ========================================
-- Migration: 003_tickets_meetings.sql
-- ========================================

-- ============================================
-- VCRM Tickets & Meetings
-- ============================================

-- ========================================
-- TICKETS
-- ========================================
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'archived')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  due_date DATE,
  assigned_to UUID REFERENCES people(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  related_company UUID REFERENCES companies(id) ON DELETE SET NULL,
  related_person UUID REFERENCES people(id) ON DELETE SET NULL,
  tags TEXT[],
  was_unassigned_at_creation BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX idx_tickets_created_by ON tickets(created_by);

-- ========================================
-- TICKET COMMENTS
-- ========================================
CREATE TABLE ticket_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_final_comment BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);

-- ========================================
-- MEETINGS
-- ========================================
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  content TEXT DEFAULT '',
  created_by UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- MEETING NOTES
-- ========================================
CREATE TABLE meeting_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_meeting_notes_meeting_id ON meeting_notes(meeting_id);


-- ========================================
-- Migration: 004_notifications_audit.sql
-- ========================================

-- ============================================
-- VCRM Notifications, Audit Log, News
-- ============================================

-- ========================================
-- NOTIFICATIONS
-- ========================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES people(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- ========================================
-- AUDIT LOG
-- ========================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_actor_id ON audit_log(actor_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- Audit log insert function
CREATE OR REPLACE FUNCTION log_audit_event(
  p_actor_id UUID,
  p_actor_email TEXT DEFAULT NULL,
  p_action TEXT DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}',
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO audit_log (actor_id, actor_email, action, entity_type, entity_id, details, ip_address, user_agent)
  VALUES (p_actor_id, p_actor_email, p_action, p_entity_type, p_entity_id, p_details, p_ip_address, p_user_agent)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- NEWS ARTICLES
-- ========================================
CREATE TABLE news_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  source_name TEXT,
  topic TEXT DEFAULT 'general',
  is_ai_safety BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  fetch_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_news_articles_fetch_date ON news_articles(fetch_date);

-- ========================================
-- TICKET REPORTS
-- ========================================
CREATE TABLE ticket_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'weekly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_completed INTEGER DEFAULT 0,
  summary TEXT,
  report_data JSONB DEFAULT '{}',
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- AUTH EVENTS
-- ========================================
CREATE TABLE auth_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auth_events_user_id ON auth_events(user_id);
CREATE INDEX idx_auth_events_created_at ON auth_events(created_at);


-- ========================================
-- Migration: 005_stats_functions.sql
-- ========================================

-- ============================================
-- VCRM Statistics Functions
-- ============================================

-- Application pipeline stats
CREATE OR REPLACE FUNCTION get_application_stats()
RETURNS TABLE (
  pipeline BIGINT,
  deliberation BIGINT,
  invested BIGINT,
  rejected BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE stage IN ('new', 'application')) AS pipeline,
    COUNT(*) FILTER (WHERE stage = 'interview') AS deliberation,
    COUNT(*) FILTER (WHERE stage = 'portfolio') AS invested,
    COUNT(*) FILTER (WHERE stage = 'rejected') AS rejected
  FROM applications;
END;
$$ LANGUAGE plpgsql;

-- Portfolio investment stats
CREATE OR REPLACE FUNCTION get_portfolio_stats()
RETURNS TABLE (
  total_investments BIGINT,
  total_invested NUMERIC,
  average_check NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) AS total_investments,
    COALESCE(SUM(amount), 0) AS total_invested,
    COALESCE(AVG(amount), 0) AS average_check
  FROM investments;
END;
$$ LANGUAGE plpgsql;

-- Ticket page data function
CREATE OR REPLACE FUNCTION get_tickets_page_data(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'open_count', (SELECT COUNT(*) FROM tickets WHERE status = 'open'),
    'in_progress_count', (SELECT COUNT(*) FROM tickets WHERE status = 'in_progress'),
    'my_tickets_count', (SELECT COUNT(*) FROM tickets WHERE assigned_to = p_user_id AND status != 'archived'),
    'overdue_count', (SELECT COUNT(*) FROM tickets WHERE due_date < CURRENT_DATE AND status != 'archived')
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql;


-- ========================================
-- Migration: 006_storage.sql
-- ========================================

-- ============================================
-- VCRM Storage Buckets
-- ============================================

-- Avatar uploads bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Company logos bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload avatars
CREATE POLICY "Allow authenticated uploads to avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Allow public read of avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

CREATE POLICY "Allow authenticated uploads to logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'logos');

CREATE POLICY "Allow public read of logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'logos');

-- Allow users to update/delete their own uploads
CREATE POLICY "Allow users to manage their avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Allow users to delete their avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');
