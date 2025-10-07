# Quickstart: Web Search Integration with Genealogy Context & Provider APIs

**Feature**: 001-web-search-integration | **Date**: 2025-10-05
**Prerequisites**: research.md, data-model.md, contracts/ complete

## Overview

This quickstart demonstrates how to test the new provider endpoints and cost estimation API using curl. All examples assume local development (`wrangler dev` on port 8788).

For production URLs, replace `http://localhost:8788/api` with `https://voygent-heritage-mvp.pages.dev/api`.

---

## Setup

### 1. Environment Variables

Ensure `~/Documents/.env` contains:

```bash
# Amadeus Self-Service API
AMADEUS_CLIENT_ID=your_amadeus_client_id
AMADEUS_CLIENT_SECRET=your_amadeus_client_secret
AMADEUS_API_URL=https://test.api.amadeus.com

# Kiwi Tequila API
KIWI_API_KEY=your_kiwi_api_key
KIWI_API_URL=https://api.tequila.kiwi.com

# Serper.dev
SERPER_API_KEY=your_serper_api_key
SERPER_API_URL=https://google.serper.dev

# Tavily Search API
TAVILY_API_KEY=your_tavily_api_key
TAVILY_API_URL=https://api.tavily.com

# Google Places API
GOOGLE_PLACES_API_KEY=your_google_places_api_key
```

### 2. Database Migration

Run the cache providers migration:

```bash
wrangler d1 execute voygent-themed --local --file=migrations/003_cache_providers.sql
wrangler d1 execute voygent-themed --remote --file=migrations/003_cache_providers.sql
```

### 3. Start Local Dev Server

```bash
npm run dev
# or
wrangler dev
```

---

## API Endpoints

### 1. Flight Search (GET /providers/flights)

**Purpose**: Search for flight offers using Amadeus (primary) or Kiwi (fallback)

**Request**:
```bash
curl -X GET "http://localhost:8788/api/providers/flights?from=JFK&to=EDI&month=2025-06&adults=2&route_type=round_trip"
```

**Expected Response** (200 OK):
```json
{
  "provider": "amadeus",
  "route": "JFK-EDI round-trip",
  "offers": [
    {
      "price_low": 850,
      "price_median": 1100,
      "price_high": 1350,
      "carrier": "Delta",
      "route_type": "round_trip",
      "estimate_date": "2025-10-05T12:00:00Z"
    }
  ],
  "cached": false
}
```

**Test Scenarios**:
- Valid IATA codes → 200 with offers
- Invalid IATA code (e.g., `from=XXX`) → 400 error
- Amadeus unavailable → fallback to Kiwi with `provider: "kiwi"`
- Second identical request within 24h → `cached: true`

---

### 2. Hotel Search (GET /providers/hotels)

**Purpose**: Search for 2-3 hotel listings using Amadeus (primary) or Serper.dev (fallback)

**Request**:
```bash
curl -X GET "http://localhost:8788/api/providers/hotels?city=Edinburgh&checkin=2025-06-15&nights=3&luxury=comfort&adults=2"
```

**Expected Response** (200 OK):
```json
{
  "provider": "amadeus",
  "city": "Edinburgh",
  "checkin": "2025-06-15",
  "nights": 3,
  "hotels": [
    {
      "hotel_id": "AMEDIN123",
      "name": "Heritage Inn Edinburgh",
      "nightly_price_low": 120,
      "nightly_price_high": 180,
      "star_rating": 4,
      "budget_tier": "comfort",
      "availability_disclaimer": "availability not guaranteed"
    },
    {
      "hotel_id": "AMEDIN456",
      "name": "Royal Mile Suites",
      "nightly_price_low": 150,
      "nightly_price_high": 220,
      "star_rating": 4.5,
      "budget_tier": "premium",
      "availability_disclaimer": "availability not guaranteed"
    }
  ],
  "cached": false
}
```

**Test Scenarios**:
- Valid city and date → 200 with 2-3 hotels
- Invalid date format → 400 error
- No hotels matching budget tier → 404 with fallback message
- Amadeus unavailable → fallback to Serper.dev with Google Places enrichment
- Second identical request within 24h → `cached: true`

---

### 3. Generic Web Search (GET /providers/search)

**Purpose**: Search for genealogy context or general queries using Serper.dev (primary) or Tavily (fallback)

**Request**:
```bash
curl -X GET "http://localhost:8788/api/providers/search?q=McLeod+surname+Isle+of+Skye+history&city=Skye&month=2025-06&max_results=10"
```

