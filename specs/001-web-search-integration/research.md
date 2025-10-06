# Research: Web Search Integration with Genealogy Context & Provider APIs

**Feature**: 001-web-search-integration
**Date**: 2025-10-05
**Status**: Complete

## 1. Amadeus Self-Service API

**Decision**: Use Amadeus Flight Offers Search + Hotel Search APIs as primary providers

**Rationale**:
- Industry-standard GDS access with real-time pricing
- Self-service tier available (no contract required)
- REST API with OAuth2 authentication
- Rate limit: 10 requests/second (sufficient for MVP)
- Returns low/median/high fare brackets
- Hotel search supports budget tier filtering

**Implementation Notes**:
- Auth: OAuth2 client credentials flow
- Endpoint: `POST /v1/security/oauth2/token` (cache token for 30min)
- Flights: `GET /v2/shopping/flight-offers` with origin/destination/departureDate
- Hotels: `GET /v3/shopping/hotel-offers` with cityCode/checkInDate/adults
- Response includes price, carrier, booking class, availability

**Alternatives Considered**:
- Skyscanner API (deprecated, no longer public)
- Google Flights API (no official API, scraping unreliable)
- Expedia TAAP (requires travel agent credentials, not self-service)

**References**:
- https://developers.amadeus.com/self-service/category/flights
- https://developers.amadeus.com/self-service/category/hotels

---

## 2. Kiwi Tequila API

**Decision**: Use as fallback for flight search when Amadeus unavailable

**Rationale**:
- Free tier: 100 requests/day (sufficient for MVP fallback)
- Aggregates budget airlines not in traditional GDS
- Simple REST API, no OAuth (API key in header)
- Returns price ranges and multi-city routes
- Good for European heritage destinations

**Implementation Notes**:
- Auth: `apikey` header
- Endpoint: `GET /v2/search` with fly_from/fly_to/date_from/date_to
- Response: List of flights with price, airlines, routes
- Cache for 24h to reduce free tier usage

**Alternatives Considered**:
- Aviationstack (no pricing data, just schedules)
- FlightAware (flight tracking, not booking/pricing)

**References**:
- https://tequila.kiwi.com/portal/docs/tequila_api

---

## 3. Serper.dev Google Hotels Search

**Decision**: Use for hotel search fallback when Amadeus unavailable

**Rationale**:
- Google Hotels results via API (no scraping)
- Free tier: 2,500 searches/month
- Returns price ranges, ratings, booking links
- Good coverage for heritage destinations (churches, B&Bs, etc.)
- Simple REST API with API key auth

**Implementation Notes**:
- Auth: `X-API-KEY` header
- Endpoint: `POST /search` with `q="hotels in [city]"` and `gl=us`
- Response: Organic results with hotel cards (name, price, rating, link)
- Extract nightly price from `price_per_night` field
- Cache for 24h

**Alternatives Considered**:
- Direct Booking.com API (requires partnership, not self-service)
- Hotels.com API (deprecated)

**References**:
- https://serper.dev/playground

---

## 4. Google Places API

**Decision**: Use for hotel enrichment (ratings, photos, reviews) when needed

**Rationale**:
- Enriches Serper.dev results with Place IDs
- $5 per 1000 requests (Basic Data)
- Provides star ratings, user ratings, photos, opening hours
- Good for heritage B&Bs and small hotels not in Amadeus

**Implementation Notes**:
- Auth: API key in URL `key=`
- Endpoint: `GET /place/findplacefromtext/json?input=[hotel name]&inputtype=textquery`
- Then: `GET /place/details/json?place_id=[id]&fields=rating,photos,price_level`
- Use sparingly (only when Serper lacks data)

**Alternatives Considered**:
- Yelp Fusion API (limited international coverage)
- Foursquare Places (deprecated)

**References**:
- https://developers.google.com/maps/documentation/places/web-service

---

## 5. Tavily Search API

**Decision**: Use as fallback for general web search when Serper.dev unavailable

**Rationale**:
- AI-optimized search API (returns clean, structured data)
- Free tier: 1,000 requests/month
- Better than raw Google Search for genealogy context
- Returns snippets, URLs, relevance scores
- Good for "surname + region history" queries

