#!/bin/bash
#
# Cleanup Utility for E2E Production Tests
# Removes test data from production database
#

# Array to track test trip IDs
declare -a CLEANUP_TRIP_IDS

# Track test trip ID for cleanup
# Args: $1=trip_id
track_test_trip() {
  local trip_id="$1"
  CLEANUP_TRIP_IDS+=("$trip_id")
}

# Delete test trips and messages from production database
# Args: $1=user_id_pattern (e.g., "e2e-test-%")
# Returns: 0 on success, 1 on failure
cleanup_test_data() {
  local user_pattern="$1"

  echo "Cleaning up test data (pattern: $user_pattern)..."

  # Step 1: Delete themed_messages first (foreign key constraint)
  echo "  Deleting test messages..."
  if ! npx wrangler d1 execute voygent-themed \
    --command "DELETE FROM themed_messages WHERE trip_id IN (SELECT id FROM themed_trips WHERE user_id LIKE '$user_pattern')" \
    --remote >/dev/null 2>&1; then
    echo "  ⚠ Warning: Failed to delete messages" >&2
  fi

  # Step 2: Delete themed_trips
  echo "  Deleting test trips..."
  if ! npx wrangler d1 execute voygent-themed \
    --command "DELETE FROM themed_trips WHERE user_id LIKE '$user_pattern'" \
    --remote >/dev/null 2>&1; then
    echo "  ⚠ Warning: Failed to delete trips" >&2
    return 1
  fi

  # Step 3: Verify cleanup
  local remaining=$(verify_cleanup "$user_pattern")
  if [ "$remaining" -eq 0 ]; then
    echo "  ✓ Cleanup successful (0 records remaining)"
    return 0
  else
    echo "  ⚠ Warning: $remaining test records remain" >&2
    return 1
  fi
}

# Verify cleanup succeeded
# Args: $1=user_id_pattern
# Returns: count of remaining test records
verify_cleanup() {
  local user_pattern="$1"

  local count=$(npx wrangler d1 execute voygent-themed \
    --command "SELECT COUNT(*) as count FROM themed_trips WHERE user_id LIKE '$user_pattern'" \
    --remote --json 2>/dev/null | jq -r '.[0].results[0].count // 0')

  echo "$count"
}

# Manual cleanup script (can be run standalone)
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  echo "Running manual cleanup of E2E test data..."

  # Default pattern
  PATTERN="${1:-e2e-test-%}"

  cleanup_test_data "$PATTERN"
  exit $?
fi
