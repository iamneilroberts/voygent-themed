#!/bin/bash

# Comprehensive Amadeus API Test Script
# Usage: ./test-amadeus-comprehensive.sh <test|prod> <api_key> <api_secret>

set -e

ENV="${1:-test}"
API_KEY="${2}"
API_SECRET="${3}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Validation
if [ -z "$API_KEY" ] || [ -z "$API_SECRET" ]; then
  echo -e "${RED}Error: API_KEY and API_SECRET are required${NC}"
  echo "Usage: $0 <test|prod> <api_key> <api_secret>"
  exit 1
fi

# Set base URL based on environment
if [ "$ENV" = "test" ]; then
  BASE_URL="https://test.api.amadeus.com"
else
  BASE_URL="https://api.amadeus.com"
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Amadeus API Comprehensive Test${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Environment: ${YELLOW}${ENV}${NC}"
echo -e "Base URL: ${YELLOW}${BASE_URL}${NC}"
echo -e "API Key: ${YELLOW}${API_KEY:0:8}...${NC}"
echo ""

# Test counter
PASS=0
FAIL=0

test_result() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((PASS++))
  else
    echo -e "${RED}❌ FAIL${NC}"
    ((FAIL++))
  fi
}

# ========================================
# TEST 1: Network Connectivity
# ========================================
echo -e "${BLUE}[1/7] Testing network connectivity to ${BASE_URL}...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}" 2>&1 || echo "000")
if [ "$HTTP_CODE" != "000" ]; then
  test_result 0
  echo -e "HTTP Status: ${GREEN}${HTTP_CODE}${NC} (server reachable)"
else
  test_result 1
  echo -e "${RED}Cannot reach Amadeus API. Check your internet connection.${NC}"
  exit 1
fi

# ========================================
# TEST 2: OAuth2 Authentication
# ========================================
echo -e "\n${BLUE}[2/7] Testing OAuth2 authentication...${NC}"
AUTH_RESPONSE=$(curl -s -X POST "${BASE_URL}/v1/security/oauth2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=${API_KEY}&client_secret=${API_SECRET}")

echo "Auth Response:"
echo "$AUTH_RESPONSE" | jq . 2>/dev/null || echo "$AUTH_RESPONSE"

ACCESS_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.access_token // empty' 2>/dev/null)

if [ -n "$ACCESS_TOKEN" ]; then
  test_result 0
  echo -e "Access Token: ${GREEN}${ACCESS_TOKEN:0:20}...${NC}"
  EXPIRES_IN=$(echo "$AUTH_RESPONSE" | jq -r '.expires_in // "unknown"' 2>/dev/null)
  echo -e "Expires In: ${YELLOW}${EXPIRES_IN} seconds${NC}"
else
  test_result 1
  echo -e "${RED}Authentication failed!${NC}"
  echo "Error: $(echo "$AUTH_RESPONSE" | jq -r '.error_description // .error // "Unknown"' 2>/dev/null)"
  exit 1
fi