**Implementation Notes**:
- Auth: `api_key` in request body
- Endpoint: `POST /search` with `query` and optional `search_depth`
- Response: List of results with content, URL, relevance
- Cache for 7 days (surname history doesn't change)

**Alternatives Considered**:
- Brave Search API (5,000/month free, but less AI-optimized)
- Bing Web Search API (paid only, $5/1000 queries)

**References**:
- https://tavily.com/

---

## 6. D1 Cache Patterns

**Decision**: Single `cache_providers` table with composite key (provider+query_hash) and TTL

**Rationale**:
- D1 SQLite supports fast lookups on indexed text columns
- TTL enforced via `created_at + ttl_seconds < unixepoch()` query
- Composite key prevents collisions between providers
- JSON blob storage keeps schema flexible

**Implementation**:
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

**Cache Invalidation**:
- Background cleanup: DELETE WHERE created_at + ttl_seconds < unixepoch()
- Run daily via Cloudflare Cron Trigger

**Alternatives Considered**:
- Cloudflare KV (2x cost, eventual consistency issues)
- Separate tables per provider (schema overhead, harder to query)

---

## 7. Genealogy URL Parsing

**Decision**: Use regex patterns + fallback web scraping for supported sites

**Rationale**:
- Ancestry, FamilySearch, MyHeritage, WikiTree have predictable URL patterns
- Extract person IDs from URLs, fetch public profile data
- FamilySearch has public API (no auth for public profiles)
- Others require web fetch + HTML parsing (cheerio-like)

**Implementation Approach**:
1. **FamilySearch**: `https://www.familysearch.org/tree/person/details/[ID]`
   - Use FamilySearch API: `GET /platform/tree/persons/[ID]`
   - Extract names, birth/death places, parents
2. **Ancestry**: `https://www.ancestry.com/family-tree/person/tree/[TREE_ID]/person/[PERSON_ID]`
   - Web fetch (requires cookie/session, skip for MVP)
   - Fallback: Prompt user to copy-paste data
3. **MyHeritage**: Similar to Ancestry (skip for MVP)
4. **WikiTree**: `https://www.wikitree.com/wiki/[PROFILE_ID]`
   - Use WikiTree API: `GET /api.php?action=getProfile&key=[ID]`
   - Public profiles, no auth required

**Alternatives Considered**:
- Browser automation (Puppeteer) - too heavy for edge runtime
- Paid genealogy APIs (FamilySearch is free, sufficient for MVP)

**MVP Scope**: Support FamilySearch + WikiTree URLs only; others show "Manual entry required"

---

## 8. OCR Alternatives for Cloudflare Workers

**Decision**: Use Cloudflare AI Workers (@cf/meta/llama-ocr) for MVP

**Rationale**:
- Native Cloudflare integration (no external API)
- Inference pricing: ~$0.01 per 1000 requests
- Supports common formats (JPEG, PNG, PDF)
- Good accuracy for typed documents (genealogy records)
- Runs at edge (low latency)

**Implementation**:
```typescript
const text = await env.AI.run('@cf/meta/llama-ocr', {
  image: imageArrayBuffer
});
```

**Fallback**: If OCR fails, store raw file + prompt user to manually enter surnames/places

**Alternatives Considered**:
- Tesseract.js (doesn't run in Workers, requires Node.js)
- Google Cloud Vision API ($1.50/1000 images, external dependency)
- AWS Textract (complex setup, overkill for simple documents)

**References**:
- https://developers.cloudflare.com/workers-ai/models/llama-ocr/

---

## 9. Commission Headroom Calculation

**Decision**: Add 10-15% to top of cost range using `Math.ceil(maxCost * 1.15)`

**Rationale**:
- Industry standard: 10-15% commission on heritage/custom trips
- Applied to TOP of range only (not minimum)
- Keeps estimates transparent (user sees range, pro gets wiggle room)
- Formula: `[lowEstimate, Math.ceil(highEstimate * 1.15)]`

**Example**:
```
Airfare: $900-1200
Hotels (7 nights): $840-1400 (7 × $120-200/night)
Tours: $300-500
Transport: $200-300
---
Subtotal: $2240-3400
With 15% headroom: $2240-3910
Display: "$2,240-$3,910 per person (final quote by travel pro)"
```

**Alternatives Considered**:
- Fixed percentage across range (hides commission, less transparent)
- Separate commission field (confusing for users)

---

## 10. Pro Handoff JSON Format

**Decision**: Extend existing trip schema with new fields

**Schema**:
```json
{
  "tripId": "abc123",
  "createdAt": "2025-10-05T12:00:00Z",
  "intake": { /* existing intake.v1 */ },
  "ancestry_context": {
    "surnames": ["McLeod", "Roberts"],
    "origins": ["Isle of Skye", "North Wales"],
    "migration_window": "1880-1920",
    "key_sites": ["Dunvegan Castle", "Conwy Castle"],
    "sources": [
      {"kind": "url", "value": "https://familysearch.org/..."},
      {"kind": "file", "value": "family-tree.pdf", "ocr_summary": "..."}
    ]
  },
  "selected_option": "B",
  "itinerary": { /* existing itinerary.v1 */ },
  "hotels_shown": [
    {"city": "Edinburgh", "name": "Heritage Inn", "price": "$150-180/night", "rating": 4.2},
    ...
  ],
  "hotels_selected": [
    {"city": "Edinburgh", "hotelId": "h123", "name": "Heritage Inn"}
  ],
  "airfare_estimate": {
    "route": "JFK-EDI round-trip",
    "low": 850,
    "median": 1100,
    "high": 1350,
    "provider": "amadeus"
  },
  "cost_estimate": {
    "airfare": [850, 1350],
    "hotels": [840, 1400],
    "tours": [300, 500],
    "transport": [200, 300],
    "total_per_person": [2240, 3910],
    "commission_included": true
  }
}
```

**Delivery**: `GET /api/handoff/:id` returns this JSON with Content-Disposition: attachment

**Alternatives Considered**:
- PDF generation (overkill, pro wants structured data)
- Email integration (not in scope for MVP)

---

## Summary

All research tasks complete. Key decisions:
- **Flights**: Amadeus primary → Kiwi fallback
- **Hotels**: Amadeus primary → Serper.dev + Google Places fallback
- **Search**: Serper.dev primary → Tavily fallback
- **Cache**: D1 table with 24h/7d TTL
- **OCR**: Cloudflare AI Workers (@cf/meta/llama-ocr)
- **Genealogy**: FamilySearch + WikiTree APIs (MVP scope)
- **Commission**: 10-15% on top of cost range
- **Handoff**: JSON extension of existing trip schema

No blockers. Ready for Phase 1 (Design & Contracts).