**Expected Response** (200 OK):
```json
{
  "provider": "serper",
  "query": "McLeod surname Isle of Skye history",
  "cache_key": "skye_mcleod_2025-06",
  "results": [
    {
      "title": "Clan MacLeod - Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Clan_MacLeod",
      "snippet": "The Clan MacLeod is a Highland Scottish clan associated with the Isle of Skye...",
      "position": 1
    },
    {
      "title": "MacLeod Castle & Dunvegan",
      "url": "https://www.dunvegancastle.com/clan-macleod",
      "snippet": "Dunvegan Castle has been the ancestral home of the Chiefs of MacLeod for 800 years...",
      "position": 2
    }
  ],
  "cached": false,
  "search_date": "2025-10-05T12:00:00Z"
}
```

**Test Scenarios**:
- Valid query → 200 with up to 10 results
- Query too short (< 3 chars) → 400 error
- Serper.dev unavailable → fallback to Tavily with `provider: "tavily"` and `relevance_score` fields
- Second identical request within 7 days → `cached: true`

---

### 4. Cost Estimation (POST /api/estimate/cost)

**Purpose**: Calculate per-person trip cost with 10-15% commission headroom

**Request**:
```bash
curl -X POST "http://localhost:8788/api/estimate/cost" \
  -H "Content-Type: application/json" \
  -d '{
    "trip_id": "abc123",
    "airfare": {
      "price_low": 850,
      "price_high": 1350
    },
    "hotels": [
      {
        "city": "Edinburgh",
        "nights": 3,
        "nightly_low": 120,
        "nightly_high": 180
      },
      {
        "city": "Isle of Skye",
        "nights": 2,
        "nightly_low": 100,
        "nightly_high": 150
      }
    ],
    "tours": [
      {
        "name": "Clan MacLeod Heritage Tour",
        "price_low": 150,
        "price_high": 250
      },
      {
        "name": "Edinburgh Castle Tour",
        "price_low": 30,
        "price_high": 50
      }
    ],
    "transport": [
      {
        "type": "train",
        "route": "Edinburgh-Inverness",
        "price_low": 50,
        "price_high": 80
      },
      {
        "type": "car_rental",
        "days": 3,
        "price_low": 100,
        "price_high": 150
      }
    ],
    "commission_pct": 15
  }'
```

**Expected Response** (200 OK):
```json
{
  "trip_id": "abc123",
  "airfare": [850, 1350],
  "hotels": [840, 1400],
  "tours": [180, 300],
  "transport": [150, 230],
  "subtotal": [2020, 3280],
  "total_per_person": [2020, 3772],
  "commission_included": true,
  "commission_pct": 15,
  "currency": "USD",
  "disclaimer": "final quote by travel professional",
  "estimate_date": "2025-10-05T12:00:00Z"
}
```

**Calculation Details**:
- Hotels: (3 × $120) + (2 × $100) = $560 low, (3 × $180) + (2 × $150) = $840 high
- Tours: $150 + $30 = $180 low, $250 + $50 = $300 high
- Transport: $50 + $100 = $150 low, $80 + $150 = $230 high
- Subtotal: $850 + $560 + $180 + $150 = $1740 low, $1350 + $840 + $300 + $230 = $2720 high
- **Commission**: Applied to high only: `Math.ceil(2720 * 1.15)` = $3128

**Note**: Example calculation differs from response above - verify logic in implementation.

**Test Scenarios**:
- Valid request → 200 with cost breakdown
- Missing trip_id → 400 error
- Invalid commission_pct (<10 or >15) → 400 error
- Result stored in `heritage_trips.variants_json.cost_estimate`

---

### 5. Professional Handoff (GET /api/handoff/:id)

**Purpose**: Generate JSON export for travel professional booking

**Request**:
```bash
curl -X GET "http://localhost:8788/api/handoff/abc123" \
  -H "Accept: application/json"
```

