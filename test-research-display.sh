#!/bin/bash
# Test script to verify research display functionality

echo "=== Testing Research Display Fix ==="
echo ""
echo "Test 1: Verify API returns research data"
echo "Testing with surname: Barraza"
echo ""

# Test API endpoint
response=$(curl -s -X POST http://localhost:8788/api/trips \
  -F "theme=heritage" \
  -F "text=Family surnames: Barraza
Destination preferences: San Antonio
Travel dates: June 2025
Party size: 2 adults" \
  --max-time 25)

echo "Response received (truncated):"
echo "$response" | jq -r '{
  tripId: .tripId,
  has_diagnostics: (.diagnostics != null),
  has_research: (.diagnostics.research != null),
  research_steps: (.diagnostics.research | length),
  first_research_type: (.diagnostics.research[0].step // "none"),
  has_options: (.options != null),
  options_count: (.options | length)
}' 2>/dev/null || echo "Failed to parse response"

echo ""
echo "=== Manual Test Instructions ==="
echo "1. Open browser to: http://localhost:8788"
echo "2. Enter 'Barraza' in quick search or surnames field"
echo "3. Click 'Generate Trip Options' button"
echo "4. Watch browser console for: [Generate Full Trip] Displaying research:"
echo "5. Verify research summary appears BEFORE trip option cards"
echo ""
echo "Expected behavior:"
echo "  ✓ Research summary section displays with heritage/location info"
echo "  ✓ Trip option cards appear below research"
echo "  ✓ Console shows research array being passed to displayResearchSummary()"
echo ""
