# Deployment Checklist: Web Search Integration

## Pre-Deployment Steps

### 1. Configure Environment Variables

Create/update `~/Documents/.env`:

```bash
# Required for Flight Search
AMADEUS_CLIENT_ID=your_amadeus_client_id
AMADEUS_CLIENT_SECRET=your_amadeus_client_secret
AMADEUS_API_URL=https://test.api.amadeus.com

# Required for Flight Fallback
KIWI_API_KEY=your_kiwi_api_key
KIWI_API_URL=https://api.tequila.kiwi.com

# Required for Hotel & Search
SERPER_API_KEY=your_serper_api_key
SERPER_API_URL=https://google.serper.dev

# Required for Search Fallback
TAVILY_API_KEY=your_tavily_api_key
TAVILY_API_URL=https://api.tavily.com

# Optional: For hotel enrichment
GOOGLE_PLACES_API_KEY=your_google_places_key

# Existing LLM keys
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
```

### 2. Update wrangler.toml

Add AI binding for OCR:

```toml
[[ai]]
binding = "AI"
```

### 3. Set Cloudflare Secrets

```bash
# Set secrets one by one (will prompt for value)
wrangler secret put AMADEUS_CLIENT_ID
wrangler secret put AMADEUS_CLIENT_SECRET
wrangler secret put KIWI_API_KEY
wrangler secret put SERPER_API_KEY
wrangler secret put TAVILY_API_KEY

# Optional
wrangler secret put GOOGLE_PLACES_API_KEY

# If not already set
wrangler secret put OPENAI_API_KEY
wrangler secret put ANTHROPIC_API_KEY
```

Or set from file:

```bash
echo "your_value" | wrangler secret put AMADEUS_CLIENT_ID
```

### 4. Verify Database Migration

```bash
# Check local database
wrangler d1 execute voygent-themed --local --command="SELECT name FROM sqlite_master WHERE type='table' AND name='cache_providers'"

# Check remote database
wrangler d1 execute voygent-themed --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name='cache_providers'"
```

Expected output: `{"name":"cache_providers"}`

## Deployment

### 1. Build Check

```bash
# Start local dev server
wrangler dev

# Test endpoints locally (in another terminal)
curl "http://localhost:8788/api/providers/flights?from=JFK&to=EDI&month=2025-06"
```

### 2. Deploy to Cloudflare Pages

```bash
wrangler pages deploy
```

Expected output:
```
✨ Success! Uploaded X files (Y.YY sec)
✨ Deployment complete! Take a peek over at https://voygent-heritage-mvp.pages.dev
```

### 3. Verify Deployment

```bash
# Test production endpoints
curl "https://voygent-heritage-mvp.pages.dev/api/providers/flights?from=JFK&to=EDI&month=2025-06"

curl "https://voygent-heritage-mvp.pages.dev/api/providers/hotels?city=Edinburgh&checkin=2025-06-15&nights=3"

curl "https://voygent-heritage-mvp.pages.dev/api/providers/search?q=McLeod+surname+history&max_results=5"
```

## Smoke Tests

### Test 1: Flight Search

```bash
curl "https://voygent-heritage-mvp.pages.dev/api/providers/flights?from=JFK&to=EDI&month=2025-06&adults=2"
```

**Expected**:
- Status: 200
- Response contains: `provider`, `route`, `offers` array with `price_low`, `price_median`
- `cached: false` (first request)

**Repeat same request**:
- `cached: true` (second request within 24h)
- `cache_age_seconds` present

### Test 2: Hotel Search

```bash
curl "https://voygent-heritage-mvp.pages.dev/api/providers/hotels?city=Edinburgh&checkin=2025-06-15&nights=3&luxury=comfort"
```

**Expected**:
- Status: 200
- Response contains: `provider`, `city`, `hotels` array (2-3 items)
- Each hotel has: `hotel_id`, `name`, `nightly_price_low`, `nightly_price_high`, `availability_disclaimer`

### Test 3: Web Search

```bash
curl "https://voygent-heritage-mvp.pages.dev/api/providers/search?q=McLeod+surname+Isle+of+Skye+history&max_results=5"
```

**Expected**:
- Status: 200
- Response contains: `provider`, `query`, `results` array
- Each result has: `title`, `url`, `snippet` or `relevance_score`

### Test 4: Cost Estimation

First, create a test trip to get a trip_id, then:

```bash
curl -X POST "https://voygent-heritage-mvp.pages.dev/api/estimate/cost" \
  -H "Content-Type: application/json" \
  -d '{
    "trip_id": "your-trip-id-here",
    "airfare": {"price_low": 850, "price_high": 1350},
    "hotels": [{"city": "Edinburgh", "nights": 3, "nightly_low": 120, "nightly_high": 180}],
    "tours": [{"name": "Heritage Tour", "price_low": 150, "price_high": 250}],
    "transport": [{"type": "train", "price_low": 50, "price_high": 80}],
    "commission_pct": 15
  }'
```

**Expected**:
- Status: 200
- Response contains: `airfare`, `hotels`, `tours`, `transport`, `total_per_person`
- `total_per_person[1]` = Math.ceil(subtotal_high * 1.15)
- `commission_included: true`
- `disclaimer: "final quote by travel professional"`

### Test 5: Genealogy Parsing

```bash
curl -X POST "https://voygent-heritage-mvp.pages.dev/api/trips" \
  -F "genealogy_url=https://www.familysearch.org/tree/person/details/KWCH-SMD" \
  -F "surnames=Test" \
  -F "adults=2" \
  -F "departure_airport=JFK"
```

**Expected**:
- Status: 200
- Response contains: `tripId`, `intake`, `options`
- `intake.ancestry_context` present with `surnames`, `origins`, etc.

### Test 6: Pro Handoff

```bash
curl "https://voygent-heritage-mvp.pages.dev/api/handoff/your-trip-id-here"
```

**Expected**:
- Status: 200
- Content-Disposition header: `attachment; filename="trip-xxx-handoff.json"`
- Response contains: `trip_id`, `intake`, `ancestry_context`, `itinerary`, `cost_estimate`

## Post-Deployment Verification

### 1. Check Cache Table

```bash
wrangler d1 execute voygent-themed --remote --command="SELECT COUNT(*) as count FROM cache_providers"
```

After running tests, should show cached entries.

### 2. Check Trip Records

```bash
wrangler d1 execute voygent-themed --remote --command="SELECT id, title, status FROM heritage_trips ORDER BY created_at DESC LIMIT 5"
```

Should show recently created trips with genealogy data.

### 3. Monitor Logs

```bash
wrangler pages deployment tail
```

Watch for errors or warnings during live traffic.

## Troubleshooting

### Error: "Amadeus auth failed"
- Check AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET are set correctly
- Verify API URL (test vs production)
- Check Amadeus dashboard for API status

### Error: "Provider unavailable"
- Both primary and fallback providers failed
- Check API keys are valid
- Check rate limits (Kiwi: 100/day free tier, Serper: 2500/month)

### Error: "OCR unavailable - AI binding not configured"
- AI binding not set in wrangler.toml
- Add: `[[ai]]` with `binding = "AI"`
- Redeploy

### Error: "No such table: cache_providers"
- Migration not run on remote database
- Run: `wrangler d1 execute voygent-themed --remote --file=migrations/003_cache_providers.sql`

### Error: "FamilySearch URL parsing failed"
- FamilySearch API may be down
- URL format incorrect (should be: /tree/person/details/[ID])
- Person profile may be private (only public profiles supported)

## Success Criteria

- [ ] All provider endpoints return 200 with valid data
- [ ] Cache hits work (second identical request returns `cached: true`)
- [ ] Genealogy URL parsing extracts surnames and origins
- [ ] Cost estimation calculates correct commission (Math.ceil(high * 1.15))
- [ ] Pro handoff exports complete JSON with Content-Disposition header
- [ ] No 500 errors in production logs
- [ ] Database contains cache entries after tests

## Rollback Plan

If deployment fails:

```bash
# List deployments
wrangler pages deployment list

# Rollback to previous deployment
wrangler pages deployment rollback <DEPLOYMENT_ID>
```

Or redeploy from last known good commit:

```bash
git checkout <last-good-commit>
wrangler pages deploy
```

## Support Resources

- Amadeus API Docs: https://developers.amadeus.com/self-service
- Kiwi Tequila Docs: https://tequila.kiwi.com/portal/docs/tequila_api
- Serper.dev Docs: https://serper.dev/playground
- Tavily API Docs: https://tavily.com/
- Cloudflare Workers AI: https://developers.cloudflare.com/workers-ai/

---

**Last Updated**: 2025-10-05
**Implementation**: specs/001-web-search-integration
