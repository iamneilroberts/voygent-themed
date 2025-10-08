# Quickstart Guide: Template-Driven Trip System

## Overview
This guide provides 5 concrete implementation scenarios demonstrating how to use the template-driven trip planning system. Each scenario includes API calls, expected responses, and integration patterns.

---

## Scenario 1: Admin Creates New Culinary Trip Template

**Goal**: Create a new "Culinary Heritage Tour" template with custom prompts and workflow.

### Step 1: Design Template Configuration

```json
{
  "name": "Culinary Heritage Tour",
  "description": "Explore ancestral food traditions and family recipes in your heritage destinations",
  "icon": "🍽️",

  "intake_prompt": "I'll help you plan a culinary journey to discover your family's food heritage. Please share:\n- Your surnames and their origins\n- Family stories about traditional dishes or recipes\n- Regions your ancestors came from\n- Any dietary preferences or restrictions",

  "research_synthesis_prompt": "Research the culinary history and traditional foods of {surnames} families in {regions}. Focus on:\n1. Traditional family recipes and cooking methods\n2. Historical food markets and ingredient sources\n3. Modern restaurants preserving ancestral techniques\n4. Cooking schools offering heritage cuisine classes\n5. Food festivals celebrating regional traditions",

  "workflow_prompt": "Build a culinary-focused itinerary that includes:\n- Cooking classes with local chefs specializing in traditional cuisine\n- Visits to historic food markets and specialty ingredient shops\n- Farm-to-table restaurants preserving ancestral recipes\n- Food tours of heritage neighborhoods\n- Wine/whisky/cheese tastings tied to family origins\nBalance hands-on experiences with cultural context.",

  "daily_activity_prompt": "For each day, create a culinary journey including:\n- Morning market visits or ingredient sourcing\n- Afternoon cooking class or food workshop\n- Evening dining at heritage restaurants\n- Free time for personal exploration\nInclude meal recommendations and reservation suggestions.",

  "why_we_suggest_prompt": "Explain how this activity connects to {surnames} culinary heritage, highlighting historical significance and family food traditions.",

  "required_fields": ["surnames", "regions", "duration_days", "travelers"],
  "optional_fields": ["dietary_restrictions", "cooking_skill_level", "budget"],

  "search_placeholder": "Enter your family surnames and culinary interests...",
  "search_help_text": "e.g., 'McLeod and Campbell families, Scottish Highlands cuisine'",

  "progress_messages": [
    "Researching traditional recipes and food heritage...",
    "Finding cooking schools and heritage restaurants...",
    "Building your culinary itinerary...",
    "Adding market tours and tasting experiences..."
  ],

  "number_of_options": 3,
  "trip_days_min": 5,
  "trip_days_max": 14,

  "luxury_levels": ["home_cooking", "local_bistro", "fine_dining", "michelin_starred"],
  "activity_levels": ["food_tours_only", "moderate_cooking", "intensive_classes", "chef_immersion"],
  "transport_preferences": ["food_walks", "local_transport", "rental_car", "private_driver"],

  "tour_search_instructions": "Search for: cooking classes, food tours, wine tastings, cheese making workshops, distillery visits. Prioritize small group (max 12) or private experiences. Filter for 4.5+ rating. Focus on traditional/heritage cuisine.",

  "hotel_search_instructions": "Prefer boutique hotels or B&Bs in food districts or near historic markets. Include breakfast. Walking distance to culinary attractions. 3-4 star for comfort level, 5 star for fine_dining level.",

  "flight_search_instructions": "Route to nearest major airport to culinary destination. For fine_dining luxury level, offer business class upgrades. Include meal preferences in special requests.",

  "estimate_margin_percent": 18
}
```

### Step 2: Validate Template

**Request**: `POST /api/admin/templates/validate`
```json
{
  "name": "Culinary Heritage Tour",
  "description": "Explore ancestral food traditions...",
  ...
}
```

**Response**: `200 OK`
```json
{
  "valid": true,
  "errors": [],
  "warnings": [
    {
      "field": "luxury_levels",
      "message": "Custom luxury levels defined - ensure UI supports these options"
    }
  ]
}
```

### Step 3: Create Template

**Request**: `POST /api/admin/templates`
```json
{ ... full template ... }
```

