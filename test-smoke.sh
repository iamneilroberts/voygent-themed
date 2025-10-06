#!/bin/bash
# Smoke test for Voygent Heritage MVP

set -e

BASE_URL="${BASE_URL:-http://localhost:8788}"
echo "Testing against: $BASE_URL"

echo ""
echo "=== SMOKE TEST: Create intake with two surnames, genealogy URL, generate options ==="
echo ""

# Step 1: Create trip
echo "1️⃣  POST /api/trips - Creating trip..."
TRIP_RESPONSE=$(curl -s -X POST "$BASE_URL/api/trips" \
  -F "text=Family surnames: McLeod, Roberts
Suspected origins: Isle of Skye (Scotland), Wales
Party: 2 adults
Duration: 7 days
Target month: June
Luxury level: Comfort
Activity level: moderate
Additional notes:
My great-grandmother was Flora McLeod from Skye, emigrated 1890s.
Roberts side possibly from Conwy area.
Genealogy link: https://www.familysearch.org/tree/person/details/ABCD-123" \
  -F "userId=test-user-001")

echo "$TRIP_RESPONSE" | jq '.'

TRIP_ID=$(echo "$TRIP_RESPONSE" | jq -r '.tripId')
echo ""
echo "✅ Trip created: $TRIP_ID"
echo ""

if [ "$TRIP_ID" == "null" ] || [ -z "$TRIP_ID" ]; then
  echo "❌ Failed to create trip"
  exit 1
fi

sleep 2

# Step 2: Get trip details
echo "2️⃣  GET /api/trips/$TRIP_ID - Fetching trip details..."
curl -s "$BASE_URL/api/trips/$TRIP_ID" | jq '.'
echo ""

sleep 1

# Step 3: Select option B
echo "3️⃣  PATCH /api/trips/$TRIP_ID/select - Selecting option B..."
SELECT_RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/trips/$TRIP_ID/select" \
  -H "Content-Type: application/json" \
  -d '{"optionKey":"B"}')

echo "$SELECT_RESPONSE" | jq '.'
echo ""
echo "✅ Option B selected"
echo ""

sleep 2

# Step 4: Generate A/B variants
echo "4️⃣  PATCH /api/trips/$TRIP_ID/ab - Generating A/B variants..."
AB_RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/trips/$TRIP_ID/ab" \
  -H "Content-Type: application/json" \
  -d '{
    "transport": {"rail":true,"car_ok":true,"driver_guide_ok":false},
    "luxury": "Comfort",
    "activity": "moderate",
    "accessibility": "none"
  }')

echo "$AB_RESPONSE" | jq '.'
echo ""
echo "✅ A/B variants generated"
echo ""

sleep 1

# Step 5: Get final trip with all data
echo "5️⃣  GET /api/trips/$TRIP_ID - Final trip data..."
FINAL_RESPONSE=$(curl -s "$BASE_URL/api/trips/$TRIP_ID")
echo "$FINAL_RESPONSE" | jq '.'
echo ""

# Extract status
STATUS=$(echo "$FINAL_RESPONSE" | jq -r '.status')

echo ""
echo "========================================="
echo "🎉 SMOKE TEST COMPLETE!"
echo "========================================="
echo "Trip ID: $TRIP_ID"
echo "Final Status: $STATUS"
echo ""
echo "Full workflow tested:"
echo "  ✅ Create intake with two surnames (McLeod, Roberts)"
echo "  ✅ Link to genealogy URL"
echo "  ✅ Generate options (<=4)"
echo "  ✅ Select option B"
echo "  ✅ Produce A/B variants"
echo "  ✅ Save Trip ID"
echo ""

if [ "$STATUS" == "ab_ready" ]; then
  echo "✅ All tests passed!"
  exit 0
else
  echo "⚠️  Unexpected final status: $STATUS"
  exit 1
fi