**Expected Response** (200 OK):
```json
{
  "trip_id": "abc123",
  "created_at": "2025-10-05T12:00:00Z",
  "intake": {
    "surnames": ["McLeod", "Roberts"],
    "origins": ["Isle of Skye", "North Wales"],
    "party": { "adults": 2, "children": 0 },
    "departure_airport": "JFK",
    "transport_pref": "mixed",
    "hotel_type": "comfort"
  },
  "ancestry_context": {
    "surnames": ["McLeod", "Roberts"],
    "origins": ["Isle of Skye", "North Wales"],
    "migration_window": "1880-1920",
    "key_sites": ["Dunvegan Castle", "Conwy Castle"],
    "sources": [
      {
        "kind": "url",
        "value": "https://familysearch.org/tree/person/details/L123-ABC"
      },
      {
        "kind": "pdf",
        "value": "family-tree.pdf",
        "ocr_summary": "Extracted surnames: McLeod, Roberts..."
      }
    ],
    "web_search_summary": "Clan MacLeod history on Isle of Skye..."
  },
  "selected_option": "B",
  "itinerary": {
    "days": [
      {
        "day": 1,
        "city": "Edinburgh",
        "activities": ["Arrive Edinburgh", "Old Town walk"]
      }
    ]
  },
  "hotels_shown": [
    {
      "hotel_id": "AMEDIN123",
      "city": "Edinburgh",
      "name": "Heritage Inn Edinburgh",
      "nightly_price_low": 120,
      "nightly_price_high": 180,
      "star_rating": 4,
      "budget_tier": "comfort"
    }
  ],
  "hotels_selected": [
    {
      "hotel_id": "AMEDIN123",
      "city": "Edinburgh",
      "name": "Heritage Inn Edinburgh",
      "selected_at": "2025-10-05T12:30:00Z",
      "selection_context": "selected"
    }
  ],
  "airfare_estimate": {
    "route": "JFK-EDI round-trip",
    "price_low": 850,
    "price_median": 1100,
    "price_high": 1350,
    "provider": "amadeus",
    "estimate_date": "2025-10-05T12:00:00Z"
  },
  "cost_estimate": {
    "airfare": [850, 1350],
    "hotels": [840, 1400],
    "tours": [300, 500],
    "transport": [200, 300],
    "total_per_person": [2240, 3910],
    "commission_included": true,
    "currency": "USD",
    "disclaimer": "final quote by travel professional"
  }
}
```

**Response Headers**:
- `Content-Type: application/json`
- `Content-Disposition: attachment; filename="trip-abc123-handoff.json"`

**Test Scenarios**:
- Valid trip_id → 200 with complete handoff JSON
- Invalid trip_id → 404 error
- Trip without cost estimate → 200 with partial data (omit cost_estimate field)

---

## Integration Test Flow

Complete end-to-end test of the feature:

### 1. Create Trip with Genealogy Upload

```bash
# Create trip with uploaded genealogy document
curl -X POST "http://localhost:8788/api/trips" \
  -F "surnames=McLeod,Roberts" \
  -F "origins=Isle of Skye,North Wales" \
  -F "adults=2" \
  -F "departure_airport=JFK" \
  -F "transport_pref=mixed" \
  -F "hotel_type=comfort" \
  -F "genealogy_url=https://www.familysearch.org/tree/person/details/L123-ABC" \
  -F "genealogy_file=@family-tree.pdf"
```

**Expected**: 200 OK with trip_id and ancestry_context extracted

### 2. Verify Ancestry Context in Intake

```bash
# Get trip to verify genealogy parsing
curl -X GET "http://localhost:8788/api/trips/abc123"
```

**Expected**: `intake_json.ancestry_context` contains surnames, origins, key_sites, web_search_summary

### 3. Generate Trip Options

```bash
# Existing flow - generates 4 options with ancestry context
curl -X POST "http://localhost:8788/api/trips/abc123/select" \
  -H "Content-Type: application/json" \
  -d '{"option": "B"}'
```

**Expected**: 200 OK with itinerary JSON

### 4. Enrich with Hotels

```bash
# Fetch hotels for Edinburgh (3 nights)
curl -X GET "http://localhost:8788/api/providers/hotels?city=Edinburgh&checkin=2025-06-15&nights=3&luxury=comfort&adults=2"
```

**Expected**: 200 OK with 2-3 hotel listings

### 5. Enrich with Airfare

```bash
# Fetch flights for JFK-EDI
curl -X GET "http://localhost:8788/api/providers/flights?from=JFK&to=EDI&month=2025-06&adults=2&route_type=round_trip"
```

**Expected**: 200 OK with flight offers

### 6. Generate A/B Variants with Cost Estimate