**Response**: `201 Created`
```json
{
  "id": "tpl_culinary_heritage_001",
  "name": "Culinary Heritage Tour",
  "is_active": true,
  "created_at": "2025-10-07T14:30:00Z",
  ...
}
```

### Step 4: Test Template

Create test trip using the new template:
```bash
curl -X POST https://voygent.app/api/trips \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "tpl_culinary_heritage_001",
    "intake": {
      "surnames": ["McLeod", "Campbell"],
      "regions": ["Scottish Highlands"],
      "duration_days": 7,
      "travelers": 2,
      "dietary_restrictions": "none",
      "budget": "comfort"
    }
  }'
```

---

## Scenario 2: User Creates Heritage Trip with Research-First Workflow

**Goal**: User plans a Scottish heritage trip, reviews AI research, then builds trip options.

### Step 1: Initiate Trip

**Request**: `POST /api/trips`
```json
{
  "template_id": "tpl_scottish_heritage_001",
  "intake": {
    "surnames": ["McLeod"],
    "origin": "Isle of Skye",
    "duration_days": 10,
    "travelers": 2
  }
}
```

**Response**: `201 Created`
```json
{
  "trip_id": "trip_abc123",
  "status": "researching",
  "correlation_id": "trip_abc123"
}
```

### Step 2: Poll Research Status

**Request**: `GET /api/trips/trip_abc123/research`

**Response (in progress)**: `200 OK`
```json
{
  "status": "in_progress",
  "research_summary": null,
  "research_viewed": false
}
```

**Response (complete)**: `200 OK`
```json
{
  "status": "complete",
  "research_summary": "The McLeod clan has deep roots on the Isle of Skye, with Dunvegan Castle serving as the ancestral seat since the 13th century. Key historical sites include:\n\n1. **Dunvegan Castle** - Home of the Chiefs of Clan MacLeod for 800 years\n2. **Talisker Distillery** - Historic whisky production tied to clan heritage\n3. **Clan MacLeod Parliament Cairns** - Ancient meeting stones\n4. **St. Clement's Church, Rodel** - Contains MacLeod family tombs\n\nThe research also identifies 12 smaller heritage sites, 3 specialized museums, and 8 local historians who offer private tours...",
  "research_viewed": false,
  "provider_used": "Z.AI",
  "tokens_used": 1847,
  "cost_usd": 0.00012
}
```

### Step 3: Display Research to User

Frontend displays `research_summary` in UI, then marks as viewed:

**Request**: `PATCH /api/trips/trip_abc123/research`
```json
{
  "research_viewed": true
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "can_generate_options": true
}
```

### Step 4: Generate Trip Options

**Request**: `POST /api/trips/trip_abc123/options`
```json
{
  "preferences": {
    "days": 10,
    "luxury_level": "comfort",
    "activity_level": "moderate",
    "transport_preference": "rental_car",
    "budget_usd": 4000,
    "adults": 2,
    "children": 0,
    "special_requests": "Interest in genealogy research, prefer quiet accommodations"
  }
}
```

**Response**: `200 OK`
```json
{
  "status": "options_ready",
  "number_of_options": 4,
  "options": [
    {
      "option_id": "opt_001",
      "title": "Isle of Skye Deep Dive: 10 Days at the Heart of MacLeod Territory",
      "summary": "Spend the full 10 days exploring Skye's MacLeod heritage sites, with day trips to nearby clan locations. Includes private genealogy consultation and access to clan archives.",
      "days": 10,
      "locations": [
        {"city": "Portree", "country": "Scotland", "nights": 5},
        {"city": "Dunvegan", "country": "Scotland", "nights": 5}
      ],
      "estimated_total_usd": 3850,
      "highlights": [
        "5 days based near Dunvegan Castle",
        "Private clan historian tour (2 days)",
        "Genealogy research at Clan MacLeod Centre",
        "Talisker Distillery heritage tour",
        "Quiet B&Bs with sea views"
      ],
      "matches_preferences": {
        "luxury_level": "comfort",
        "activity_level": "moderate",
        "transport": "rental_car"
      }
    },
    {
      "option_id": "opt_002",
      "title": "MacLeod Heritage Circuit: Skye to Harris",
      "summary": "7 days on Skye, 3 days on Harris exploring MacLeod connections across the Hebrides.",
      "days": 10,
      "locations": [
        {"city": "Portree", "country": "Scotland", "nights": 4},
        {"city": "Dunvegan", "country": "Scotland", "nights": 3},
        {"city": "Tarbert, Harris", "country": "Scotland", "nights": 3}
      ],
      "estimated_total_usd": 4100,
      "highlights": [
        "Ferry to Harris for extended clan territory",
        "St. Clement's Church MacLeod tombs",
        "Harris Tweed weaving workshops",
        "Coastal clan settlements",
        "Mix of hotels and heritage B&Bs"
      ]
    }
    // ... 2 more options
  ]
}
```

