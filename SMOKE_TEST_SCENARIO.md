# Local Smoke Test Scenario

## Scenario Overview
Create an intake with **two surnames**, link to a **genealogy URL**, generate **options**, select **B**, produce **A/B variants**, and save **Trip ID**.

---

## Prerequisites

1. **Start the local dev server**:
   ```bash
   npm run dev
   ```
   Server runs at: `http://localhost:8788`

2. **Ensure API keys are set** in `.dev.vars`:
   ```
   OPENAI_API_KEY=sk-...
   # or
   ANTHROPIC_API_KEY=sk-ant-...
   ```

3. **Database must be initialized**:
   ```bash
   npm run db:migrate
   ```

---

## Automated Test (Recommended)

Run the included smoke test script:

```bash
./test-smoke.sh
```

This tests the full workflow and outputs:
- ✅ Trip creation
- ✅ Option generation (≤4)
- ✅ Option B selection
- ✅ A/B variant generation
- ✅ Final trip ID and status

---

## Manual Test Steps

### Step 1: Create Intake with Two Surnames + Genealogy URL

```bash
curl -X POST http://localhost:8788/api/trips \
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
  -F "userId=test-user-001"
```

**Expected Response**:
```json
{
  "tripId": "abc123XYZ",
  "intake": {
    "surnames": ["McLeod", "Roberts"],
    "suspected_origins": ["Isle of Skye", "North Wales (Conwy area)"],
    "party": {
      "adults": 2,
      "children": [],
      "accessibility": "none"
    },
    "duration_days": 7,
    "target_month": "June",
    "luxury_level": "Comfort",
    "activity_level": "moderate",
    "sources": [
      {
        "kind": "url",
        "value": "https://www.familysearch.org/tree/person/details/ABCD-123",
        "notes": "FamilySearch genealogy profile"
      }
    ],
    ...
  },
  "options": [
    {
      "key": "A",
      "title": "Skye & Highlands Heritage Trail",
      "whyOverall": "Deep dive into McLeod clan history...",
      "days": [...]
    },
    {
      "key": "B",
      "title": "Scotland-Wales Dual Heritage",
      "whyOverall": "Balanced exploration of both families...",
      "days": [...]
    },
    {
      "key": "C",
      "title": "...",
      ...
    },
    {
      "key": "D",
      "title": "...",
      ...
    }
  ],
  "status": "options_ready"
}
```

**Save the tripId** from the response (e.g., `abc123XYZ`)

---

### Step 2: Select Option B

```bash
TRIP_ID="abc123XYZ"  # Replace with actual ID from Step 1

curl -X PATCH http://localhost:8788/api/trips/$TRIP_ID/select \
  -H "Content-Type: application/json" \
  -d '{"optionKey":"B"}'
```

**Expected Response**:
```json
{
  "tripId": "abc123XYZ",
  "selectedOption": "B",
  "itinerary": {
    "title": "Scotland-Wales Dual Heritage",
    "overview": "Balanced exploration of both McLeod and Roberts roots",
    "days": [
      {
        "d": 1,
        "city": "Edinburgh",
        "am": "Arrive Edinburgh, settle in Old Town",
        "pm": "Scottish National Archives genealogy session",
        "rail": null,
        "drive": null,
        "why": "Start with records research before field visits"
      },
      {
        "d": 2,
        "city": "Edinburgh to Skye",
        "am": "Train to Mallaig",
        "pm": "Ferry to Skye, Portree arrival",
        "rail": "5h30",
        "drive": null,
        "why": "Scenic rail journey through West Highlands"
      },
      ...
    ],
    "budget": {
      "lodging": "Comfort",
      "notes": "Mix of heritage B&Bs and 3-star hotels"
    },
    "assumptions": [...]
  },
  "status": "option_selected"
}
```

---

### Step 3: Generate A/B Variants

```bash
curl -X PATCH http://localhost:8788/api/trips/$TRIP_ID/ab \
  -H "Content-Type: application/json" \
  -d '{
    "transport": {
      "rail": true,
      "car_ok": true,
      "driver_guide_ok": false
    },
    "luxury": "Comfort",
    "activity": "moderate",
    "accessibility": "none"
  }'
```

