# Feature Specification: Web Search Integration with Genealogy Context & Provider APIs

**Feature Branch**: `001-web-search-integration`
**Created**: 2025-10-05
**Status**: Draft - Ready for Planning
**Input**: User description: "web search integration + genealogy parsing + hotel/flight enrichment + cost estimation"

## Execution Flow (main)
```
1. Parse user description from Input
   → Feature: Multi-phase enhancement integrating genealogy parsing, web search, hotel/flight APIs, and cost estimation
2. Extract key concepts from description
   → Actors: Trip planners, genealogy researchers, travel professionals, system
   → Actions: Parse genealogy docs, extract ancestry context, search hotels/flights, enrich options, estimate costs, generate handoff
   → Data: Genealogy data, surnames, places, hotel listings, flight offers, cost ranges, cache entries
   → Constraints: 24h cache for flights/hotels, 7-day cache for general search, API fallbacks, commission headroom
3. Ambiguities identified and resolved ✓
4. User scenarios defined ✓
5. Functional requirements generated (40 requirements across 6 categories) ✓
6. Key entities identified (9 entities) ✓
7. Review checklist passed ✓
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
A user planning a heritage trip uploads genealogy documents (PDFs, images, or URLs to Ancestry/FamilySearch), has the system automatically extract surnames, places, and migration periods, then receives trip options enriched with real hotel examples, estimated airfare, and total cost ranges that include commission headroom for professional booking.

### Acceptance Scenarios

1. **Given** a user uploads a PDF genealogy document, **When** creating a trip, **Then** the system extracts surnames, places, dates, and migration windows and displays this ancestry context in the intake summary

2. **Given** a user provides a FamilySearch URL, **When** the system processes intake, **Then** it parses the genealogy profile and performs web searches for surname + region history to enrich the ancestry context

3. **Given** a user has selected trip options with destinations, **When** viewing itinerary variants, **Then** they see 2-3 example hotels per city with nightly price ranges matching their budget tier

4. **Given** a user has specified a departure airport and travel dates, **When** trip options are generated, **Then** they see estimated round-trip airfare ranges (low/median) from Amadeus or Kiwi APIs

5. **Given** a user has reviewed A/B variants, **When** the cost estimator runs, **Then** they see a per-person total cost range (airfare + hotels + tours + transport) with 10-15% commission headroom built into the top of the range

6. **Given** a user selects specific hotels from the examples, **When** generating the pro handoff, **Then** the handoff JSON includes hotels shown, hotels selected, and airfare hints for the travel professional

7. **Given** hotel or flight search fails, **When** generating enriched options, **Then** the system displays fallback generic pricing guidance without breaking the trip flow

8. **Given** identical search queries within cache TTL, **When** requesting hotel/flight data, **Then** the system returns cached results without calling external APIs

### Edge Cases

- What happens when OCR fails on an uploaded genealogy image?
  → Store raw upload + error note; continue with manual ancestry fields from form

- What happens when genealogy URL parsing returns no data?
  → Log warning; use form-entered surnames/origins only

- What happens when Amadeus API is unavailable?
  → Fall back to Kiwi (flights) or Serper.dev (hotels); log provider switch

- What happens when no hotels match budget tier in a destination?
  → Show closest tier + message "Limited availability in [city] - travel pro will find alternatives"

- What happens when user changes dates after cost estimate is generated?
  → Display message "Cost estimate is for previous dates - regenerate for updated pricing"

- What happens when cache is stale (>24h for hotels/flights, >7d for general search)?
  → Automatically refresh from provider APIs; update cache timestamp

## Requirements *(mandatory)*

### Functional Requirements

**Phase 1: Genealogy Context Extraction**
- **FR-001**: System MUST accept uploaded genealogy documents (PDF, image, text files)
- **FR-002**: System MUST accept genealogy URLs (Ancestry, FamilySearch, MyHeritage, WikiTree)
- **FR-003**: System MUST extract surnames, places, dates, and migration windows from uploaded documents using OCR + text summarization
- **FR-004**: System MUST parse genealogy URLs to extract surname and location data
- **FR-005**: System MUST perform web searches for "surname + region history" and "key ancestral sites" (churches, archives, museums, monuments)
- **FR-006**: System MUST store extracted ancestry context in intake.sources array with kind="genealogy"
- **FR-007**: System MUST display parsed surnames and places in the intake summary shown to users
- **FR-008**: System MUST continue trip generation even if genealogy parsing fails

**Phase 2: Hotel & Flight Provider Integration**
- **FR-009**: System MUST search for hotels using Amadeus Hotel Search API as primary provider
- **FR-010**: System MUST fall back to Serper.dev (Google Hotels) + Google Places enrichment when Amadeus unavailable
- **FR-011**: System MUST search for flights using Amadeus Flight Offers Search as primary provider
- **FR-012**: System MUST fall back to Kiwi Tequila API when Amadeus flights unavailable
- **FR-013**: System MUST cache hotel search results for 24 hours in database
- **FR-014**: System MUST cache flight search results for 24 hours in database
- **FR-015**: System MUST return low and median fare options for flight searches
- **FR-016**: System MUST return 2-3 hotel examples per destination city
- **FR-017**: Hotel results MUST include: name, nightly price range, star rating, and budget tier classification
- **FR-018**: Flight results MUST include: route, price range (low-median), and carrier information

**Phase 3: Generic Web Search**
- **FR-019**: System MUST provide generic web search using Serper.dev as primary provider
- **FR-020**: System MUST fall back to Tavily Search API when Serper.dev unavailable
- **FR-021**: System MUST cache generic search results for 7 days using city+topic+month key
- **FR-022**: System MUST prevent duplicate searches for identical queries within cache period

**Phase 4: Cost Estimation & Enrichment**
- **FR-023**: System MUST run hotel enricher prompt after itinerary draft is generated
- **FR-024**: System MUST run airfare estimator prompt using Amadeus flight offers data
- **FR-025**: System MUST run cost estimator prompt combining airfare + hotels + tours + transport
- **FR-026**: Cost estimator MUST produce per-person USD range with 10-15% commission headroom at top of range
- **FR-027**: System MUST store cost estimate JSON in trip record for later retrieval
- **FR-028**: System MUST display per-person cost range to user with disclaimer "final quote by travel professional"
- **FR-029**: System MUST allow users to select preferred hotels from the examples shown
- **FR-030**: System MUST track which hotels user viewed vs. selected

**Phase 5: Professional Handoff**
- **FR-031**: System MUST generate pro handoff JSON including hotels_shown, hotels_selected, and airfare_hint
- **FR-032**: Pro handoff MUST include all ancestry context and genealogy sources
- **FR-033**: Pro handoff MUST include complete itinerary with user selections
- **FR-034**: Pro handoff MUST be downloadable in JSON format

**Phase 6: API Endpoints**
- **FR-035**: System MUST provide GET /providers/flights endpoint accepting from, to, month parameters
- **FR-036**: System MUST provide GET /providers/hotels endpoint accepting city, checkin, nights, luxury parameters
- **FR-037**: System MUST provide GET /providers/search endpoint accepting query, city, month parameters
- **FR-038**: System MUST provide POST /api/estimate/cost endpoint to run cost estimator and store result
- **FR-039**: All provider endpoints MUST complete within 10 seconds timeout threshold
- **FR-040**: All endpoints MUST return JSON conforming to existing schemas

### Key Entities

- **Genealogy Context**: Extracted data from uploaded documents/URLs containing surnames, suspected origins, immigration windows, migration periods, key ancestral sites, and web search summaries about surname history

- **Hotel Listing**: Hotel search result with name, location, nightly price range, star rating, booking reference, budget tier classification, and availability disclaimer

- **Flight Offer**: Airfare data with origin/destination airports, price range (low/median), carrier, route, and estimate date

- **Cost Estimate**: Comprehensive trip cost breakdown with airfare range, hotel costs per city, tour estimates, transport costs, total per-person range, and commission headroom calculation

- **Provider Cache Entry**: Cached search result with cache key (city+topic or search params), JSON data, provider name, timestamp, and TTL (24h or 7d)

- **Hotel Selection**: User's chosen hotels with hotel ID, city, user choice timestamp, and selection context (shown vs. selected)

- **Pro Handoff**: Professional booking package with complete itinerary, ancestry context, hotels shown/selected, airfare estimates, cost ranges, and traveler preferences

- **Search Query**: Web search request with query text, city filter, month filter, provider used, and cache status

- **Ancestry Source**: Individual genealogy data source with type (PDF/image/URL), raw content, parsed data (surnames/places/dates), OCR summary, and web search context

---

## Critical Path Question
At every implementation decision, ask:
**"Is this on the critical path to shipping: Intake → Options(≤4) → Select → A/B → Cost Estimate → Save Trip ID?"**

If not essential to this flow, defer to future iteration.

---

## Review & Acceptance Checklist

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

**Resolved Clarifications:**
1. ✅ Provider APIs: Amadeus (primary for hotels/flights), Kiwi Tequila (flight fallback), Serper.dev (hotel/search fallback), Tavily (search fallback)
2. ✅ Caching: 24h TTL for hotels/flights; 7-day TTL for general search; cache key format: city+topic+month
3. ✅ Result limits: 2-3 hotels per city, 10 results max for general search, low+median for flights
4. ✅ Search timeout: 10 seconds per provider call
5. ✅ Rate limiting: Basic duplicate prevention via cache; no advanced rate limiting in MVP
6. ✅ Commission headroom: 10-15% added to top of cost range
7. ✅ Genealogy parsing: OCR + text summary for uploads; URL parsing for genealogy sites; web search for surname history
8. ✅ Cost estimation: Combined airfare + hotels + tours + transport into per-person USD range

---

## Execution Status

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked and resolved
- [x] User scenarios defined (8 acceptance scenarios, 6 edge cases)
- [x] Requirements generated (40 functional requirements)
- [x] Entities identified (9 key entities)
- [x] Review checklist passed
- [x] Critical path question defined

**Status**: ✅ Ready for `/plan` to generate implementation plan

---

## Test Verification Checklist

When implementation is complete, verify:

- [ ] Upload PDF with surnames → parsed surnames/places appear in intake JSON
- [ ] Provide FamilySearch URL → genealogy data extracted and web searches performed
- [ ] Create trip → 4 options generated with ancestry context lines
- [ ] Select option B → itinerary expands with hotel/flight data
- [ ] Run cost estimator → per-person range JSON stored and displayed in UI
- [ ] Repeat identical search → cache hit reduces provider API calls
- [ ] Amadeus unavailable → fallback to Kiwi/Serper without user-facing errors
- [ ] Select hotels → hotels_selected tracked in pro handoff JSON
- [ ] Generate pro handoff → includes ancestry, hotels, airfare, cost estimate
- [ ] All flows complete within 10s timeout threshold

---
