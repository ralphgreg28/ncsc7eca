-- First, let's verify and grant permissions on the dashboard functions

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_dashboard_basic_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_age_distribution TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_birth_distribution TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_payment_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_province_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_lgu_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_paid_by_age TO authenticated;

-- Also grant to anon users if needed
GRANT EXECUTE ON FUNCTION get_dashboard_basic_stats TO anon;
GRANT EXECUTE ON FUNCTION get_dashboard_age_distribution TO anon;
GRANT EXECUTE ON FUNCTION get_dashboard_birth_distribution TO anon;
GRANT EXECUTE ON FUNCTION get_dashboard_payment_stats TO anon;
GRANT EXECUTE ON FUNCTION get_dashboard_province_stats TO anon;
GRANT EXECUTE ON FUNCTION get_dashboard_lgu_stats TO anon;
GRANT EXECUTE ON FUNCTION get_dashboard_paid_by_age TO anon;
