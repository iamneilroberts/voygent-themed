# Phase 0 Research: Transform Voygent to Prompt-Driven Template System

**Feature**: 011-transform-voygent-to
**Date**: 2025-10-07
**Status**: Complete

## Executive Summary

This research analyzes the current Voygent codebase to understand what exists, what needs to be extended, and what needs to be removed for the transformation to a prompt-driven template system. Key findings:

1. **Template schema** needs 16 new columns for full prompt-driven control
2. **A/B comparison logic** is fully implemented and must be completely removed
3. **Feature 006 logging** is deployed but needs frontend diagnostic window integration
4. **Amadeus API** exists using Self-Service tier with caching (good for pricing)
5. **Handoff document** exists but needs complete redesign for comprehensive context
6. **Provider cascade** (Z.AI → OpenAI → Anthropic) is fully implemented
7. **Trip options workflow** generates up to 4 options, needs template-driven count

---

## Research Question 1: Template Schema Extensions

### Current Schema
From `DATABASE_SCHEMA.md` and `migrations/004_trip_templates.sql`:

```sql
CREATE TABLE trip_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  intake_prompt TEXT NOT NULL,
  options_prompt TEXT NOT NULL,
  required_fields TEXT NOT NULL,           -- JSON array
  optional_fields TEXT NOT NULL,           -- JSON array
  example_inputs TEXT NOT NULL,            -- JSON
  is_active INTEGER DEFAULT 1,
  created_at INTEGER,
  updated_at INTEGER
);
```

**Already Added** (Migration 009):
- `research_synthesis_prompt TEXT`
- `research_query_template TEXT`

### Required New Columns (per FR-004 spec)

**UI Verbiage** (3 columns):
```sql
search_placeholder TEXT,              -- "Enter your surname or ancestral region"
search_help_text TEXT,                -- Help text displayed near search
progress_messages TEXT,               -- JSON: {"research": "Researching...", "options": "Creating options..."}
```

**Workflow Control** (9 columns):
```sql
workflow_prompt TEXT,                 -- AI instructions for orchestrating workflow
daily_activity_prompt TEXT,           -- AI instructions for daily activity planning
why_we_suggest_prompt TEXT,           -- AI prompt for generating rationale text
number_of_options INTEGER DEFAULT 3,  -- How many trip options to generate (1-10)
trip_days_min INTEGER DEFAULT 5,      -- Minimum trip duration
trip_days_max INTEGER DEFAULT 14,     -- Maximum trip duration
```

**Configuration Arrays** (JSON, 3 columns):
```sql
luxury_levels TEXT,                   -- JSON: ["Backpack", "Savvy", "Comfort", "Boutique", "Occasional Luxe"]
activity_levels TEXT,                 -- JSON: ["gentle", "moderate", "ambitious"]
transport_preferences TEXT,           -- JSON: ["rail_first", "car_ok", "driver_guide", "mixed"]
```

**Search Instructions** (3 columns):
```sql
tour_search_instructions TEXT,        -- How to search/filter tours (keywords, priorities)
hotel_search_instructions TEXT,       -- How to filter hotels (style, amenities, location)
flight_search_instructions TEXT,      -- Flight preferences (direct vs connections, budget vs comfort)
```

### Migration Strategy
- Create `020_extend_trip_templates.sql` with 16 new columns (all nullable for backwards compatibility)
- Provide sensible defaults for existing templates in migration
- Update existing templates with appropriate values (e.g., heritage gets heritage-specific prompts)
- Add validation logic in `/api/templates` endpoints to enforce JSON schema

### Code References
- **Schema**: `DATABASE_SCHEMA.md` lines 104-142
- **Current Migration**: `migrations/004_trip_templates.sql`
- **Research Prompts**: `migrations/009_add_research_prompts.sql`
- **Template Population**: `migrations/010_populate_all_templates.sql`

---

## Research Question 2: A/B Comparison Code Locations

### Backend Code to Remove

**1. Endpoint: `/api/trips/:id/ab`**
- **File**: `functions/api/trips/[id]/ab.ts` (268 lines)
- **Purpose**: Generates A/B variants based on user preferences
- **Action**: DELETE entire file
- **Status**: Deprecated endpoint, returns 410 Gone

