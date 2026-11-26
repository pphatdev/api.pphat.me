-- Index visitor_logs for the two hot queries (D1 free-tier row-read outage,
-- 2026-11-26). Without it both full-scan the table on every run:
--   * live traffic: SELECT COUNT(DISTINCT ip_hash) FROM visitor_logs
--                   WHERE timestamp > ?   (dashboard SSE poll)
--   * retention:    DELETE FROM visitor_logs WHERE timestamp < ?  (cron)
-- (timestamp, ip_hash) is covering for the live count, so it reads only the
-- index entries inside the 5-minute window; the sweep seeks on timestamp.
CREATE INDEX IF NOT EXISTS idx_visitor_logs_ts_ip ON visitor_logs(timestamp, ip_hash);