### Step 5: Monitor Progress (Diagnostic Window)

**Request**: `GET /api/trips/trip_abc123/diagnostics?since=2025-10-07T14:00:00Z`

**Response**: `200 OK`
```json
{
  "logs": [
    {
      "id": "log_001",
      "timestamp": "2025-10-07T14:30:15Z",
      "level": "info",
      "category": "provider",
      "message": "Z.AI research query successful",
      "metadata": {"tokens": 1847, "cost_usd": 0.00012}
    },
    {
      "id": "log_002",
      "timestamp": "2025-10-07T14:30:45Z",
      "level": "info",
      "category": "template",
      "message": "Generating 4 trip options using template workflow",
      "metadata": {"template_id": "tpl_scottish_heritage_001"}
    }
  ],
  "has_more": false,
  "summary": {
    "total_logs": 12,
    "providers_used": ["Z.AI"],
    "total_cost_usd": 0.00089,
    "duration_seconds": 47
  }
}
```

---

## Scenario 3: User Requests Travel Agent Quote

**Goal**: User selects trip configuration, system generates comprehensive handoff for agent.

### Step 1: Select Flight Options

**Request**: `POST /api/trips/trip_abc123/flights`
```json
{
  "from": "JFK",
  "to": "EDI",
  "departure_date": "2025-06-15",
  "return_date": "2025-06-25",
  "adults": 2,
  "cabin_class": "economy"
}
```

**Response**: `200 OK`
```json
{
  "flights": [
    {
      "id": "flight_cheapest_001",
      "category": "cheapest",
      "carrier": "Icelandair",
      "base_price_usd": 550,
      "estimated_price_usd": 647,
      "margin_applied_usd": 97,
      "duration_hours": 9.5,
      "stops": 1
    },
    {
      "id": "flight_shortest_001",
      "category": "shortest",
      "carrier": "Delta",
      "base_price_usd": 725,
      "estimated_price_usd": 853,
      "duration_hours": 7.5,
      "stops": 0
    },
    {
      "id": "flight_upgrade_001",
      "category": "upgrade_comfort",
      "carrier": "British Airways",
      "cabin_class": "premium_economy",
      "base_price_usd": 1150,
      "estimated_price_usd": 1354,
      "duration_hours": 7.5,
      "stops": 0
    }
  ],
  "margin_percent": 17,
  "disclaimer": "Prices are estimates only. Final price from travel agent may vary."
}
```

User selects: `flight_shortest_001`

### Step 2: Select Hotels

**Request**: `POST /api/trips/trip_abc123/hotels` (for each location)

User selects hotels for Portree and Dunvegan.

### Step 3: Build Daily Itinerary

User works with AI to build daily plans:
```json
[
  {
    "day": 1,
    "date": "2025-06-15",
    "location": "Portree",
    "activities": [
      {"time": "14:00", "activity": "Arrive Edinburgh, drive to Portree (5h)", "type": "transport", "cost_usd": 0},
      {"time": "19:30", "activity": "Dinner at Scorrybreac Restaurant", "type": "meal", "cost_usd": 85}
    ],
    "why_we_suggest": "Portree serves as the perfect base to begin your MacLeod heritage exploration, with easy access to Dunvegan Castle and clan sites.",
    "accommodation": "Bosville Hotel",
    "daily_total_usd": 235
  }
  // ... days 2-10
]
```

### Step 4: Generate Handoff Document

