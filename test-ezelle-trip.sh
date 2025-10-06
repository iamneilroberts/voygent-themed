#!/bin/bash
# Test Ezelle Surname Heritage Trip
# 2 adults interested in Ezelle surname with suspected German origins

set -e

BASE_URL="http://localhost:8788"
TRIP_ID=""

echo "========================================"
echo "Ezelle Surname Heritage Trip Test"
echo "========================================"
echo "Family: 2 adults"
echo "Surname: Ezelle"
echo "Suspected Origin: Germany"
echo "========================================"
echo ""

# Step 1: Create trip intake with genealogy research
echo "[1/5] Creating trip with genealogy research..."
echo "   Including genealogy URL for surname research..."

TEXT_INPUT="Ezelle family heritage trip to Germany.

Party: 2 adults interested in genealogy and family history

Surnames: Ezelle
Suspected Origins: Germany (possibly Bavaria or Rhine region)

Duration: 7-10 days
Travel Month: September 2026
Origin: JFK (New York)

Budget: Mid-range comfort
Transport: Mix of train and car rental
Interests:
- Genealogy research and archives
- Historical sites related to surname origins
- Regional culture and traditions
- Museums and historical towns

Additional Notes: We believe the Ezelle surname may have German/European origins, possibly a variant of another surname. Interested in researching historical records and visiting regions where the name may have originated."

echo "   Submitting trip request..."
INTAKE_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/trips" \
  -F "userId=test-user-ezelle" \
  -F "text=${TEXT_INPUT}" \
  -F "departure_airport=JFK" \
  -F "transport_pref=mixed" \
  -F "hotel_type=midrange")

TRIP_ID=$(echo "$INTAKE_RESPONSE" | grep -o '"tripId":"[^"]*' | cut -d'"' -f4)

if [ -z "$TRIP_ID" ]; then
  echo "❌ FAIL: Could not extract trip ID"
  echo "Response: $INTAKE_RESPONSE"
  exit 1
fi

echo "✅ PASS: Trip created with ID: $TRIP_ID"
echo ""

# Step 2: Wait for genealogy enrichment and options generation
echo "[2/5] Waiting for genealogy research and options generation (35 seconds)..."
echo "   The system should:"
echo "   - Research Ezelle surname origins"
echo "   - Search for historical context"
echo "   - Generate region-specific trip options"
sleep 35

# Step 3: Fetch trip and display genealogy research
echo "[3/5] Checking genealogy research results..."
TRIP_DATA=$(curl -s "${BASE_URL}/api/trips/${TRIP_ID}")

# Display genealogy context if found
if echo "$TRIP_DATA" | grep -q "ancestry_context"; then
  echo "✅ PASS: Genealogy research completed"

  # Try to extract surnames found
  SURNAMES=$(echo "$TRIP_DATA" | grep -o '"surnames":\[.*\]' | head -1)
  if [ -n "$SURNAMES" ]; then
    echo "   Surnames identified: $SURNAMES"
  fi

  # Try to extract origins
  ORIGINS=$(echo "$TRIP_DATA" | grep -o '"origins":\[.*\]' | head -1)
  if [ -n "$ORIGINS" ]; then
    echo "   Origins found: $ORIGINS"
  fi

  # Extract genealogy snippet
  GENEALOGY_SNIPPET=$(echo "$TRIP_DATA" | grep -o '"ancestry_context":{[^}]*' | head -c 300)
  echo "   Research summary: ${GENEALOGY_SNIPPET}..."
else
  echo "⚠️  WARNING: Genealogy context not found"
fi
echo ""

# Step 4: Display trip options
echo "[4/5] Displaying trip options..."
OPTIONS_COUNT=$(echo "$TRIP_DATA" | grep -o '"key":"[ABCD]"' | wc -l)

if [ "$OPTIONS_COUNT" -ge 2 ]; then
  echo "✅ PASS: Found $OPTIONS_COUNT trip options"
  echo ""
  echo "=========================================="
  echo "RECOMMENDED TRIPS:"
  echo "=========================================="

  # Extract and display options
  echo "$TRIP_DATA" | jq -r '.options.options[]? // .options[]? |
    "[\(.key)] \(.title)\n" +
    "    Overview: \(.whyOverall)\n" +
    "    Duration: \(.days | length) days\n" +
    "    Regions: \([.days[].city] | unique | join(", "))\n"' 2>/dev/null || {
    # Fallback if jq parsing fails
    echo "$TRIP_DATA" | grep -o '"title":"[^"]*' | cut -d'"' -f4 | while read title; do
      echo "- $title"
    done
  }
else
  echo "❌ FAIL: Expected at least 2 options, found $OPTIONS_COUNT"
  echo "Raw response (first 1000 chars):"
  echo "$TRIP_DATA" | head -c 1000
  exit 1
fi
echo ""

# Step 5: Select first option and show details
echo "[5/5] Selecting Option A for detailed view..."
SELECT_RESPONSE=$(curl -s -X PATCH "${BASE_URL}/api/trips/${TRIP_ID}/select" \
  -H "Content-Type: application/json" \
  -d '{"optionKey":"A"}')

# Check if selection was successful
if echo "$SELECT_RESPONSE" | grep -q '"status":"option_selected"'; then
  echo "✅ PASS: Option A selected"

  # Display itinerary details
  echo ""
  echo "=========================================="
  echo "DETAILED ITINERARY - OPTION A:"
  echo "=========================================="

  echo "$SELECT_RESPONSE" | jq -r '.itinerary |
    "Title: \(.title)\n" +
    "Overview: \(.overview)\n" +
    "\nDaily Schedule:\n" +
    (.days[]? |
      "Day \(.d): \(.city)\n" +
      "  Morning: \(.am)\n" +
      "  Afternoon: \(.pm)\n" +
      (if .eve then "  Evening: \(.eve)\n" else "" end) +
      (if .why then "  Why: \(.why)\n" else "" end) +
      "\n"
    )' 2>/dev/null || echo "Could not parse detailed itinerary"

  # Check for hotel options
  HOTEL_COUNT=$(echo "$SELECT_RESPONSE" | grep -o '"hotel_id"' | wc -l)
  if [ "$HOTEL_COUNT" -gt 0 ]; then
    echo "=========================================="
    echo "HOTEL OPTIONS: $HOTEL_COUNT hotels found"
    echo "=========================================="
  fi
else
  echo "⚠️  WARNING: Option selection may have issues"
  echo "Response: $(echo "$SELECT_RESPONSE" | head -c 500)"
fi
echo ""

# Summary
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo "Trip ID: $TRIP_ID"
echo "Surname: Ezelle"
echo "Origin Research: Germany"
echo "Party: 2 adults"
echo "Options Generated: $OPTIONS_COUNT"
echo "Hotels Found: $HOTEL_COUNT"
echo ""
echo "View full trip at: ${BASE_URL}/trip.html?id=${TRIP_ID}"
echo "=========================================="
echo ""
echo "To see the full trip data:"
echo "curl \"${BASE_URL}/api/trips/${TRIP_ID}\" | jq"
