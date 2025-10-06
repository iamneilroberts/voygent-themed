# Data Model: Web Search Integration with Genealogy Context & Provider APIs

**Feature**: 001-web-search-integration | **Date**: 2025-10-05
**Input**: Key entities from [spec.md](./spec.md)

## Entity Definitions

### 1. Genealogy Context
**Purpose**: Extracted ancestry data from uploaded documents/URLs used to enrich trip planning

**Fields**:
- `surnames`: string[] - Family surnames (e.g., ["McLeod", "Roberts"])
- `origins`: string[] - Suspected ancestral origins (e.g., ["Isle of Skye", "North Wales"])
- `migration_window`: string - Immigration period (e.g., "1880-1920")
- `key_sites`: string[] - Important ancestral locations (e.g., ["Dunvegan Castle", "Conwy Castle"])
- `sources`: AncestrySource[] - Original data sources
- `web_search_summary`: string - Summary of surname + region history research

**Relationships**:
- Embedded in `heritage_trips.intake_json.ancestry_context`
- References multiple AncestrySource entities

**Validation Rules**:
- At least one surname or origin required (FR-006, FR-007)
- Sources array must contain at least one entry if genealogy data present
- Migration window format: YYYY-YYYY or "unknown"

**State Transitions**: N/A (static data after extraction)

---

### 2. Ancestry Source
**Purpose**: Individual genealogy data source with parsing metadata

**Fields**:
- `kind`: enum - Source type: "url" | "pdf" | "image" | "text"
- `value`: string - URL or filename
- `raw_content`: string (optional) - Original uploaded text/OCR output
- `parsed_data`: object - Structured extraction (surnames, places, dates)
- `ocr_summary`: string (optional) - OCR processing notes
- `web_search_context`: string (optional) - Related web search findings

**Relationships**:
- Child of Genealogy Context

**Validation Rules**:
- `kind` must be one of allowed enum values (FR-002, FR-003)
- `value` required for all kinds
- `ocr_summary` required when kind="image" or kind="pdf" (FR-003)
- Continue trip generation even if parsing fails (FR-008)

**State Transitions**: N/A

---

### 3. Hotel Listing
**Purpose**: Hotel search result with pricing and availability metadata

**Fields**:
- `hotel_id`: string - Provider's hotel identifier
- `name`: string - Hotel name
- `city`: string - Location city
- `nightly_price_low`: number - Minimum nightly rate (USD)
- `nightly_price_high`: number - Maximum nightly rate (USD)
- `star_rating`: number (optional) - 1-5 star rating
- `budget_tier`: enum - "budget" | "comfort" | "premium" | "luxury"
- `provider`: string - "amadeus" | "serper" | "google_places"
- `booking_reference`: string (optional) - External booking link
- `availability_disclaimer`: string - Default: "availability not guaranteed"

**Relationships**:
- Stored in `heritage_trips.itinerary_json.hotels_shown[]`
- Referenced by Hotel Selection entities

**Validation Rules**:
- 2-3 hotels per destination city (FR-016)
- `nightly_price_low` < `nightly_price_high`
- `budget_tier` must match user's luxury preference from intake (FR-017)
- All hotel results include disclaimer (FR-050 from constitution check)

**State Transitions**: N/A (static results from provider)

---

### 4. Flight Offer
**Purpose**: Airfare pricing data from provider APIs

**Fields**:
- `route`: string - Format: "JFK-EDI round-trip"
- `origin_iata`: string - 3-letter airport code
- `destination_iata`: string - 3-letter airport code
- `price_low`: number - Low fare estimate (USD)
- `price_median`: number - Median fare estimate (USD)
- `price_high`: number (optional) - High fare estimate (USD)
- `carrier`: string (optional) - Airline name
- `provider`: string - "amadeus" | "kiwi"
- `estimate_date`: string - ISO 8601 timestamp of estimate
- `route_type`: enum - "round_trip" | "one_way" | "multi_city"

**Relationships**:
- Stored in `heritage_trips.variants_json.airfare_estimate`

**Validation Rules**:
- Must return low and median fare options (FR-015, FR-018)
- `price_low` < `price_median` < `price_high` (if present)
- `estimate_date` used for cache invalidation (24h TTL, FR-014)
- Results displayed as ranges, not exact prices (constitution check)

**State Transitions**: N/A (static estimate)

---

### 5. Cost Estimate
**Purpose**: Comprehensive trip cost breakdown with commission headroom

