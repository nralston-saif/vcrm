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