**Expected Response**:
```json
{
  "tripId": "abc123XYZ",
  "variantA": {
    "title": "Scotland-Wales Dual Heritage - Guided Experience",
    "overview": "Structured itinerary with local experts and driver-guide support",
    "days": [
      {
        "d": 1,
        "city": "Edinburgh",
        "am": "Private genealogy consultation at National Archives",
        "pm": "Guided Old Town walk with clan historian",
        "eve": "Traditional Scottish dinner with storytelling",
        "rail": null,
        "drive": null,
        "why": "Expert guidance maximizes learning on complex family history"
      },
      {
        "d": 2,
        "city": "Edinburgh to Skye",
        "am": "Driver-guide pickup, scenic route via Glencoe",
        "pm": "Arrive Skye, Dunvegan Castle McLeod seat tour",
        "eve": "Portree waterfront dinner",
        "rail": null,
        "drive": "6h with stops",
        "why": "Direct access with expert commentary en route"
      },
      ...
    ],
    "budget": {
      "lodging": "Comfort",
      "notes": "Heritage hotels and B&Bs, driver-guide fees included"
    },
    "assumptions": [
      "Professional driver-guide for 4 days (Skye + Wales legs)",
      "Advance bookings at archives and private tours"
    ]
  },
  "variantB": {
    "title": "Scotland-Wales Dual Heritage - Independent Adventure",
    "overview": "Self-drive with flexible timing and spontaneous discoveries",
    "days": [
      {
        "d": 1,
        "city": "Edinburgh",
        "am": "Walk-in visit to Scottish Genealogy Centre",
        "pm": "Self-guided Old Town exploration with audio app",
        "eve": "Pub session (live folk music)",
        "rail": null,
        "drive": null,
        "why": "Flexible schedule allows deeper dives when you find surprises"
      },
      {
        "d": 2,
        "city": "Edinburgh to Skye",
        "am": "Pick up rental car, drive via Loch Lomond",
        "pm": "Scenic stops (Glencoe viewpoint), arrive Skye",
        "eve": "Self-catered cottage dinner",
        "rail": null,
        "drive": "6h self-paced",
        "why": "Freedom to linger at photo spots and roadside history markers"
      },
      ...
    ],
    "budget": {
      "lodging": "Comfort",
      "notes": "Charming inns and cottages, rental car for 6 days"
    },
    "assumptions": [
      "Comfortable with right-side driving and manual transmission",
      "Self-directed research skills at local archives"
    ]
  },
  "status": "ab_ready"
}
```

---

### Step 4: Retrieve Final Trip (Verify Saved Trip ID)

```bash
curl http://localhost:8788/api/trips/$TRIP_ID
```

**Expected Response**:
```json
{
  "id": "abc123XYZ",
  "userId": "test-user-001",
  "template": "heritage",
  "title": "Heritage trip: McLeod, Roberts",
  "intake": { ... },
  "options": [ ... ],
  "itinerary": { ... },
  "variants": {
    "variantA": { ... },
    "variantB": { ... }
  },
  "status": "ab_ready",
  "createdAt": 1704067200,
  "updatedAt": 1704067800
}
```

**Verify**:
- ✅ `id` matches the Trip ID from Step 1
- ✅ `status` is `"ab_ready"`
- ✅ `intake.surnames` contains `["McLeod", "Roberts"]`
- ✅ `intake.sources` includes the genealogy URL
- ✅ `options` has 2-4 options (A, B, C, D)
- ✅ `itinerary` reflects selected Option B
- ✅ `variants.variantA` and `variants.variantB` exist

---

## Success Criteria ✅

The smoke test passes if:

1. **Two surnames present**: `intake.surnames` = `["McLeod", "Roberts"]`
2. **Genealogy URL linked**: `intake.sources[].value` contains FamilySearch URL
3. **Options generated**: 2-4 options returned (A, B, C, D)
4. **Option B selected**: `itinerary.title` matches Option B's title
5. **A/B variants produced**: Both `variantA` and `variantB` exist
6. **Trip ID saved**: Final GET returns full trip with `status: "ab_ready"`

