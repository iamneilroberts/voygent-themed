#!/bin/bash

# Test Amadeus API authentication
# Usage: ./test-amadeus-auth.sh <api_key> <api_secret> [test|prod]

API_KEY="${1:-wvlSAS0Lv2aW9ZPyL1wH367gP2q1ufmP}"
API_SECRET="${2:-qQBPyOqYYJaLUkAM}"
ENV="${3:-prod}"

if [ "$ENV" = "test" ]; then
  API_URL="https://test.api.amadeus.com"
else
  API_URL="https://api.amadeus.com"
fi

echo "Testing Amadeus API Authentication"
echo "=================================="
echo "API Key: ${API_KEY}"
echo "API URL: ${API_URL}"
echo "Environment: ${ENV}"
echo ""

# Get access token
echo "Requesting OAuth2 token..."
RESPONSE=$(curl -s -X POST "${API_URL}/v1/security/oauth2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=${API_KEY}&client_secret=${API_SECRET}")

echo "Response:"
echo "$RESPONSE" | jq .

# Check if we got a token
ACCESS_TOKEN=$(echo "$RESPONSE" | jq -r '.access_token // empty')

if [ -z "$ACCESS_TOKEN" ]; then
  echo ""
  echo "❌ Authentication FAILED"
  echo "Error: $(echo "$RESPONSE" | jq -r '.error_description // .error // "Unknown error"')"
  exit 1
fi

echo ""
echo "✅ Authentication SUCCESS"
echo "Access Token: ${ACCESS_TOKEN:0:20}..."
echo ""

# Test v1 endpoint (flight destinations)
echo "Testing v1 flight-destinations API..."
V1_RESPONSE=$(curl -s -X GET "${API_URL}/v1/shopping/flight-destinations?origin=PAR&maxPrice=200" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

echo "V1 Response:"
echo "$V1_RESPONSE" | jq '.data[0] // .' 2>/dev/null

if echo "$V1_RESPONSE" | jq -e '.data' > /dev/null 2>&1; then
  echo "✅ V1 API working!"
else
  echo "⚠️  V1 API returned: $(echo "$V1_RESPONSE" | jq -r '.errors[0].detail // "Unknown error"' 2>/dev/null)"
fi

echo ""
echo "Testing v2 flight-offers API..."
V2_RESPONSE=$(curl -s -X GET "${API_URL}/v2/shopping/flight-offers?originLocationCode=JFK&destinationLocationCode=LAX&departureDate=2025-07-01&adults=1&max=1" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

echo "V2 Response:"
echo "$V2_RESPONSE" | jq '.data[0] // .' 2>/dev/null

if echo "$V2_RESPONSE" | jq -e '.data' > /dev/null 2>&1; then
  echo "✅ V2 API working!"
else
  echo "⚠️  V2 API returned: $(echo "$V2_RESPONSE" | jq -r '.errors[0].detail // "Unknown error"' 2>/dev/null)"
fi