**Fields**:
- `airfare`: [number, number] - Range [low, high] in USD
- `hotels`: [number, number] - Total hotel costs across all nights
- `tours`: [number, number] - Estimated tour/activity costs
- `transport`: [number, number] - Ground transport estimate
- `total_per_person`: [number, number] - Grand total with commission
- `commission_included`: boolean - Always true
- `currency`: string - Default: "USD"
- `disclaimer`: string - Default: "final quote by travel professional"
- `estimate_date`: string - ISO 8601 timestamp

**Relationships**:
- Stored in `heritage_trips.variants_json.cost_estimate`

**Validation Rules**:
- Commission headroom 10-15% applied to top of range only (FR-026)
- Formula: `total_per_person[1] = Math.ceil(subtotal_high * 1.15)` (from research.md)
- All component ranges required (FR-025)
- Display disclaimer with cost (FR-028, FR-050)

**State Transitions**:
- Created after variant selection
- Invalidated if travel dates change (edge case from spec)

---

### 6. Provider Cache Entry
**Purpose**: Cached API responses with TTL enforcement

**Database Table**: `cache_providers`

**Fields**:
- `id`: TEXT PRIMARY KEY - UUID
- `provider`: TEXT - "amadeus" | "kiwi" | "serper" | "tavily"
- `query_hash`: TEXT - SHA-256 of normalized query params
- `query_params`: TEXT - JSON of original params for debugging
- `response_json`: TEXT - Cached API response
- `ttl_seconds`: INTEGER - 86400 (24h) or 604800 (7d)
- `created_at`: INTEGER - Unix epoch timestamp

**Indexes**:
- UNIQUE(provider, query_hash)
- INDEX idx_cache_lookup ON (provider, query_hash, created_at)

**Relationships**:
- Referenced by all provider API calls (flights, hotels, search)

**Validation Rules**:
- Cache hotels/flights for 24h (FR-013, FR-014)
- Cache general search for 7 days (FR-021)
- Prevent duplicate searches within TTL (FR-022)
- Background cleanup: DELETE WHERE created_at + ttl_seconds < unixepoch() (from research.md)

**State Transitions**:
- Created on first API call
- Served on cache hit
- Deleted after TTL expires (daily cron job)

---

### 7. Hotel Selection
**Purpose**: User's hotel choices for pro handoff

**Fields**:
- `hotel_id`: string - Reference to Hotel Listing
- `city`: string - Destination city
- `name`: string - Hotel name (denormalized for handoff)
- `selected_at`: string - ISO 8601 timestamp
- `selection_context`: enum - "shown" | "selected"

**Relationships**:
- Child of `heritage_trips.variants_json.hotels_selected[]`
- References Hotel Listing by hotel_id

**Validation Rules**:
- Track both shown and selected hotels (FR-029, FR-030)
- `selection_context="shown"` for all displayed hotels
- `selection_context="selected"` for user-chosen hotels only

**State Transitions**:
- "shown" → "selected" when user clicks selection button

---

### 8. Pro Handoff
**Purpose**: Professional booking package JSON export

**Fields**:
- `trip_id`: string - Reference to heritage_trips.id
- `created_at`: string - ISO 8601 timestamp
- `intake`: object - Full intake.v1 JSON
- `ancestry_context`: Genealogy Context - Full genealogy data
- `selected_option`: string - Option key (A/B/C/D)
- `itinerary`: object - Full itinerary.v1 JSON
- `hotels_shown`: Hotel Listing[] - All displayed hotels
- `hotels_selected`: Hotel Selection[] - User-chosen hotels
- `airfare_estimate`: Flight Offer - Estimated airfare
- `cost_estimate`: Cost Estimate - Full cost breakdown
- `traveler_preferences`: object - Departure airport, transport, hotel type

**Relationships**:
- Generated from heritage_trips record
- Aggregates Genealogy Context, Hotel Listings, Hotel Selections, Flight Offer, Cost Estimate

**Validation Rules**:
- Include all ancestry context and sources (FR-032)
- Include complete itinerary with selections (FR-033)
- Downloadable as JSON (FR-034, GET /api/handoff/:id)
- Content-Disposition: attachment header

**State Transitions**:
- Generated on-demand via GET /api/handoff/:id
- Not stored, computed from trip record

---

### 9. Search Query
**Purpose**: Web search request for surname history or general context

**Fields**:
- `query`: string - Search text (e.g., "McLeod surname Isle of Skye history")
- `city`: string (optional) - City filter
- `month`: string (optional) - Month filter (YYYY-MM)
- `provider`: string - "serper" | "tavily"
- `cache_key`: string - Composite: city+topic+month (FR-021)
- `results`: object[] - Array of search results
- `cached`: boolean - Whether served from cache
- `search_date`: string - ISO 8601 timestamp