**2. Prompt: `OPTION_SELECTOR_TO_AB`**
- **File**: `functions/api/lib/prompts.ts`
- **Usage**: Referenced in `ab.ts` and `select.ts`
- **Action**: REMOVE export from prompts.ts

**3. Database Field: `variants_json`**
- **Table**: `themed_trips`
- **Type**: TEXT (JSON)
- **Action**: Keep field (backwards compatibility) but deprecate in code
- **New code**: Ignore `variants_json` in queries, return null

### Frontend Code to Remove

**1. UI Elements**:
- **File**: `public/index.html`
- **Classes**: `.variants-section`, `.variant-card` (CSS)
- **Elements**: `<div id="variantsSection">`, `<div id="variantsContainer">`
- **Action**: DELETE all variant-related HTML/CSS

**2. JavaScript**:
- **File**: `public/js/trips.js`
- **References**: `variantsSection`, `variantsContainer` DOM manipulation
- **Action**: REMOVE all variant display logic

### Migration Plan
1. **Step 1**: Add deprecation warning to `/api/trips/:id/ab` (returns 410 Gone)
2. **Step 2**: Remove frontend variant UI elements
3. **Step 3**: Update trip detail endpoint to ignore `variants_json`
4. **Step 4**: After 30 days, DELETE `ab.ts` endpoint file
5. **Step 5**: Eventually drop `variants_json` column in future migration (schema cleanup)

### Code References
- **Backend Endpoint**: `functions/api/trips/[id]/ab.ts`
- **Prompt**: `functions/api/lib/prompts.ts` (OPTION_SELECTOR_TO_AB export)
- **Frontend HTML**: `public/index.html` lines with "variant"
- **Frontend JS**: `public/js/trips.js` (getElementById references)
- **Database Schema**: `DATABASE_SCHEMA.md` line 37 (variants_json field)

---

## Research Question 3: Feature 006 Logging Integration

### What Exists (Deployed)

**Backend Infrastructure** (✅ Complete per `IMPLEMENTATION_SUMMARY.md`):
- **Logger Class**: `functions/api/lib/logger.ts` (singleton, batch logging)
- **Tables**: `logs`, `metrics_snapshots`, `daily_aggregates`, `admin_users`
- **API Endpoints**:
  - `/api/admin/logs` (query logs with filters)
  - `/api/admin/metrics` (5m/7d/30d metrics)
  - `/api/admin/traces/:tripId` (request trace)
  - `/api/admin/export` (JSON export)
- **Middleware**: `functions/api/_middleware.ts` (auto-logging requests/responses)
- **PII Sanitizer**: `functions/api/lib/pii-sanitizer.ts` (masks emails, surnames)

**What's Missing for Diagnostic Window**:

1. **Frontend Component**: No diagnostic window UI exists
2. **Trip-Specific Logs**: Need correlation_id filtering
3. **Real-Time Updates**: Need polling or SSE for live logs

### Integration Plan

**1. Add Correlation ID to Trip Creation**:
```typescript
// In POST /api/trips
const correlationId = crypto.randomUUID();
await logger.logRequest({
  request_id: requestId,
  correlation_id: correlationId,  // NEW: Link all trip ops
  endpoint: '/api/trips',
  //...
});
```

**2. Create Diagnostic Window Component**:
- **File**: `public/components/diagnostic-window.html` or inline in `index.html`
- **Features**:
  - Toggle button: "View Diagnostics"
  - Collapsible panel (slides from right)
  - Severity filter buttons (DEBUG, INFO, WARN, ERROR, CRITICAL)
  - Auto-refresh every 2 seconds (polling)
  - Scrollable log list with expand/collapse for metadata
  - Color coding: ERROR=red, WARN=yellow, INFO=blue, DEBUG=gray

**3. Add Diagnostic API Endpoint** (or use existing):
```typescript
// GET /api/logs/trip/:tripId
// Filter logs WHERE correlation_id = tripId
// Return: { logs: LogEntry[], count: number }
```

**4. Wire Up Frontend**:
```javascript
// public/js/diagnostics.js
async function fetchTripLogs(tripId, severity = null) {
  const url = `/api/admin/logs?correlation_id=${tripId}${severity ? `&severity=${severity}` : ''}`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${getJWT()}` }
  });
  return await response.json();
}