---

## Troubleshooting

### Error: "No API keys configured"
- Check `.dev.vars` file exists and contains valid `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`

### Error: "D1 is not defined"
- Run database migration: `npm run db:migrate`

### Error: "Failed to parse intake JSON"
- Provider may have returned prose instead of JSON
- Check API key is valid and has sufficient quota
- Try adding more specific genealogy context to force structured output

### Error: "Trip not found"
- Verify the Trip ID is correct
- Check database was initialized (`npm run db:migrate`)

---

## Expected Token Usage

For the smoke test scenario:

| Step | Endpoint | Tokens In | Tokens Out | Model | Cost (est.) |
|------|----------|-----------|------------|-------|-------------|
| 1a | Intake normalization | ~150 | ~200 | gpt-4o-mini | $0.0001 |
| 1b | Options generation | ~200 | ~800 | gpt-4o-mini | $0.0005 |
| 3 | A/B variants | ~300 | ~900 | gpt-4o or gpt-4o-mini | $0.001-0.003 |
| **Total** | | **~650** | **~1900** | | **~$0.002** |

---

## Visual Verification (Browser)

1. Open `http://localhost:8788` in browser
2. Fill Quick Tuner:
   - Surnames: `McLeod, Roberts`
   - Origins: `Scotland, Wales`
   - Adults: `2`
   - Duration: `7`
   - Month: `June`
   - Luxury: `Comfort`
   - Activity: `moderate`
   - Notes: `https://www.familysearch.org/tree/person/details/ABCD-123`
3. Click **Generate Trip Options**
4. Wait for 4 option cards to appear
5. Click **Option B** card
6. Click **Confirm Selection & Generate A/B Variants**
7. Wait for Variant A and Variant B to display
8. Verify both variants show full day-by-day breakdown

**Screenshot checkpoints**:
- Options grid shows 4 cards (A, B, C, D)
- Option B card has blue border (selected)
- Variants section shows two cards (Variant A, Variant B)
- Each variant has Day 1, Day 2, etc. with AM/PM/EVE breakdowns
- Success message: "A/B variants generated! Your trip is ready."

---

## Automated Test Output

When running `./test-smoke.sh`, expect:

```
Testing against: http://localhost:8788

=== SMOKE TEST: Create intake with two surnames, genealogy URL, generate options ===

1️⃣  POST /api/trips - Creating trip...
{
  "tripId": "abc123XYZ",
  "status": "options_ready",
  ...
}
✅ Trip created: abc123XYZ

2️⃣  GET /api/trips/abc123XYZ - Fetching trip details...
{ ... }

3️⃣  PATCH /api/trips/abc123XYZ/select - Selecting option B...
{ "selectedOption": "B", ... }
✅ Option B selected

4️⃣  PATCH /api/trips/abc123XYZ/ab - Generating A/B variants...
{ "variantA": {...}, "variantB": {...} }
✅ A/B variants generated

5️⃣  GET /api/trips/abc123XYZ - Final trip data...
{ "status": "ab_ready", ... }

=========================================
🎉 SMOKE TEST COMPLETE!
=========================================
Trip ID: abc123XYZ
Final Status: ab_ready

Full workflow tested:
  ✅ Create intake with two surnames (McLeod, Roberts)
  ✅ Link to genealogy URL
  ✅ Generate options (<=4)
  ✅ Select option B
  ✅ Produce A/B variants
  ✅ Save Trip ID

✅ All tests passed!
```

---

## End-to-End Timing

Expected execution time (local):
- **Step 1 (Create)**: 5-15 seconds (2 LLM calls)
- **Step 2 (Select)**: <1 second (database only)
- **Step 3 (A/B)**: 3-8 seconds (1 LLM call)
- **Total**: ~10-25 seconds

Production (Cloudflare edge) will be faster due to geographic distribution.