**Request**: `POST /api/trips/trip_abc123/handoff`
```json
{
  "selected_flight_id": "flight_shortest_001",
  "selected_hotel_ids": ["hotel_portree_002", "hotel_dunvegan_001"],
  "selected_transport_ids": ["rental_car_001"],
  "daily_itinerary": [ ... ],
  "special_requests": "Quiet rooms, vegetarian breakfast options"
}
```

**Response**: `201 Created`
```json
{
  "id": "handoff_xyz789",
  "trip_id": "trip_abc123",
  "user_id": "user_456",

  "chat_history": [
    {"role": "user", "content": "I want to explore my McLeod heritage...", "timestamp": "2025-10-07T14:00:00Z"},
    {"role": "assistant", "content": "I'll help you plan...", "timestamp": "2025-10-07T14:00:15Z"}
    // ... last 100 messages
  ],

  "research_summary": "The McLeod clan has deep roots on the Isle of Skye...",

  "user_preferences": {
    "luxury_level": "comfort",
    "activity_level": "moderate",
    "transport": "rental_car",
    "days": 10,
    "adults": 2,
    "budget_usd": 4000,
    "special_requests": "Quiet rooms, vegetarian breakfast options"
  },

  "all_flight_options": [ ... 3 flights shown ... ],
  "selected_flight_id": "flight_shortest_001",

  "all_hotel_options": [ ... 12 hotels shown across 2 locations ... ],
  "selected_hotel_ids": ["hotel_portree_002", "hotel_dunvegan_001"],

  "daily_itinerary": [ ... 10 day itinerary ... ],

  "total_estimate_usd": 3847,
  "margin_percent": 17,

  "quote_status": "pending",
  "pdf_url": "https://r2.voygent.app/handoffs/handoff_xyz789.pdf",

  "created_at": "2025-10-07T15:30:00Z",
  "expires_at": "2025-11-06T15:30:00Z"
}
```

### Step 5: User Downloads PDF

**Request**: `GET /api/trips/trip_abc123/handoff/pdf`

**Response**: `200 OK` (PDF binary)

PDF includes:
- Cover page with trip summary
- Complete chat history (conversation flow)
- Research summary (heritage context)
- All flight options comparison table (with selected highlighted)
- All hotel options by location (with selected highlighted)
- Daily itinerary with "why we suggest" explanations
- Total estimate breakdown
- Agent contact form

---

## Scenario 4: Developer Views Trip Creation Diagnostics

**Goal**: Debug slow trip creation using integrated diagnostic window.

### Step 1: Open Diagnostic Window

Frontend loads diagnostic UI for `trip_abc123`:

**Request**: `GET /api/trips/trip_abc123/diagnostics`

**Response**: `200 OK`
```json
{
  "logs": [
    {
      "id": "log_001",
      "timestamp": "2025-10-07T14:30:00Z",
      "level": "info",
      "category": "request",
      "message": "Trip creation initiated",
      "metadata": {"template_id": "tpl_scottish_heritage_001"}
    },
    {
      "id": "log_002",
      "timestamp": "2025-10-07T14:30:05Z",
      "level": "info",
      "category": "provider",
      "message": "Z.AI research request sent",
      "metadata": {"model": "llama-3.3-70b", "prompt_tokens": 523}
    },
    {
      "id": "log_003",
      "timestamp": "2025-10-07T14:30:18Z",
      "level": "warn",
      "category": "provider",
      "message": "Z.AI timeout, falling back to OpenAI",
      "metadata": {"error": "Request timeout after 10s"}
    },
    {
      "id": "log_004",
      "timestamp": "2025-10-07T14:30:25Z",
      "level": "info",
      "category": "provider",
      "message": "OpenAI research successful",
      "metadata": {"model": "gpt-4o-mini", "tokens_in": 523, "tokens_out": 1847, "cost_usd": 0.00069}
    }
  ],
  "summary": {
    "total_logs": 15,
    "log_levels": {"debug": 2, "info": 10, "warn": 2, "error": 1},
    "providers_used": ["Z.AI", "OpenAI"],
    "total_cost_usd": 0.00069,
    "errors": ["Z.AI timeout"],
    "duration_seconds": 45
  }
}
```

### Step 2: Stream Real-Time Updates

Frontend polls every 2s:

**Request**: `GET /api/trips/trip_abc123/diagnostics?since=2025-10-07T14:30:25Z`

**Response**: `200 OK` (new logs)
```json
{
  "logs": [
    {
      "id": "log_005",
      "timestamp": "2025-10-07T14:30:30Z",
      "level": "info",
      "category": "amadeus",
      "message": "Flight search request",
      "metadata": {"from": "JFK", "to": "EDI", "cache_hit": false}
    },
    {
      "id": "log_006",
      "timestamp": "2025-10-07T14:30:42Z",
      "level": "info",
      "category": "amadeus",
      "message": "Flight results retrieved",
      "metadata": {"results": 3, "api_cost_usd": 0.03}
    }
  ],
  "has_more": false,
  "last_timestamp": "2025-10-07T14:30:42Z"
}
```

### Step 3: Filter by Error Level

**Request**: `GET /api/trips/trip_abc123/diagnostics?level=error`

**Response**: `200 OK`
```json
{
  "logs": [
    {
      "id": "log_012",
      "timestamp": "2025-10-07T14:31:15Z",
      "level": "error",
      "category": "template",
      "message": "Invalid workflow_prompt variable: {unknown_var}",
      "metadata": {
        "template_id": "tpl_scottish_heritage_001",
        "prompt_excerpt": "...using {unknown_var} to build..."
      }
    }
  ],
  "summary": {
    "total_logs": 1,
    "log_levels": {"error": 1}
  }
}
```

**Action**: Developer fixes template variable in admin UI.

### Step 4: Export Logs for Bug Report

**Request**: `GET /api/trips/trip_abc123/diagnostics/export`

**Response**: `200 OK` (JSON file download)
```json
{
  "trip_id": "trip_abc123",
  "correlation_id": "trip_abc123",
  "logs": [ ... all 45 logs ... ],
  "export_timestamp": "2025-10-07T15:00:00Z"
}
```

Developer attaches to GitHub issue.

---

## Scenario 5: Developer Removes A/B Comparison Code

**Goal**: Clean removal of deprecated A/B comparison functionality.

### Step 1: Verify A/B Endpoint Returns 410 Gone

**Request**: `PATCH /api/trips/trip_abc123/ab`

**Response**: `410 Gone`
```json
{
  "error": "A/B comparison has been deprecated",
  "message": "This endpoint is no longer available. The system now uses template-driven trip options instead.",
  "migration_guide": "https://docs.voygent.app/migration/ab-to-templates",
  "deprecated_since": "2025-10-01",
  "removal_date": "2025-11-01"
}
```

### Step 2: Monitor for A/B Usage

Check system diagnostics for A/B endpoint calls:

**Request**: `GET /admin/diagnostics/errors?hours=168`

**Response**: `200 OK`
```json
{
  "errors": [
    {
      "message": "410 Gone: A/B comparison deprecated",
      "count": 3,
      "last_occurrence": "2025-10-05T10:30:00Z",
      "category": "deprecated_endpoint"
    }
  ],
  "total": 3
}
```

Only 3 calls in 7 days → safe to remove.

### Step 3: Remove Frontend A/B UI

```bash
# Delete A/B variant selection UI
rm public/templates/ab-selector.html

# Update trip detail page - remove A/B section
# Edit: public/templates/trip-detail.html
# Remove: <div id="ab-comparison">...</div>
```

### Step 4: Delete Backend Endpoint (after 30 days)

```bash
# After 30-day grace period
rm functions/api/trips/[id]/ab.ts

# Verify no imports
grep -r "from.*ab.ts" functions/
# (no results)
```

### Step 5: Database Migration (optional - after 60 days)

```sql
-- Migration 022: Remove variants_json column
-- Run after 60 days of zero A/B usage

ALTER TABLE themed_trips DROP COLUMN variants_json;
```

**Verification**:
```bash
# Check database schema
wrangler d1 execute voygent-themed --command "PRAGMA table_info(themed_trips);"

# Confirm variants_json is gone
```

### Step 6: Update Documentation

```bash
# Update API docs
rm docs/api/ab-comparison.md

# Add deprecation notice
echo "## Deprecated Endpoints\n\n- \`PATCH /api/trips/{id}/ab\` - Removed 2025-11-01" >> docs/api/deprecated.md
```