// Poll every 2 seconds
setInterval(() => {
  if (currentTripId && diagnosticWindowOpen) {
    fetchTripLogs(currentTripId).then(data => updateDiagnosticWindow(data.logs));
  }
}, 2000);
```

### Code References
- **Logger Singleton**: `functions/api/lib/logger.ts`
- **Admin Logs API**: `functions/api/admin/logs.ts`
- **Traces API**: `functions/api/admin/traces/[tripId].ts`
- **Implementation Summary**: `specs/006-add-full-logging/IMPLEMENTATION_SUMMARY.md`
- **Middleware**: `functions/api/_middleware.ts`

---

## Research Question 4: Amadeus API Implementation

### Current Implementation

**File**: `functions/api/lib/amadeus.ts` (265 lines)

**Features**:
- ✅ OAuth2 client credentials flow
- ✅ Token caching (30min expiry with 60s buffer)
- ✅ Uses Self-Service API tier (`test.api.amadeus.com` or `api.amadeus.com`)
- ✅ D1 cache integration (24h TTL via `cache_providers` table)
- ✅ Flight Offers Search API
- ✅ Hotel Search API
- ✅ Error handling with fallback logic

**Flight Search**:
```typescript
export async function searchFlights(
  env: AmadeusEnv & { DB: D1Database },
  params: {
    from: string;        // IATA code (JFK)
    to: string;          // IATA code (EDI)
    month: string;       // YYYY-MM
    adults?: number;     // default 2
    route_type?: 'round_trip' | 'one_way';
  }
)
```

**Hotel Search**:
```typescript
export async function searchHotels(
  env: AmadeusEnv & { DB: D1Database },
  params: {
    cityCode: string;    // IATA city code
    checkIn: string;     // YYYY-MM-DD
    checkOut: string;    // YYYY-MM-DD
    adults?: number;     // default 2
    radius?: number;     // km from city center
    radiusUnit?: 'KM' | 'MILE';
  }
)
```

### What's Needed for Price Estimates

**Current State**: ✅ Already configured for pricing only
- Uses Flight Offers Search (not Flight Create Order)
- Uses Hotel Search (not Hotel Booking)
- Returns price ranges, not bookable inventory
- Has disclaimers in responses

**Enhancements Needed**:
1. **Margin Addition**: Add 15-20% to Amadeus prices for agent commission
2. **Disclaimer Text**: Ensure all responses include "Estimated - final quote by travel professional"
3. **Multi-City Support**: Extend flight search for multi-leg trips
4. **Luxury Filtering**: Use hotel amenity filters based on luxury_levels from template

**Pricing Tier Verification**:
- Current: Uses Self-Service API (cheapest tier, $0.01-0.05 per call)
- ✅ Perfect for price estimates (no booking capability = no compliance burden)
- ⚠️ Rate limits: 10 calls/sec (adequate for MVP)

### Code References
- **Amadeus Client**: `functions/api/lib/amadeus.ts`
- **Cache Integration**: `functions/api/lib/cache.ts`
- **Usage in A/B**: `functions/api/trips/[id]/ab.ts` lines 191-224 (flight enrichment)
- **Hotel Endpoint**: `functions/api/providers/hotels.ts`
- **Flight Endpoint**: `functions/api/providers/flights.ts`

---

## Research Question 5: Handoff Document Formats

### Current Implementation

**File**: `functions/api/handoff/[id].ts` (92 lines)

**Current Structure** (as of Feature 001):
```json
{
  "trip_id": "uuid",
  "created_at": "ISO timestamp",
  "intake": {
    "surnames": [],
    "suspected_origins": [],
    "duration_days": 7,
    "adults": 2,
    "children": []
  },
  "selected_option": {},
  "selected_variant": {},
  "itinerary": {},
  "cost_estimate": {},
  "disclaimers": []
}
```

**Issues with Current Design**:
- ❌ No chat history (loses context)
- ❌ No research summary (loses "why")
- ❌ Only shows SELECTED options (agent can't see alternatives)
- ❌ No flight/hotel options shown (agent has no pricing reference)
- ❌ Missing traveler contact info
- ❌ No format optimized for GDS systems (Sabre, Amadeus, Travelport)

### Required New Structure (per FR-016 spec)

**New Table**: `handoff_documents`
```sql
CREATE TABLE handoff_documents (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  created_at INTEGER,
  traveler_name TEXT NOT NULL,
  traveler_email TEXT NOT NULL,
  traveler_phone TEXT,
  chat_history TEXT NOT NULL,           -- JSON array of all messages
  research_summary TEXT NOT NULL,        -- Full AI research text
  trip_summary TEXT NOT NULL,            -- JSON: theme, destinations, dates, travelers
  flight_options_shown TEXT NOT NULL,    -- JSON array with selected flags
  hotel_options_shown TEXT NOT NULL,     -- JSON array with selected flags
  daily_itinerary TEXT NOT NULL,         -- JSON day-by-day plan
  transport_details TEXT,                -- JSON: car/rail/driver
  tours_list TEXT,                       -- JSON: recommended tours
  user_preferences TEXT,                 -- JSON: luxury, activity, etc.
  estimated_budget TEXT NOT NULL,        -- JSON: breakdown by category
  special_requests TEXT,
  agent_id TEXT,                         -- FK to travel_agents
  status TEXT DEFAULT 'pending',         -- pending|assigned|quoted|booked|cancelled
  quote_returned_at INTEGER,
  agent_quote_details TEXT,              -- JSON: agent's official quote

  FOREIGN KEY (trip_id) REFERENCES themed_trips(id),
  FOREIGN KEY (agent_id) REFERENCES travel_agents(id)
);
```

### Export Formats

**1. JSON Export** (Machine-Readable for GDS):
```json
{
  "voygent_handoff_version": "2.0",
  "trip_id": "uuid",
  "created_at": "ISO",
  "traveler": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1-555-0100"
  },
  "chat_history": [
    {"role": "user", "content": "...", "timestamp": "ISO"},
    {"role": "assistant", "content": "...", "timestamp": "ISO"}
  ],
  "research_summary": "2-3 paragraph text...",
  "flight_options": [
    {"airline": "BA", "price": 850, "selected": true},
    {"airline": "AA", "price": 920, "selected": false}
  ],
  "hotel_options": {
    "Edinburgh": [
      {"name": "Balmoral", "price_per_night": 250, "selected": true},
      {"name": "Radisson", "price_per_night": 180, "selected": false}
    ]
  },
  "daily_itinerary": [...],
  "estimated_total": 4500,
  "voygent_margin": "15-20%",
  "disclaimer": "All prices estimated for planning purposes. Final quote by travel agent."
}
```

**2. PDF Export** (Human-Readable):
- Page 1: Traveler Info + Trip Summary
- Page 2: Research Summary + Map
- Page 3-N: Daily Itinerary with "Why We Suggest"
- Page N+1: Flight/Hotel Options (selected highlighted)
- Page N+2: Cost Breakdown + Disclaimers

**Library for PDF**: Use `jsPDF` or `pdfmake` (client-side generation) or Cloudflare Workers PDF API

### Code References
- **Current Handoff**: `functions/api/handoff/[id].ts`
- **Database Schema**: `DATABASE_SCHEMA.md` (will add handoff_documents)
- **Trips Schema**: Line 24-45 (themed_trips with handoff_json field - will deprecate)

---

## Research Question 6: Template CRUD Admin UI

### Current Admin Infrastructure

**Admin Dashboard**: `public/admin-dashboard.html`
- ✅ JWT authentication (Feature 006)
- ✅ Live metrics display
- ✅ Recent errors table
- ✅ Role-based access control (super_admin, agency_admin)

**Template Endpoints**:
1. **GET /api/templates** (`functions/api/templates/index.ts`)
   - Returns active templates
   - Used by frontend template selector

2. **GET /api/templates/:id** (`functions/api/templates/[id].ts`)
   - Returns single template details
   - Supports full template data

3. **Admin Build Theme** (`functions/api/admin/build-theme.ts`)
   - Creates new theme from form data
   - Generates prompts using AI

4. **Admin Generate Prompt** (`functions/api/admin/generate-prompt.ts`)
   - AI-assisted prompt generation
   - Helps admins write better prompts

### What's Missing for Extended Fields

**Current admin.html UI** supports:
- ✅ Basic fields (name, description, icon)
- ✅ Prompts (intake_prompt, options_prompt)
- ✅ JSON arrays (required_fields, optional_fields, example_inputs)
- ❌ NEW: 16 extended template fields

**Needed UI Enhancements**:

1. **Workflow Tab** (new section):
   - `workflow_prompt` (textarea)
   - `daily_activity_prompt` (textarea)
   - `why_we_suggest_prompt` (textarea)

2. **Configuration Tab**:
   - `number_of_options` (number input, 1-10)
   - `trip_days_min` (number)
   - `trip_days_max` (number)
   - `luxury_levels` (tag input for JSON array)
   - `activity_levels` (tag input for JSON array)
   - `transport_preferences` (tag input for JSON array)

3. **Search & UI Tab**:
   - `search_placeholder` (text input)
   - `search_help_text` (textarea)
   - `progress_messages` (JSON editor with key-value pairs)

4. **Provider Instructions Tab**:
   - `tour_search_instructions` (textarea)
   - `hotel_search_instructions` (textarea)
   - `flight_search_instructions` (textarea)

**Implementation Approach**:
- Use tabs/accordion to organize 16 new fields
- Add JSON schema validation before save
- Provide "Import from existing template" feature
- Add prompt preview/test functionality

### Code References
- **Admin Dashboard**: `public/admin-dashboard.html`
- **Templates API**: `functions/api/templates/index.ts`, `functions/api/templates/[id].ts`
- **Build Theme**: `functions/api/admin/build-theme.ts`
- **Generate Prompt**: `functions/api/admin/generate-prompt.ts`

---

## Research Question 7: Provider Cost Optimization

### Current Implementation (✅ Fully Deployed)

**File**: `functions/api/lib/provider.ts` (318 lines)

**Cascade Logic**:
```typescript
// Priority: Z.AI (cheapest) > OpenAI > Anthropic
if (env.ZAI_API_KEY) {
  return { provider: 'zai', model: 'llama-3.3-70b', apiKey: env.ZAI_API_KEY };
} else if (env.OPENAI_API_KEY) {
  return { provider: 'openai', model: mode === 'cheap' ? 'gpt-4o-mini' : 'gpt-4o', apiKey: env.OPENAI_API_KEY };
} else if (env.ANTHROPIC_API_KEY) {
  return { provider: 'anthropic', model: mode === 'cheap' ? 'claude-3-haiku-20240307' : 'claude-3-5-sonnet-20241022', apiKey: env.ANTHROPIC_API_KEY };
}
```

**Cost per 1M Tokens**:
| Provider | Model | Input | Output | Total (avg) |
|----------|-------|-------|--------|-------------|
| Z.AI | llama-3.3-70b | $0.05 | $0.08 | **$0.065** (cheapest) |
| OpenAI | gpt-4o-mini | $0.15 | $0.60 | $0.375 |
| OpenAI | gpt-4o | $2.50 | $10.00 | $6.25 |
| Anthropic | claude-3-haiku | $0.25 | $1.25 | $0.75 |
| Anthropic | claude-3-5-sonnet | $3.00 | $15.00 | $9.00 |

**Fallback Mechanism**:
1. Try Z.AI (primary)
2. If Z.AI fails → OpenAI (fallback #1)
3. If OpenAI fails → Anthropic (fallback #2)
4. If all fail → throw error

**Threshold Logic**:
- Context < 600 tokens → Use cheap model
- Context ≥ 600 tokens → Use smart model
- Force mode available: `selectProvider(tokens, env, 'cheap' | 'smart')`

### Recent Improvements (Commit 9bf8f78)
- Added Z.AI as primary provider (cheapest)
- Implemented cascading fallbacks
- Error handling with automatic provider switching
- Cost tracking in messages table

### Template-Driven Token Reduction

**Current Approach** (hard-coded prompts):
```typescript
const INTAKE_NORMALIZER = `ROLE: Heritage Trip Intake Normalizer
INPUTS MAY INCLUDE:
- Surnames and family names
- Suspected ancestral origins...
[500+ characters of instructions]`;
```

**Template-Driven Approach** (database prompts):
```typescript
// Fetch from trip_templates table
const template = await getTemplate(templateId);
const prompt = template.intake_prompt; // Stored in DB, admin can optimize
```

**Token Savings**:
- Hard-coded: ~500 chars = 125 tokens per call
- Template-driven: Admin can reduce to 200 chars = 50 tokens (75 token savings = 60% reduction)
- With 1000 trips/day: 75,000 tokens saved/day = $0.005/day with Z.AI (scales with volume)

### Code References
- **Provider Selection**: `functions/api/lib/provider.ts` lines 40-72
- **Fallback Logic**: `functions/api/lib/provider.ts` lines 82-112
- **Cost Tracking**: `functions/api/lib/db.ts` (saveMessage function)
- **Z.AI Integration**: Commit `9bf8f78`
- **Costs Dictionary**: `functions/api/lib/provider.ts` lines 27-33

---

## Research Question 8: Trip Options Workflow

### Current Workflow

**File**: `functions/api/trips/index.ts` (POST /api/trips)

**Hard-Coded Logic**:
```typescript
// Generate up to 4 options (hard-coded)
const OPTIONS_GENERATOR = `Create between 2 and 4 distinct Heritage trip options...`;