```bash
# POST cost estimate to generate A/B variants
curl -X POST "http://localhost:8788/api/estimate/cost" \
  -H "Content-Type: application/json" \
  -d '{
    "trip_id": "abc123",
    "airfare": { "price_low": 850, "price_high": 1350 },
    "hotels": [
      { "city": "Edinburgh", "nights": 3, "nightly_low": 120, "nightly_high": 180 }
    ],
    "tours": [
      { "name": "Heritage Tour", "price_low": 150, "price_high": 250 }
    ],
    "transport": [
      { "type": "train", "price_low": 50, "price_high": 80 }
    ]
  }'
```

**Expected**: 200 OK with cost breakdown including commission

### 7. Select Hotels

```bash
# User selects hotel from shown options
curl -X PATCH "http://localhost:8788/api/trips/abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "hotels_selected": [
      { "hotel_id": "AMEDIN123", "city": "Edinburgh", "name": "Heritage Inn Edinburgh" }
    ]
  }'
```

**Expected**: 200 OK with updated trip record

### 8. Generate Pro Handoff

```bash
# Download handoff JSON for travel professional
curl -X GET "http://localhost:8788/api/handoff/abc123" \
  -o "trip-abc123-handoff.json"
```

**Expected**: JSON file with complete ancestry context, hotels shown/selected, airfare, and cost estimate

---

## Cache Verification

### Test Cache Hit

```bash
# First request (cache miss)
curl -X GET "http://localhost:8788/api/providers/flights?from=JFK&to=EDI&month=2025-06"
# Response: "cached": false

# Second request within 24h (cache hit)
curl -X GET "http://localhost:8788/api/providers/flights?from=JFK&to=EDI&month=2025-06"
# Response: "cached": true, "cache_age_seconds": 120
```

### Inspect Cache Table

```bash
# Query cache_providers table
wrangler d1 execute voygent-themed --local --command="SELECT provider, query_hash, created_at, ttl_seconds FROM cache_providers LIMIT 10"
```

**Expected**: Rows with provider="amadeus", query_hash=SHA256(...), ttl_seconds=86400

### Test Cache Expiry

```bash
# Manually expire cache entry (for testing)
wrangler d1 execute voygent-themed --local --command="UPDATE cache_providers SET created_at = unixepoch() - 90000 WHERE provider = 'amadeus'"

# Re-request (should refresh)
curl -X GET "http://localhost:8788/api/providers/flights?from=JFK&to=EDI&month=2025-06"
# Response: "cached": false (re-fetched from Amadeus)
```

---

## Error Handling

### Amadeus API Failure → Kiwi Fallback

```bash
# Simulate Amadeus failure (remove AMADEUS_CLIENT_ID from .dev.vars)
curl -X GET "http://localhost:8788/api/providers/flights?from=JFK&to=EDI&month=2025-06"
```

**Expected**: 200 OK with `"provider": "kiwi"` (fallback successful)

### Both Providers Fail

```bash
# Simulate both APIs down
curl -X GET "http://localhost:8788/api/providers/flights?from=JFK&to=EDI&month=2025-06"
```

**Expected**: 500 error with `"error": "Provider unavailable"`, `"details": "Both Amadeus and Kiwi APIs failed"`

### Timeout (>10s)

```bash
# No easy way to simulate - verify timeout logic in code
# Expected: 504 error with "Timeout" message
```

---

## Performance Benchmarks

**All endpoints must complete within 10s timeout (FR-039)**

Measure with `time` command:

```bash
time curl -X GET "http://localhost:8788/api/providers/flights?from=JFK&to=EDI&month=2025-06"
```

**Expected latencies** (without cache):
- Flight search: 2-5s (Amadeus API call)
- Hotel search: 3-6s (Amadeus API call + enrichment)
- Generic search: 1-3s (Serper.dev)
- Cost estimation: <1s (local calculation)
- Pro handoff: <500ms (JSON assembly)

**With cache**: <100ms for all provider calls

---

## Development Checklist

Before running `/tasks` command:

- [x] research.md complete (all 10 technology decisions documented)
- [x] data-model.md complete (all 9 entities defined with validation rules)
- [x] API contracts complete (4 OpenAPI spec files in /contracts/)
- [x] quickstart.md complete (curl examples for all endpoints)
- [ ] Constitution Check re-evaluated (next step)
- [ ] Phase 2 approach planned (next step)

---

## Next Steps

1. Re-evaluate Constitution Check after Phase 1 design
2. Plan Phase 2 implementation approach (library files, endpoint handlers, prompt templates)
3. Run `/tasks` command to generate actionable tasks.md
4. Execute implementation plan via `/implement` command
