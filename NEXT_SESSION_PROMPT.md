# Continue Web Search Integration - Trip Flow & Frontend

## Context
We've successfully implemented the backend for web search integration in the heritage travel MVP. The following components are complete and tested:

### ✅ Completed (Working & Tested)
1. **Genealogy Support** (T023-T028, T033)
   - ✅ Cloudflare AI Workers OCR integration (`functions/api/lib/ocr.ts`)
   - ✅ Genealogy URL parsers for FamilySearch & WikiTree (`functions/api/lib/genealogy.ts`)
   - ✅ Trip intake endpoint enhanced with genealogy context (`functions/api/trips/index.ts`)
   - ✅ Web search integration for surname history (Serper → Tavily fallback)

2. **Provider API Endpoints** (All Working with Production Credentials)
   - ✅ `/api/providers/search` - Web search (Serper.dev, 7-day cache)
   - ✅ `/api/providers/hotels` - Hotel search (Amadeus → Serper fallback, 24h cache)
   - ✅ `/api/providers/flights` - Flight search (Amadeus production API, 24h cache)
   - ✅ Caching system with SHA-256 hashing and TTL enforcement

3. **Infrastructure**
   - ✅ Database migration 003 (cache_providers table)
   - ✅ Production Amadeus credentials configured (voygentAI app)
   - ✅ Server running at http://localhost:8788
   - ✅ All environment variables in `.dev.vars`

### 📋 Next Tasks - Trip Flow Integration (T034-T036)

**T034: Enhance /api/trips/[trip_id]/options/[option_id] (Hotel Integration)**
- File: `functions/api/trips/[trip_id]/options/[option_id].ts`
- After LLM generates city options, call `/api/providers/hotels` for each city
- Add hotel data to option response
- Schema: Add `hotels` array to option JSON

**T035: Create /api/trips/[trip_id]/variants endpoint (A/B Flight Variants)**
- File: `functions/api/trips/[trip_id]/variants.ts` (create new)
- Takes trip_id, returns A/B variants with flight pricing
- Calls `/api/providers/flights` for each variant
- Response format:
  ```json
  {
    "trip_id": "xxx",
    "variants": [
      {
        "variant_id": "A",
        "cities": ["Edinburgh", "Inverness"],
        "flights": { "price_low": 800, "price_high": 1200, "carrier": "VS" },
        "total_estimate": 3500
      },
      {
        "variant_id": "B",
        "cities": ["Glasgow", "Isle of Skye"],
        "flights": { "price_low": 750, "price_high": 1100, "carrier": "AF" },
        "total_estimate": 3200
      }
    ]
  }
  ```

**T036: Update PATCH /api/trips/[trip_id]/options/[option_id] (Track Hotel Selection)**
- When user selects hotels from option, store in `selected_hotels` field
- Update trip JSON with hotel selection
- Trigger cost estimation update

### 📋 Next Tasks - Frontend Updates (T039-T041)

**T039: Add Hotel Selection UI to Options Page**
- File: `public/options.html` or component
- Display hotels returned from T034
- Allow user to select preferred hotels
- Send selection via PATCH endpoint (T036)

**T040: Display Cost Estimates with Disclaimer**
- Show price ranges from flight/hotel providers
- Display: "Estimated cost: $3,200 - $4,500 (final quote by travel professional)"
- Add commission calculation display (10-15% on top of range)

**T041: Fetch and Display Provider Data in UI**
- Wire up frontend to call provider endpoints
- Display real-time flight/hotel availability
- Show loading states during API calls
- Handle errors gracefully (show Serper fallback when Amadeus fails)

## Current Server Status
- 🟢 Running: http://localhost:8788 (wrangler pages dev)
- 🟢 Database: voygent-prod (local D1)
- 🟢 Amadeus: Production API working
- 🟢 Serper: Fallback provider working
- 🟢 Caching: Active with TTL

## Key Files Reference
- Trip intake: `functions/api/trips/index.ts`
- Options endpoint: `functions/api/trips/[trip_id]/options/[option_id].ts`
- Flight provider: `functions/api/lib/amadeus.ts`
- Hotel search: `functions/api/providers/hotels.ts`
- Web search: `functions/api/providers/search.ts`
- Cache system: `functions/api/lib/cache.ts`

## Environment Variables (Already Configured)
```bash
AMADEUS_CLIENT_ID=1AYlKuTlt2KsnzaerfGxdZ6yptke0Kcl
AMADEUS_CLIENT_SECRET=aH4TZ5J36egxmw9s
AMADEUS_API_URL=https://api.amadeus.com
SERPER_API_KEY=e516748cdf9a43ec8b57039c30d62ef940b205e3
TAVILY_API_KEY=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
```

## Testing Commands
```bash
# Test web search
curl "http://localhost:8788/api/providers/search?q=Roberts+surname+Wales+history&max_results=5"

# Test hotel search
curl "http://localhost:8788/api/providers/hotels?city=Edinburgh&checkin=2026-03-16&nights=3&luxury=comfort"

# Test flight search
curl "http://localhost:8788/api/providers/flights?from=MOB&to=INV&month=2026-03&adults=2"
```

## Notes
- Amadeus Flight Offers Search returns codeshare flights (Virgin Atlantic for MOB routes)
- Prices are accurate but may not be the absolute cheapest (need Kiwi API for budget airlines)
- Serper fallback is working perfectly for hotels when Amadeus fails
- Caching is reducing API calls and costs significantly

## Start Here
1. Review the completed work in `IMPLEMENTATION_STATUS.md`
2. Read the test results in `TEST_RESULTS.md` and `READY_TO_TEST.md`
3. Implement T034 (hotel integration in options endpoint)
4. Then proceed with T035 (A/B variants with flights)
5. Finally implement T036 (hotel selection tracking)
6. Wire up frontend (T039-T041) after backend is complete

**Priority**: Backend integration (T034-T036) before frontend work.