// Call provider
const response = await callProvider(provider, {
  systemPrompt: OPTIONS_GENERATOR,
  userPrompt: `Ancestry context: ${JSON.stringify(ancestry)}`,
  maxTokens: 900,
  temperature: 0.8
});

// Parse JSON array of options
const options = JSON.parse(response.content);
// Expect: [option1, option2, option3, option4]
```

**Current Prompt** (`functions/api/lib/prompts.ts`):
```
Create between 2 and 4 distinct Heritage trip options based on the ancestry context.

For EACH option:
1. Choose a core destination region
2. Suggest 2-4 key cities/towns
3. Estimate 5-10 days duration
4. Include budget band (2000-8000 USD)
5. Write "Why we chose this" (1-2 sentences)

OUTPUT JSON ARRAY ONLY. No markdown, no prose.
```

### Template-Driven Approach

**Config Fields** (from templates table):
- `number_of_options INTEGER DEFAULT 3` → Controls how many options to generate
- `trip_days_min INTEGER DEFAULT 5` → Minimum duration
- `trip_days_max INTEGER DEFAULT 14` → Maximum duration
- `options_prompt TEXT` → AI instructions for option generation
- `luxury_levels TEXT` → JSON array of valid luxury options
- `activity_levels TEXT` → JSON array of valid activity levels

**Dynamic Prompt Generation**:
```typescript
// Load template
const template = await getTemplate(templateId);