**Relationships**:
- Results stored in Provider Cache Entry
- Used by Genealogy Context extraction (FR-005)

**Validation Rules**:
- Serper.dev primary, Tavily fallback (FR-019, FR-020)
- 7-day cache TTL (FR-021)
- Maximum 10 results (from spec clarifications)
- Timeout: 10 seconds (FR-039)

**State Transitions**: N/A (stateless search)

---

## Database Schema Changes

### New Table: cache_providers
```sql
CREATE TABLE cache_providers (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,           -- 'amadeus', 'kiwi', 'serper', 'tavily'
  query_hash TEXT NOT NULL,         -- SHA-256 of normalized query params
  query_params TEXT NOT NULL,       -- JSON of original params for debugging
  response_json TEXT NOT NULL,      -- Cached API response
  ttl_seconds INTEGER NOT NULL,     -- 86400 (24h) or 604800 (7d)
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(provider, query_hash)
);
CREATE INDEX idx_cache_lookup ON cache_providers(provider, query_hash, created_at);
```

### Modified Table: heritage_trips
**New columns** (via JSON extensions in existing TEXT fields):
- `intake_json.ancestry_context`: Genealogy Context
- `intake_json.departure_airport`: string
- `intake_json.transport_pref`: enum
- `intake_json.hotel_type`: enum
- `itinerary_json.hotels_shown`: Hotel Listing[]
- `variants_json.airfare_estimate`: Flight Offer
- `variants_json.cost_estimate`: Cost Estimate
- `variants_json.hotels_selected`: Hotel Selection[]

**No new columns** - all extensions fit within existing JSON TEXT fields per Cloudflare D1 constraints.

---

## JSON Schema Mapping

### New Schemas (to be created in /schemas/)
1. **cost-estimate.v1.json**: Cost Estimate entity
2. **hotel-listing.v1.json**: Hotel Listing entity
3. **flight-offer.v1.json**: Flight Offer entity

### Modified Schemas
1. **intake.v1.json**: Add `ancestry_context`, `departure_airport`, `transport_pref`, `hotel_type`
2. **itinerary.v1.json**: Add `hotels_shown[]`
3. **variants.v1.json**: Add `airfare_estimate`, `cost_estimate`, `hotels_selected[]`

---

## Validation Summary

**Cross-Entity Constraints**:
- Hotel Listing budget_tier must match intake luxury preference
- Flight Offer estimate_date + 24h must be > current time (else re-fetch)
- Cost Estimate total_per_person[1] = Math.ceil(sum(component highs) * 1.15)
- Pro Handoff must include all fields from FR-031, FR-032, FR-033

**Cache Invalidation**:
- Provider Cache Entry: WHERE created_at + ttl_seconds < unixepoch()
- Cost Estimate: Invalidated when travel dates change (edge case)
- Flight Offer: Re-fetch when estimate_date + 86400 < unixepoch()

---

## Entity State Diagram

```
[Upload Genealogy] → [Ancestry Source (raw)]
                   ↓
              [OCR + Parse]
                   ↓
         [Genealogy Context (extracted)]
                   ↓
         [Embedded in intake_json]
                   ↓
    [Trip Options Generated (≤4)]
                   ↓
         [User Selects Option]
                   ↓
  [Hotel Enricher] → [Hotel Listing (shown)]
                   ↓
  [Airfare Estimator] → [Flight Offer]
                   ↓
         [A/B Variants Generated]
                   ↓
    [User Selects Hotels] → [Hotel Selection (selected)]
                   ↓
  [Cost Estimator] → [Cost Estimate (with commission)]
                   ↓
         [Save Trip ID]
                   ↓
  [Pro Handoff Generated (JSON export)]
```

---

## Critical Path Alignment

All entities support the critical path:
**Intake → Options(≤4) → Select → A/B → Cost Estimate → Save Trip ID**

- Genealogy Context: Enhances **Intake**
- Hotel Listing: Enriches **A/B variants**
- Flight Offer: Enriches **A/B variants**
- Cost Estimate: Required for **Save Trip ID**
- Provider Cache: Speeds all provider calls (off critical path for latency)
- Hotel Selection: Tracked for **Pro Handoff** (post-Save)
- Pro Handoff: Generated after **Save Trip ID** (not blocking)
- Search Query: Supports Genealogy Context extraction (on critical path)
- Ancestry Source: Input for Genealogy Context (on critical path)

✅ All entities validated against constitution principles.