# ========================================
# TEST 3: Airport/City Search (Basic API Test)
# ========================================
echo -e "\n${BLUE}[3/7] Testing airport/city search API...${NC}"
LOCATION_RESPONSE=$(curl -s -X GET "${BASE_URL}/v1/reference-data/locations?keyword=LON&subType=CITY,AIRPORT" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

echo "Location Search Response (first result):"
echo "$LOCATION_RESPONSE" | jq '.data[0] // . | if type == "object" then . else empty end' 2>/dev/null || echo "$LOCATION_RESPONSE"

if echo "$LOCATION_RESPONSE" | jq -e '.data' > /dev/null 2>&1; then
  test_result 0
  LOCATION_COUNT=$(echo "$LOCATION_RESPONSE" | jq '.data | length' 2>/dev/null)
  echo -e "Found: ${GREEN}${LOCATION_COUNT} locations${NC}"
else
  test_result 1
  echo -e "${RED}Location search failed${NC}"
  echo "$LOCATION_RESPONSE" | jq '.errors' 2>/dev/null
fi

# ========================================
# TEST 4: Hotel List by City
# ========================================
echo -e "\n${BLUE}[4/7] Testing hotel list by city API...${NC}"
HOTEL_LIST_RESPONSE=$(curl -s -X GET "${BASE_URL}/v1/reference-data/locations/hotels/by-city?cityCode=LON&radius=5&radiusUnit=KM" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

echo "Hotel List Response (first result):"
echo "$HOTEL_LIST_RESPONSE" | jq '.data[0] // . | if type == "object" then . else empty end' 2>/dev/null || echo "$HOTEL_LIST_RESPONSE"

if echo "$HOTEL_LIST_RESPONSE" | jq -e '.data' > /dev/null 2>&1; then
  test_result 0
  HOTEL_COUNT=$(echo "$HOTEL_LIST_RESPONSE" | jq '.data | length' 2>/dev/null)
  echo -e "Found: ${GREEN}${HOTEL_COUNT} hotels${NC}"
else
  test_result 1
  echo -e "${YELLOW}Hotel list API may not be available in ${ENV} environment${NC}"
  echo "$HOTEL_LIST_RESPONSE" | jq '.errors[0].detail // .error // .' 2>/dev/null
fi

# ========================================
# TEST 5: Hotel Search with Offers
# ========================================
echo -e "\n${BLUE}[5/7] Testing hotel search with offers API...${NC}"

# First, get a hotel ID from the list or use a known test hotel
HOTEL_ID=$(echo "$HOTEL_LIST_RESPONSE" | jq -r '.data[0].hotelId // "MCLONGHM"' 2>/dev/null)

HOTEL_SEARCH_RESPONSE=$(curl -s -X GET "${BASE_URL}/v3/shopping/hotel-offers?hotelIds=${HOTEL_ID}&adults=1&checkInDate=2025-07-01&checkOutDate=2025-07-03" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

echo "Hotel Search Response (first offer):"
echo "$HOTEL_SEARCH_RESPONSE" | jq '.data[0] // . | if type == "object" then . else empty end' 2>/dev/null || echo "$HOTEL_SEARCH_RESPONSE"

if echo "$HOTEL_SEARCH_RESPONSE" | jq -e '.data' > /dev/null 2>&1; then
  test_result 0
  OFFER_COUNT=$(echo "$HOTEL_SEARCH_RESPONSE" | jq '.data | length' 2>/dev/null)
  echo -e "Found: ${GREEN}${OFFER_COUNT} hotel offers${NC}"
elif echo "$HOTEL_SEARCH_RESPONSE" | jq -e '.errors[0].code' 2>/dev/null | grep -q "38196\|38187"; then
  test_result 0
  echo -e "${YELLOW}No offers available (expected in ${ENV} environment)${NC}"
else
  test_result 1
  echo -e "${RED}Hotel search failed${NC}"
  echo "$HOTEL_SEARCH_RESPONSE" | jq '.errors' 2>/dev/null
fi

# ========================================
# TEST 6: Flight Offers Search (v2)
# ========================================
echo -e "\n${BLUE}[6/7] Testing flight offers search API (v2)...${NC}"
FLIGHT_RESPONSE=$(curl -s -X GET "${BASE_URL}/v2/shopping/flight-offers?originLocationCode=JFK&destinationLocationCode=LAX&departureDate=2025-07-01&adults=1&max=1&currencyCode=USD" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

echo "Flight Search Response (first offer):"
echo "$FLIGHT_RESPONSE" | jq '.data[0] // . | if type == "object" then . else empty end' 2>/dev/null || echo "$FLIGHT_RESPONSE"

if echo "$FLIGHT_RESPONSE" | jq -e '.data' > /dev/null 2>&1; then
  test_result 0
  FLIGHT_COUNT=$(echo "$FLIGHT_RESPONSE" | jq '.data | length' 2>/dev/null)
  PRICE=$(echo "$FLIGHT_RESPONSE" | jq -r '.data[0].price.total // "N/A"' 2>/dev/null)
  echo -e "Found: ${GREEN}${FLIGHT_COUNT} flight offers${NC}"
  echo -e "Price: ${GREEN}\$${PRICE}${NC}"
elif echo "$FLIGHT_RESPONSE" | jq -e '.errors[0].code' 2>/dev/null | grep -q "425\|477"; then
  test_result 0
  echo -e "${YELLOW}No flights available for this route/date (common in test environment)${NC}"
else
  test_result 1
  echo -e "${RED}Flight search failed${NC}"
  echo "$FLIGHT_RESPONSE" | jq '.errors' 2>/dev/null
fi

# ========================================
# TEST 7: Flight Destinations (v1 - Alternative)
# ========================================
echo -e "\n${BLUE}[7/7] Testing flight destinations API (v1 alternative)...${NC}"
DESTINATIONS_RESPONSE=$(curl -s -X GET "${BASE_URL}/v1/shopping/flight-destinations?origin=PAR&maxPrice=200" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

echo "Flight Destinations Response (first result):"
echo "$DESTINATIONS_RESPONSE" | jq '.data[0] // . | if type == "object" then . else empty end' 2>/dev/null || echo "$DESTINATIONS_RESPONSE"

if echo "$DESTINATIONS_RESPONSE" | jq -e '.data' > /dev/null 2>&1; then
  test_result 0
  DEST_COUNT=$(echo "$DESTINATIONS_RESPONSE" | jq '.data | length' 2>/dev/null)
  echo -e "Found: ${GREEN}${DEST_COUNT} destinations${NC}"
else
  test_result 1
  echo -e "${YELLOW}Flight destinations may not be available in ${ENV} environment${NC}"
  echo "$DESTINATIONS_RESPONSE" | jq '.errors[0].detail // .error // .' 2>/dev/null
fi

# ========================================
# Summary
# ========================================
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Passed: ${PASS}${NC}"
echo -e "${RED}Failed: ${FAIL}${NC}"
TOTAL=$((PASS + FAIL))
echo -e "Total: ${TOTAL}"

if [ $FAIL -eq 0 ]; then
  echo -e "\n${GREEN}🎉 All tests passed!${NC}"
  echo -e "${GREEN}Your Amadeus API credentials are working correctly in ${ENV} environment.${NC}"
  exit 0
elif [ $PASS -ge 3 ]; then
  echo -e "\n${YELLOW}⚠️  Most tests passed, but some APIs may have limited data in ${ENV} environment.${NC}"
  echo -e "${YELLOW}This is expected for test environments with restricted data.${NC}"
  exit 0
else
  echo -e "\n${RED}❌ Multiple tests failed. Please check your API credentials.${NC}"
  exit 1
fi
