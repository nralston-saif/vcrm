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
  role TEXT DEFAULT 'contact',
  status TEXT DEFAULT 'active',
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
  fd_shares NUMERIC,
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

-- Grant access to PostgREST roles
GRANT ALL ON people, companies, company_people, investments, tags TO authenticated;
GRANT ALL ON people, companies, company_people, investments, tags TO service_role;
