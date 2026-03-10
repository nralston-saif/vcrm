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
