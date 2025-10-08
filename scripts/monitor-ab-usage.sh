#!/bin/bash
# Monitor A/B endpoint usage during deprecation period
# Run daily to track usage before complete removal

set -e

echo "=== A/B Endpoint Usage Monitor ==="
echo "Date: $(date)"
echo ""

# Query logs for A/B endpoint calls in last 24 hours
YESTERDAY=$(date -u -d '24 hours ago' --iso-8601=seconds)

echo "Checking for A/B endpoint calls since $YESTERDAY..."
echo ""

# Test database
echo "--- Test Database (voygent-test) ---"
npx wrangler d1 execute voygent-test --remote --command="
SELECT
  DATE(timestamp) as date,
  COUNT(*) as call_count,
  COUNT(DISTINCT correlation_id) as unique_trips
FROM logs
WHERE message LIKE '%DEPRECATED: A/B endpoint%'
  AND timestamp >= '$YESTERDAY'
GROUP BY DATE(timestamp)
ORDER BY date DESC;
"

echo ""
echo "--- Production Database (voygent-themed) ---"
npx wrangler d1 execute voygent-themed --remote --command="
SELECT
  DATE(timestamp) as date,
  COUNT(*) as call_count,
  COUNT(DISTINCT correlation_id) as unique_trips
FROM logs
WHERE message LIKE '%DEPRECATED: A/B endpoint%'
  AND timestamp >= '$YESTERDAY'
GROUP BY DATE(timestamp)
ORDER BY date DESC;
"

echo ""
echo "=== Total A/B Usage Since Deprecation ==="
npx wrangler d1 execute voygent-themed --remote --command="
SELECT
  COUNT(*) as total_calls,
  COUNT(DISTINCT correlation_id) as unique_trips,
  MIN(timestamp) as first_call,
  MAX(timestamp) as last_call
FROM logs
WHERE message LIKE '%DEPRECATED: A/B endpoint%';
"

echo ""
echo "If usage is zero for 7 consecutive days, proceed with removal."
echo "Removal scheduled for: 2025-11-08"