// Build dynamic prompt
const dynamicPrompt = template.options_prompt
  .replace('{number_of_options}', template.number_of_options)
  .replace('{trip_days_min}', template.trip_days_min)
  .replace('{trip_days_max}', template.trip_days_max)
  .replace('{luxury_levels}', JSON.stringify(template.luxury_levels))
  .replace('{input}', userInput)
  .replace('{research_results}', researchSummary);

// Call provider with template's maxTokens config
const response = await callProvider(provider, {
  systemPrompt: dynamicPrompt,
  maxTokens: template.max_output_tokens || 900,
  temperature: 0.8
});
```

**Benefits**:
1. **Flexibility**: Admin can create template with `number_of_options=1` for "single best trip" theme
2. **Consistency**: Luxury culinary template can enforce different day ranges (3-7 days) vs. heritage (7-14 days)
3. **Specialization**: Each template tailors options generation to its theme
4. **No Code Changes**: Adding new template with 10 options requires zero code deployment

### Migration Strategy

1. **Backwards Compatibility**:
   - Default `number_of_options=4` for existing templates
   - Fall back to hard-coded prompts if template fields are null

2. **Gradual Rollout**:
   - Phase 1: Add template fields, use fallbacks
   - Phase 2: Update templates with optimized prompts
   - Phase 3: Remove hard-coded prompts from codebase

3. **Validation**:
   - Enforce: `1 <= number_of_options <= 10`
   - Enforce: `trip_days_min < trip_days_max`
   - Enforce: `options_prompt` contains required template variables

### Code References
- **Current Options Generation**: `functions/api/trips/index.ts`
- **Hard-Coded Prompt**: `functions/api/lib/prompts.ts` (OPTIONS_GENERATOR export)
- **Template Loader**: `functions/api/lib/trip-templates.ts`
- **Provider Call**: `functions/api/lib/provider.ts` (callProvider function)

---

## Architecture Decisions & Recommendations

### ADR-001: Template Schema Extensions
**Decision**: Add 16 new columns to `trip_templates` table as nullable fields with sensible defaults.

**Rationale**:
- Backwards compatible (existing templates work)
- Allows gradual migration
- Admin can progressively optimize templates

**Alternatives Considered**:
- ❌ Separate `template_config` table (normalized) → Rejected: Over-engineering, adds JOIN complexity
- ❌ JSON blob for all config → Rejected: Harder to query, no schema validation

**Implementation**: Migration `020_extend_trip_templates.sql`

---

### ADR-002: A/B Comparison Removal Strategy
**Decision**: Deprecate endpoint with 410 Gone, remove UI immediately, eventual schema cleanup.

**Rationale**:
- Graceful degradation for any clients still calling `/api/trips/:id/ab`
- Immediate UX improvement (no confusing A/B UI)
- Database field kept for data migration/recovery

**Alternatives Considered**:
- ❌ Hard delete everything → Rejected: Breaks existing trips
- ❌ Keep endpoint indefinitely → Rejected: Technical debt, confuses users

**Timeline**:
- Week 1: Deprecate endpoint, remove UI
- Week 2-4: Monitor error logs for /ab calls
- Week 5: Delete endpoint file if zero usage

---

### ADR-003: Diagnostic Window Implementation
**Decision**: Polling-based updates (GET /api/admin/logs every 2s) with correlation_id filtering.

**Rationale**:
- Simple implementation (no WebSocket/SSE complexity)
- Works with Cloudflare Workers (no persistent connections)
- 2s latency acceptable for diagnostics (not mission-critical)

**Alternatives Considered**:
- ❌ WebSockets → Rejected: Not supported in Cloudflare Workers
- ❌ Server-Sent Events (SSE) → Rejected: Limited browser support, added complexity

**Implementation**: `public/components/diagnostic-window.html` + `public/js/diagnostics.js`

---

### ADR-004: Handoff Document Storage
**Decision**: New `handoff_documents` table with complete trip context, exportable as PDF/JSON.

**Rationale**:
- Complete audit trail (chat history, all options shown)
- Agent gets full context for accurate quoting
- Supports B2B2C business model (travel agent integration)

**Alternatives Considered**:
- ❌ Extend `themed_trips.handoff_json` → Rejected: Field too large, complex queries
- ❌ External document storage (S3) → Rejected: D1 sufficient, keep data in one place

**Migration**: Migration `021_handoff_documents.sql` creates new table

---

### ADR-005: Provider Cost Optimization
**Decision**: Keep current Z.AI → OpenAI → Anthropic cascade, enhance with template-driven token reduction.

**Rationale**:
- Z.AI already deployed and working (commit 9bf8f78)
- Template-driven prompts reduce tokens by ~60%
- Cascade provides reliability (automatic fallback)

**Enhancements**:
- Add `max_output_tokens` to template config
- Log provider selection reason in diagnostics
- Track cost savings from template optimization

**No changes needed**: Current implementation sufficient, just leverage it more

---

### ADR-006: Trip Options Workflow
**Decision**: Replace hard-coded `OPTIONS_GENERATOR` with `template.options_prompt`, use `template.number_of_options` for dynamic count.

**Rationale**:
- Allows per-template customization (1 option for "best fit", 10 for "explore all")
- Admin can optimize prompts for token efficiency
- Zero code changes to add new templates

**Migration**:
- Update `functions/api/trips/index.ts` to load template
- Replace hard-coded prompt with template.options_prompt
- Use template.number_of_options in prompt variable replacement

**Backwards Compatibility**: If template fields null, fallback to hard-coded values

---

## Risk Analysis & Mitigation

### Risk 1: Template Validation ⚠️ Medium
**Issue**: Malformed JSON in template fields breaks trip generation.

**Mitigation**:
- Add strict JSON schema validation in `/api/templates` PUT/POST
- Provide template preview/test functionality in admin UI
- Default to sensible fallbacks if template corrupted

### Risk 2: Handoff Document Size 📊 Medium
**Issue**: Chat history + all options could exceed D1 field limits (1MB per field).

**Mitigation**:
- Limit chat history to last 100 messages
- Compress JSON before storage (gzip)
- Paginate large handoff exports (multi-page PDF)

### Risk 3: Diagnostic Window Performance 🐌 Low
**Issue**: Polling every 2s could overwhelm logs API.

**Mitigation**:
- Add rate limiting (max 1 req/2s per user)
- Use correlation_id index for fast queries
- Auto-pause polling if window minimized

### Risk 4: Amadeus API Rate Limits ⏱️ Medium
**Issue**: 10 calls/sec limit could be exceeded with concurrent users.

**Mitigation**:
- Aggressive caching (24h TTL for flights/hotels)
- Queue requests if approaching limit
- Fallback to manual pricing if quota exceeded

### Risk 5: Migration Complexity 🔧 High
**Issue**: 16 new template columns + handoff table changes risk breaking existing system.

**Mitigation**:
- All new fields nullable (backwards compatible)
- Run migration on test DB first (`voygent-test`)
- Keep rollback migration ready
- Feature flag new functionality (gradual rollout)

### Risk 6: A/B Removal Impact 👥 Low
**Issue**: Some users might still expect A/B variants.

**Mitigation**:
- Clear deprecation notice in UI
- Monitor error logs for /ab endpoint calls
- Provide alternative: multiple trip options achieves same goal

---

## Implementation Priorities

### Phase 1: Foundation (Critical Path) 🚀
1. ✅ Template schema extension (Migration 020)
2. ✅ Remove A/B comparison (deprecate endpoint, remove UI)
3. ✅ Add correlation_id to trip creation

### Phase 2: Core Features 🔨
4. ⏳ Handoff documents table (Migration 021)
5. ⏳ Template-driven options workflow
6. ⏳ Diagnostic window component
7. ⏳ Extended template admin UI

### Phase 3: Polish & Testing 🎨
8. ⏳ PDF export for handoff docs
9. ⏳ Amadeus pricing with 15-20% margin
10. ⏳ End-to-end testing with multiple templates

### Phase 4: Optimization 📈
11. ⏳ Provider cost tracking dashboard
12. ⏳ Template prompt optimization
13. ⏳ Performance monitoring

---

## Key Metrics for Success

1. **Template Flexibility**: Zero code changes to add new trip type ✅
2. **Cost Reduction**: 40-60% token savings from template optimization 📊
3. **Diagnostic Visibility**: <2s lag for real-time logs ⏱️
4. **Handoff Completeness**: 100% of required context in document 📋
5. **A/B Removal**: Zero variant references in codebase after Phase 1 🗑️
6. **Amadeus Pricing**: <5s response time, 24h cache hit rate >80% ⚡

---

## Next Steps

1. **Generate Phase 1 Artifacts**:
   - `data-model.md` (extended schemas with ADR rationale)
   - `contracts/` (OpenAPI specs for new endpoints)
   - `quickstart.md` (5 implementation scenarios)

2. **Re-evaluate Constitution**:
   - Verify critical path alignment
   - Confirm cheap-first policy compliance
   - Validate no inventory claims

3. **Await /tasks Command**:
   - Break down into ~70 implementation tasks
   - Assign dependencies and priority
   - Generate tasks.md

---

## Appendix: Code File Inventory

### Files to Modify
- ✏️ `functions/api/trips/index.ts` (use template.options_prompt)
- ✏️ `functions/api/lib/provider.ts` (add cost tracking logs)
- ✏️ `public/index.html` (remove variant UI, add diagnostic window)
- ✏️ `public/admin-dashboard.html` (extend template editor)

### Files to Create
- 📄 `migrations/020_extend_trip_templates.sql`
- 📄 `migrations/021_handoff_documents.sql`
- 📄 `functions/api/handoff/[id]/generate.ts` (new handoff logic)
- 📄 `public/js/diagnostics.js`
- 📄 `public/components/diagnostic-window.html`

### Files to Delete
- 🗑️ `functions/api/trips/[id]/ab.ts` (after deprecation period)
- 🗑️ `prompts/heritage.option.selector_to_ab.txt` (hard-coded A/B prompt)

---

**Research Complete** ✅
**Ready for Phase 1 Design**
