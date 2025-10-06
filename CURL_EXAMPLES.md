# API curl Examples

Base URL: `http://localhost:8788` (local) or `https://your-app.pages.dev` (production)

## 1. POST /api/trips - Create Trip from Intake

### Simple text input
```bash
curl -X POST http://localhost:8788/api/trips \
  -F "text=Family surnames: McLeod, Roberts
Suspected origins: Scotland, Wales
Party: 2 adults, children ages: 12, 15
Duration: 7 days
Target month: June
Luxury level: Comfort
Activity level: moderate
Additional notes: Genealogy link https://ancestry.com/tree/123" \
  -F "userId=user-001"
```

### With file upload
```bash
curl -X POST http://localhost:8788/api/trips \
  -F "text=McLeod family from Skye, 2 adults, 7 days in June" \
  -F "files=@family-tree.pdf" \
  -F "files=@old-photo.jpg" \
  -F "userId=user-001"
```

### Response
```json
{
  "tripId": "abc123XYZ",
  "intake": {
    "surnames": ["McLeod", "Roberts"],
    "suspected_origins": ["Isle of Skye", "Wales"],
    "party": { "adults": 2, "children": [12, 15], "accessibility": "none" },
    "duration_days": 7,
    "target_month": "June",
    "luxury_level": "Comfort",
    "activity_level": "moderate",
    ...
  },
  "options": [
    {
      "key": "A",
      "title": "Skye & Highlands Heritage Trail",
      "whyOverall": "Deep dive into McLeod clan history on Skye with mainland connections",
      "days": [...],
      "splurges": ["Dunvegan Castle private tour", "Eilean Donan photo session"]
    },
    {
      "key": "B",
      "title": "Scotland-Wales Dual Heritage",
      "whyOverall": "Balanced exploration of both McLeod (Skye) and Roberts (North Wales) roots",
      "days": [...],
      "splurges": ["Conwy Castle evening tour"]
    }
  ],
  "status": "options_ready"
}
```

---

## 2. GET /api/trips/:id - Get Trip Details

```bash
curl http://localhost:8788/api/trips/abc123XYZ
```

### Response
```json
{
  "id": "abc123XYZ",
  "userId": "user-001",
  "template": "heritage",
  "title": "Heritage trip: McLeod, Roberts",
  "intake": { ... },
  "options": [ ... ],
  "itinerary": { ... },
  "variants": { ... },
  "status": "ab_ready",
  "createdAt": 1704067200,
  "updatedAt": 1704067800
}
```

---

## 3. GET /api/trips?userId=:userId - List Trips

```bash
curl "http://localhost:8788/api/trips?userId=user-001"
```

### Response
```json
{
  "trips": [
    {
      "id": "abc123XYZ",
      "user_id": "user-001",
      "title": "Heritage trip: McLeod, Roberts",
      "status": "ab_ready",
      "created_at": 1704067200,
      ...
    },
    ...
  ]
}
```

---

## 4. PATCH /api/trips/:id - Update Trip

```bash
curl -X PATCH http://localhost:8788/api/trips/abc123XYZ \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Scottish & Welsh Roots Journey",
    "intake": {
      "surnames": ["McLeod", "Roberts"],
      "duration_days": 10
    }
  }'
```

### Response
```json
{
  "success": true,
  "tripId": "abc123XYZ"
}
```

---

## 5. PATCH /api/trips/:id/select - Select Option

```bash
curl -X PATCH http://localhost:8788/api/trips/abc123XYZ/select \
  -H "Content-Type: application/json" \
  -d '{"optionKey":"B"}'
```

### Response
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
        "why": "Start with records research before field visits"
      },
      ...
    ],
    "budget": {
      "lodging": "Comfort",
      "notes": "Mix of heritage B&Bs and 3-star hotels"
    }
  },
  "status": "option_selected"
}
```

---

## 6. PATCH /api/trips/:id/ab - Generate A/B Variants

```bash
curl -X PATCH http://localhost:8788/api/trips/abc123XYZ/ab \
  -H "Content-Type: application/json" \
  -d '{
    "transport": {
      "rail": true,
      "car_ok": true,
      "driver_guide_ok": false
    },
    "luxury": "Boutique",
    "activity": "ambitious",
    "accessibility": "none"
  }'
```

### Response
```json
{
  "tripId": "abc123XYZ",
  "variantA": {
    "title": "Scotland-Wales Dual Heritage - Guided Experience",
    "overview": "Structured itinerary with driver-guide and expert local historians",
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
      ...
    ],
    "budget": {
      "lodging": "Boutique",
      "notes": "Heritage hotels and castle B&Bs, guide fees included"
    },
    "assumptions": ["Professional driver-guide for 7 days", "Advance bookings at archives"]
  },
  "variantB": {
    "title": "Scotland-Wales Dual Heritage - Independent Adventure",
    "overview": "Self-drive with flexible timing, DIY research, and spontaneous discoveries",
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
      ...
    ],
    "budget": {
      "lodging": "Boutique",
      "notes": "Charming inns, rental car for 6 days"
    },
    "assumptions": ["Comfortable with right-side driving", "Self-directed research skills"]
  },
  "status": "ab_ready"
}
```

---

## Full Workflow Example

```bash
# 1. Create trip
TRIP_RESPONSE=$(curl -s -X POST http://localhost:8788/api/trips \
  -F "text=McLeod from Skye, Roberts from Wales, 2 adults, 7 days, June, Comfort" \
  -F "userId=user-001")

TRIP_ID=$(echo "$TRIP_RESPONSE" | jq -r '.tripId')
echo "Trip created: $TRIP_ID"

# 2. View options
curl -s http://localhost:8788/api/trips/$TRIP_ID | jq '.options'

# 3. Select option B
curl -s -X PATCH http://localhost:8788/api/trips/$TRIP_ID/select \
  -H "Content-Type: application/json" \
  -d '{"optionKey":"B"}' | jq '.'

# 4. Generate A/B variants
curl -s -X PATCH http://localhost:8788/api/trips/$TRIP_ID/ab \
  -H "Content-Type: application/json" \
  -d '{"luxury":"Comfort","activity":"moderate"}' | jq '.'

# 5. Get final trip
curl -s http://localhost:8788/api/trips/$TRIP_ID | jq '.variants'
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid option key (must be A, B, C, or D)"
}
```

### 404 Not Found
```json
{
  "error": "Trip not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "OpenAI API error: 401 - Invalid API key"
}
```
