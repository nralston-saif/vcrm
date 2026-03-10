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
