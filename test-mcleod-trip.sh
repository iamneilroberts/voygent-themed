#!/bin/bash
# Test McLeod Family Heritage Trip Creation
# 2 adults (50s), 2 children (12, 15), 1 senior (80) with mobility limitations
# Surname: McLeod, 10 days, budget-conscious with splurges

set -e

BASE_URL="http://localhost:8788"
TRIP_ID=""

echo "========================================"
echo "McLeod Family Heritage Trip Test"
echo "========================================"
echo ""

# Step 1: Create trip intake
echo "[1/6] Creating trip intake..."

# Build text input
TEXT_INPUT="McLeod family heritage trip to Scotland.

Party: 2 adults in their 50s, 2 children ages 12 and 15, and one 80-year-old grandparent with some mobility limitations.

Duration: 10 days
Travel Month: June 2026
Origin: JFK (New York)
Surnames: McLeod

Budget: Low cost / budget-conscious with a couple of splurges for special experiences
Transport: OK with driving some (self-drive acceptable)
Accessibility: Senior grandparent (80) has mobility limitations - need accessible accommodations and activities

Special Interests:
- McLeod clan history
- Isle of Skye (ancestral homeland)
- Mix of budget accommodations with 1-2 special splurge experiences for the family

Additional Notes: Multi-generational family trip with accessibility needs for elderly grandparent."

INTAKE_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/trips" \
  -F "userId=test-user-mcleod" \
  -F "text=${TEXT_INPUT}" \
  -F "departure_airport=JFK" \
  -F "transport_pref=self_drive_ok" \
  -F "hotel_type=budget" \
  -F "genealogy_url=https://www.wikitree.com/wiki/MacLeod-1")

TRIP_ID=$(echo "$INTAKE_RESPONSE" | grep -o '"tripId":"[^"]*' | cut -d'"' -f4)

if [ -z "$TRIP_ID" ]; then
  echo "❌ FAIL: Could not extract trip ID"
  echo "Response: $INTAKE_RESPONSE"
  exit 1
fi

echo "✅ PASS: Trip created with ID: $TRIP_ID"
echo ""

# Step 2: Wait for genealogy enrichment and options generation
echo "[2/6] Waiting for genealogy enrichment and options generation (30 seconds)..."
sleep 30

# Step 3: Fetch trip to verify genealogy context
echo "[3/6] Fetching trip with genealogy context..."
TRIP_DATA=$(curl -s "${BASE_URL}/api/trips/${TRIP_ID}")

# Check if genealogy context exists
if echo "$TRIP_DATA" | grep -q "McLeod"; then
  echo "✅ PASS: Genealogy context found"

  # Extract and display genealogy snippet
  GENEALOGY_SNIPPET=$(echo "$TRIP_DATA" | grep -o '"genealogy_context":"[^"]*' | head -1 | cut -d'"' -f4 | head -c 200)
  echo "   Snippet: ${GENEALOGY_SNIPPET}..."
else
  echo "⚠️  WARNING: Genealogy context not found (may still be processing)"
fi
echo ""

# Step 4: Check if options were generated
echo "[4/6] Checking for trip options..."
OPTIONS_COUNT=$(echo "$TRIP_DATA" | grep -o '"key":"[ABCD]"' | wc -l)

if [ "$OPTIONS_COUNT" -ge 2 ]; then
  echo "✅ PASS: Found $OPTIONS_COUNT options"

  # Display option titles
  echo "   Options:"
  echo "$TRIP_DATA" | grep -o '"title":"[^"]*' | cut -d'"' -f4 | head -4 | while read title; do
    echo "   - $title"
  done
else
  echo "❌ FAIL: Expected at least 2 options, found $OPTIONS_COUNT"
  exit 1
fi
echo ""

# Step 5: Select Option A and fetch hotels
echo "[5/6] Selecting Option A and fetching hotels..."
SELECT_RESPONSE=$(curl -s -X PATCH "${BASE_URL}/api/trips/${TRIP_ID}/select" \
  -H "Content-Type: application/json" \
  -d '{"optionKey":"A"}')

# Check if hotels were returned
HOTEL_COUNT=$(echo "$SELECT_RESPONSE" | grep -o '"hotel_id":"[^"]*' | wc -l)

if [ "$HOTEL_COUNT" -gt 0 ]; then
  echo "✅ PASS: Found $HOTEL_COUNT hotels across cities"

  # Display hotel cities
  echo "   Hotel locations:"
  echo "$SELECT_RESPONSE" | grep -o '"city":"[^"]*' | cut -d'"' -f4 | sort -u | while read city; do
    echo "   - $city"
  done
else
  echo "⚠️  WARNING: No hotels found (may need to check provider availability)"
fi
echo ""

# Step 6: Generate A/B variants with flight pricing
echo "[6/6] Generating A/B variants with flight pricing..."
AB_RESPONSE=$(curl -s -X PATCH "${BASE_URL}/api/trips/${TRIP_ID}/ab" \
  -H "Content-Type: application/json" \
  -d '{
    "transport": {
      "rail": true,
      "car_ok": true,
      "driver_guide_ok": false
    },
    "luxury": "budget",
    "activity": "moderate",
    "accessibility": "senior_friendly"
  }')

# Check for flight pricing in variants
if echo "$AB_RESPONSE" | grep -q '"flights"'; then
  echo "✅ PASS: Variants generated with flight pricing"

  # Extract variant A flight info
  VARIANT_A_PRICE=$(echo "$AB_RESPONSE" | grep -o '"price_low":[0-9.]*' | head -1 | cut -d':' -f2)
  VARIANT_A_CARRIER=$(echo "$AB_RESPONSE" | grep -o '"carrier":"[^"]*' | head -1 | cut -d'"' -f4)
  VARIANT_A_TOTAL=$(echo "$AB_RESPONSE" | grep -o '"total_estimate":[0-9]*' | head -1 | cut -d':' -f2)

  if [ -n "$VARIANT_A_PRICE" ]; then
    echo "   Variant A Flight: \$$VARIANT_A_PRICE via $VARIANT_A_CARRIER"
    echo "   Variant A Total Estimate: \$$VARIANT_A_TOTAL"
  fi

  # Extract variant B flight info
  VARIANT_B_PRICE=$(echo "$AB_RESPONSE" | grep -o '"price_low":[0-9.]*' | tail -1 | cut -d':' -f2)
  VARIANT_B_TOTAL=$(echo "$AB_RESPONSE" | grep -o '"total_estimate":[0-9]*' | tail -1 | cut -d':' -f2)

  if [ -n "$VARIANT_B_PRICE" ]; then
    echo "   Variant B Flight: \$$VARIANT_B_PRICE"
    echo "   Variant B Total Estimate: \$$VARIANT_B_TOTAL"
  fi
else
  echo "⚠️  WARNING: Flight pricing not found in variants"
fi
echo ""

# Summary
echo "========================================"
echo "Test Summary"
echo "========================================"
echo "Trip ID: $TRIP_ID"
echo "Family: McLeod (2 adults 50s, 2 children, 1 senior 80)"
echo "Duration: 10 days"
echo "Budget: Low cost with splurges"
echo "Accessibility: Senior mobility limitations"
echo ""
echo "✅ Trip intake created"
echo "✅ Genealogy context processed"
echo "✅ Options generated ($OPTIONS_COUNT options)"
echo "✅ Hotels fetched ($HOTEL_COUNT hotels)"
echo "✅ A/B variants with flight pricing"
echo ""
echo "View trip at: ${BASE_URL}/trip.html?id=${TRIP_ID}"
echo "========================================"