---

## Integration Patterns

### Pattern 1: Polling for Research Completion

```javascript
// Frontend polling pattern
async function pollResearch(tripId) {
  const maxAttempts = 30; // 30 × 2s = 60s timeout
  let attempts = 0;

  while (attempts < maxAttempts) {
    const res = await fetch(`/api/trips/${tripId}/research`);
    const data = await res.json();

    if (data.status === 'complete') {
      displayResearchSummary(data.research_summary);
      await markResearchViewed(tripId);
      return data;
    }

    if (data.status === 'failed') {
      throw new Error(data.error);
    }

    await sleep(2000);
    attempts++;
  }

  throw new Error('Research timeout');
}
```

### Pattern 2: Real-Time Diagnostic Updates

```javascript
// Diagnostic window real-time updates
async function streamDiagnostics(tripId) {
  let lastTimestamp = null;

  setInterval(async () => {
    const url = lastTimestamp
      ? `/api/trips/${tripId}/diagnostics?since=${lastTimestamp}`
      : `/api/trips/${tripId}/diagnostics`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.logs.length > 0) {
      appendLogsToUI(data.logs);
      lastTimestamp = data.last_timestamp;
    }
  }, 2000); // Poll every 2s
}
```

### Pattern 3: Template Variable Replacement

```typescript
// Backend: Replace template variables
function replaceTemplateVars(prompt: string, context: any): string {
  return prompt
    .replace(/\{surnames\}/g, context.surnames.join(' and '))
    .replace(/\{regions\}/g, context.regions.join(', '))
    .replace(/\{input\}/g, JSON.stringify(context.intake))
    .replace(/\{search_results\}/g, context.research_summary)
    .replace(/\{preferences\}/g, JSON.stringify(context.preferences));
}
```

### Pattern 4: Provider Cascade with Logging

```typescript
// Backend: Provider selection with fallback
async function callWithFallback(prompt: string, env: any, correlationId: string) {
  const logger = Logger.getInstance(env.DB);

  try {
    logger.logProvider(correlationId, 'Z.AI', 'attempting');
    return await callZAI(prompt, env.ZAI_API_KEY);
  } catch (error) {
    logger.logProvider(correlationId, 'Z.AI', 'failed', { error: error.message });

    if (env.OPENAI_API_KEY) {
      logger.logProvider(correlationId, 'OpenAI', 'fallback');
      return await callOpenAI(prompt, env.OPENAI_API_KEY);
    }

    throw error;
  }
}
```

### Pattern 5: Handoff Document Assembly

```typescript
// Backend: Assemble complete handoff
async function createHandoff(tripId: string, selections: any, env: any) {
  const trip = await getTrip(env.DB, tripId);
  const chatHistory = await getChatHistory(env.DB, tripId, 100); // Last 100 messages
  const allFlights = await getAllFlightsShown(env.DB, tripId);
  const allHotels = await getAllHotelsShown(env.DB, tripId);

  const handoff = {
    id: generateUUID(),
    trip_id: tripId,
    user_id: trip.user_id,
    chat_history: chatHistory,
    research_summary: trip.research_summary,
    user_preferences: trip.preferences,
    all_flight_options: allFlights,
    selected_flight_id: selections.flight_id,
    all_hotel_options: allHotels,
    selected_hotel_ids: selections.hotel_ids,
    daily_itinerary: selections.itinerary,
    total_estimate_usd: calculateTotal(selections),
    margin_percent: trip.template.estimate_margin_percent,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  };

  await saveHandoff(env.DB, handoff);
  await generatePDF(handoff, env.R2);

  return handoff;
}
```

---

## Next Steps

After completing these scenarios, you should:

1. **Run Migrations**: Apply migrations 020-021 to extend database schema
2. **Update Templates**: Add workflow prompts to existing templates via admin UI
3. **Test Workflows**: Create test trips with each template to verify prompt logic
4. **Monitor Diagnostics**: Use diagnostic window to optimize provider usage
5. **Train Agents**: Provide handoff document samples to travel agent partners

For implementation details, see:
- `data-model.md` - Database schema and validation
- `contracts/` - OpenAPI specifications for all endpoints
- `research.md` - Architecture decisions and implementation priorities
