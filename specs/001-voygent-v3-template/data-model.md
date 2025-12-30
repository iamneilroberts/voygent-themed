# Phase 1: Data Model

**Feature**: VoyGent V3 Template-Driven Trip Planner
**Date**: 2025-10-09
**Database**: Cloudflare D1 (SQLite)

## Entity Relationship Overview

```
trip_templates (1) ─────< themed_trips (N)
                        (template_id FK)
```

**Relationship**: One trip template can be used for many trips. Each trip is based on exactly one template.

---

## Entities

### 1. trip_templates

**Purpose**: Defines all behavior for a trip theme (Heritage, Wine & Food, Film Locations, etc.). Stores research prompts, destination criteria, trip building instructions, UI text, and constraints. NO theme-specific logic exists in code—all behavior driven by these template records.

**Table Definition**:
```sql
CREATE TABLE trip_templates (
  -- Identity
  id TEXT PRIMARY KEY,              -- Format: '{theme-slug}-{version}' e.g., 'heritage-001', 'wine-002'
  name TEXT NOT NULL,               -- Display name: 'Heritage & Ancestry', 'Wine & Food'
  description TEXT NOT NULL,        -- Homepage card description (2-3 sentences)
  icon TEXT NOT NULL,               -- Emoji icon: '🌳', '🍷', '🎬'
  featured INTEGER DEFAULT 0,       -- 1 = show on homepage (max 5 featured)

  -- UI Text (shown to users)
  search_placeholder TEXT,          -- Input placeholder: 'E.g., Sullivan family from Cork, Ireland'
  search_help_text TEXT,            -- Help text below input (optional)
  progress_messages TEXT,           -- JSON: { "researching": "Discovering heritage sites...", "building": "Creating your trip..." }

  -- Phase 1: Research Prompts (guide AI destination research)
  research_query_template TEXT,              -- Template for web search queries: '{surname} family origin, {country} heritage sites'
  destination_criteria_prompt TEXT,          -- What makes a good destination: 'Prioritize: ancestral towns, genealogy centers, heritage museums'
  research_synthesis_prompt TEXT,            -- How to present findings: 'List 2-4 destinations with historical significance, travel logistics, key sites'
  destination_confirmation_prompt TEXT,      -- What to ask user: 'Which destinations interest you? How many days? Any must-sees?'

  -- Phase 2: Trip Building Prompts (guide AI itinerary creation)
  intake_prompt TEXT NOT NULL,               -- Overall trip planning guidance
  options_prompt TEXT NOT NULL,              -- How to create trip options: 'Create {number_of_options} itineraries balancing cost, experience, pacing'
  daily_activity_prompt TEXT,                -- How to structure daily activities
  why_we_suggest_prompt TEXT,                -- Rationale generation for recommendations
  workflow_prompt TEXT,                      -- Step-by-step trip building instructions

  -- Constraints (define trip parameters)
  number_of_options INTEGER DEFAULT 3,       -- How many trip options to generate (1-10)
  trip_days_min INTEGER DEFAULT 3,           -- Minimum trip duration
  trip_days_max INTEGER DEFAULT 21,          -- Maximum trip duration
  luxury_levels TEXT,                        -- JSON: ['Budget', 'Comfort', 'Luxury']
  activity_levels TEXT,                      -- JSON: ['Relaxed', 'Moderate', 'Active']
  transport_preferences TEXT,                -- JSON: ['flight', 'train', 'car rental']

  -- API Search Instructions (guide booking API queries)
  tour_search_instructions TEXT,             -- Keywords/filters for Viator: 'heritage tours, genealogy experiences'
  hotel_search_instructions TEXT,            -- Preferences for Amadeus: 'city center, historic districts'
  flight_search_instructions TEXT,           -- Flight preferences: 'minimize layovers, prefer direct'

  -- Field Configuration
  required_fields TEXT,                      -- JSON: ['duration', 'travelers', 'departure_airport']
  optional_fields TEXT,                      -- JSON: ['departure_date', 'budget']
  example_inputs TEXT,                       -- JSON: ['Sullivan family from Cork, Ireland', 'Johnson heritage in Virginia']

  -- Metadata
  is_active INTEGER DEFAULT 1,               -- 0 = hidden from users, 1 = visible
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_templates_featured ON trip_templates(featured, is_active);
```

**Validation Rules**:
- `id` must be unique, lowercase, hyphenated format
- `name` and `description` cannot be empty
- `featured` templates limited to 5 active at once (enforced in application)
- `number_of_options` between 1-10
- `trip_days_min` < `trip_days_max`
- JSON fields must be valid JSON (validated on insert/update)
- At least one of `research_query_template`, `destination_criteria_prompt`, `options_prompt` must be non-null

**State Transitions**: N/A (templates are mostly static configuration)

**Example Record**:
```json
{
  "id": "heritage-001",
  "name": "Heritage & Ancestry",
  "description": "Trace your family roots and explore ancestral homelands. Visit genealogy centers, historical archives, and heritage sites connected to your family history.",
  "icon": "🌳",
  "featured": 1,
  "search_placeholder": "E.g., Sullivan family from Cork, Ireland",
  "search_help_text": "Enter your family name and known origin location",
  "progress_messages": "{\"researching\": \"Discovering heritage sites...\", \"building\": \"Planning your ancestral journey...\"}",
  "research_query_template": "{surname} family origin, {country} {region} heritage sites, genealogy centers {region}",
  "destination_criteria_prompt": "Prioritize: ancestral towns, family castles, heritage museums, genealogy research centers, local historical societies, cemeteries with family names",
  "research_synthesis_prompt": "Present 2-4 destinations with: 1) Historical significance to family, 2) Travel logistics (distance, accommodation), 3) Key sites (archives, museums, landmarks)",
  "destination_confirmation_prompt": "Which destinations interest you most? How many days would you like to spend exploring? Any specific family history aspects to prioritize?",
  "intake_prompt": "You are planning a heritage and ancestry trip. Focus on personal connection, historical accuracy, and genealogy research opportunities.",
  "options_prompt": "Create {number_of_options} trip options for {confirmed_destinations} with {duration} days. Balance genealogy research time, sightseeing, and relaxation. Include heritage tour recommendations.",
  "daily_activity_prompt": "Each day should include: morning genealogy research or heritage site visit, afternoon cultural experience, evening free time for reflection or local dining.",
  "number_of_options": 3,
  "trip_days_min": 5,
  "trip_days_max": 14,
  "luxury_levels": "[\"Budget\", \"Comfort\", \"Premium\"]",
  "activity_levels": "[\"Relaxed\", \"Moderate\"]",
  "transport_preferences": "[\"car rental\", \"train\", \"guided tours\"]",
  "tour_search_instructions": "heritage tours, genealogy experiences, historical walking tours, family history research",
  "hotel_search_instructions": "city center, historic districts, near libraries/archives",
  "flight_search_instructions": "prefer direct flights, minimize travel time to maximize research time",
  "required_fields": "[\"duration\", \"travelers\", \"departure_airport\"]",
  "optional_fields": "[\"known_family_locations\", \"research_goals\"]",
  "example_inputs": "[\"Sullivan family from Cork, Ireland\", \"Johnson heritage in Virginia\", \"Garcia ancestors in Madrid, Spain\"]",
  "is_active": 1
}
```

---

### 2. themed_trips

**Purpose**: Stores a user's trip planning session, including full conversation history, Phase 1 research results, Phase 2 trip options, and final selected itinerary. Tracks conversation state for two-phase workflow enforcement.

**Table Definition**:
```sql
CREATE TABLE themed_trips (
  -- Identity
  id TEXT PRIMARY KEY,                      -- UUID v4
  user_id TEXT,                             -- NULL for anonymous users, FK to users table (future)
  template_id TEXT NOT NULL,                -- FK to trip_templates.id
  correlation_id TEXT,                      -- For tracking related operations across services

  -- Chat Conversation (Constitution §2.2 required)
  chat_history TEXT,                        -- JSON: [{role: 'user'|'assistant', content: string, timestamp: unix}]

  -- Phase 1: Destination Research (Constitution §2.2 required)
  research_destinations TEXT,               -- JSON: [{name, geographic_context, key_sites[], travel_logistics_note, rationale, estimated_days}]
  destinations_confirmed INTEGER DEFAULT 0, -- Phase gate: 0 = not confirmed, 1 = confirmed (triggers Phase 2)
  confirmed_destinations TEXT,              -- JSON: ['Cork', 'Kinsale', 'Killarney'] - user's final selections

  -- User Preferences
  preferences_json TEXT,                    -- JSON: {duration: '7-10 days', travelers_adults: 2, travelers_children: 0, luxury_level: 'Comfort', activity_level: 'Moderate', departure_airport: 'JFK', departure_date: 'flexible'}

  -- Phase 2: Trip Building
  intake_json TEXT,                         -- JSON: structured user requirements extracted from chat
  research_summary TEXT,                    -- Human-readable summary of research findings
  options_json TEXT,                        -- JSON: [{option_index, total_cost_usd, flights: {...}, hotels: [...], tours: [...], itinerary_highlights: string}]
  selected_option_index INTEGER,            -- Which option user selected (1-based, matches option_index)
  selected_flights TEXT,                    -- JSON: detailed flight data for selected option
  selected_hotels TEXT,                     -- JSON: detailed hotel data for selected option
  selected_transport TEXT,                  -- JSON: ground transportation details
  selected_tours TEXT,                      -- JSON: tour/activity details
  final_itinerary TEXT,                     -- JSON: [{day, date, activities[], hotel, meals_included, estimated_cost_usd}]
  total_cost_usd REAL,                      -- Total trip cost including 15% margin

  -- User-Facing Progress (Constitution §2.2 required)
  status TEXT DEFAULT 'chat',               -- State machine: 'chat' → 'researching' → 'awaiting_confirmation' → 'building_trip' → 'options_ready' → 'option_selected' → 'handoff_sent'
  progress_step TEXT,                       -- Current step description for users
  progress_message TEXT,                    -- User-friendly message: 'Researching destinations...', 'Finding flights...'
  progress_percent INTEGER DEFAULT 0,       -- Progress bar (0-100)

  -- Travel Agent Handoff
  agency_id TEXT,                           -- FK to agencies table (future)
  handoff_json TEXT,                        -- JSON: complete trip details for agent
  handoff_sent_at INTEGER,                  -- Unix timestamp

  -- Admin Telemetry (NOT user-visible)
  ai_cost_usd REAL DEFAULT 0.0,             -- Cumulative AI API costs
  api_cost_usd REAL DEFAULT 0.0,            -- Cumulative booking API costs (Amadeus, Viator)
  telemetry_logs TEXT,                      -- JSON: [{timestamp, event, provider, tokens_in, tokens_out, cost, duration_ms, error}]

  -- Metadata
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_trips_template ON themed_trips(template_id);
CREATE INDEX idx_trips_status ON themed_trips(status);
CREATE INDEX idx_trips_user ON themed_trips(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_trips_created ON themed_trips(created_at DESC);
```

**Validation Rules**:
- `template_id` must reference valid `trip_templates.id`
- `destinations_confirmed` must be 0 or 1 (boolean)
- `status` must be one of: 'chat', 'researching', 'awaiting_confirmation', 'building_trip', 'options_ready', 'option_selected', 'handoff_sent'
- `selected_option_index` must match an `option_index` in `options_json` if set
- `progress_percent` between 0-100
- JSON fields must be valid JSON
- `destinations_confirmed` cannot be set to 1 unless `confirmed_destinations` is non-null

**State Transitions**:
```
chat (initial)
  ↓ User enters trip request
researching (Phase 1: web search, AI synthesis)
  ↓ AI presents destination recommendations
awaiting_confirmation (waiting for user to confirm destinations)
  ↓ User confirms destinations, sets destinations_confirmed=1
building_trip (Phase 2: calling Amadeus, Viator APIs)
  ↓ APIs return results, AI generates trip options
options_ready (2-4 trip options available)
  ↓ User selects one option
option_selected (detailed itinerary visible)
  ↓ User clicks "Get a free quote"
handoff_sent (handoff document sent to agent)
```

**Example Record (After Phase 1)**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": null,
  "template_id": "heritage-001",
  "correlation_id": "trace-abc123",
  "chat_history": "[{\"role\":\"user\",\"content\":\"Sullivan family from Cork, Ireland\",\"timestamp\":1696723200},{\"role\":\"assistant\",\"content\":\"Based on Sullivan family history, I recommend: Cork City (origin hub), Kinsale (historic port), Blarney (castle heritage). Which destinations interest you?\",\"timestamp\":1696723205}]",
  "research_destinations": "[{\"name\":\"Cork City\",\"geographic_context\":\"Primary origin\",\"key_sites\":[\"Cork City Library archives\",\"St. Fin Barre's Cathedral\"],\"travel_logistics_note\":\"International airport, walkable city center\",\"rationale\":\"Sullivan family historical records\",\"estimated_days\":4},{\"name\":\"Kinsale\",\"geographic_context\":\"30 min south of Cork\",\"key_sites\":[\"Charles Fort\",\"Maritime museum\"],\"rationale\":\"Sullivan military history\",\"estimated_days\":2}]",
  "destinations_confirmed": 0,
  "confirmed_destinations": null,
  "preferences_json": "{\"duration\":\"7-10 days\",\"travelers_adults\":2,\"travelers_children\":0,\"luxury_level\":\"Comfort\",\"activity_level\":\"Moderate\",\"departure_airport\":\"JFK\"}",
  "status": "awaiting_confirmation",
  "progress_message": "Awaiting your destination selection...",
  "progress_percent": 40,
  "ai_cost_usd": 0.00023,
  "api_cost_usd": 0.0,
  "telemetry_logs": "[{\"timestamp\":1696723203,\"event\":\"web_search\",\"provider\":\"Serper\",\"query\":\"Sullivan Cork heritage\",\"results\":8,\"cost\":0.00005,\"duration_ms\":342}]",
  "created_at": 1696723200,
  "updated_at": 1696723205
}
```

---

## JSON Field Schemas

### chat_history
```typescript
type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;  // Unix timestamp
};

type ChatHistory = ChatMessage[];
```

### research_destinations
```typescript
type Destination = {
  name: string;
  geographic_context: string;  // e.g., '30 min south of Cork'
  key_sites: string[];
  travel_logistics_note?: string;
  rationale: string;  // Why this destination matches the theme
  estimated_days: number;
};

type ResearchDestinations = Destination[];
```

### confirmed_destinations
```typescript
type ConfirmedDestinations = string[];  // e.g., ['Cork', 'Kinsale', 'Killarney']
```

### preferences_json
```typescript
type Preferences = {
  duration: string;  // e.g., '7-10 days'
  travelers_adults: number;
  travelers_children: number;
  luxury_level: 'Budget' | 'Comfort' | 'Luxury';
  activity_level: 'Relaxed' | 'Moderate' | 'Active';
  departure_airport: string;  // IATA code or city name
  departure_date?: string;  // ISO date or 'flexible'
};
```

### options_json
```typescript
type TripOption = {
  option_index: number;
  total_cost_usd: number;  // Includes 15% margin
  flights: {
    outbound: { airline: string; route: string; departure: string; arrival: string; };
    return: { airline: string; route: string; departure: string; arrival: string; };
  };
  hotels: Array<{
    city: string;
    name: string;
    rating: number;
    nights: number;
    cost_per_night_usd: number;
  }>;
  tours: Array<{
    city: string;
    name: string;
    duration: string;
    cost_usd: number;
  }>;
  itinerary_highlights: string;  // Brief summary
};

type TripOptions = TripOption[];
```

### final_itinerary
```typescript
type DailyItinerary = {
  day: number;
  date: string;  // ISO date
  city: string;
  activities: Array<{
    time: string;  // e.g., 'Morning', '2:00 PM'
    description: string;
    type: 'tour' | 'meal' | 'free time' | 'travel';
    cost_usd?: number;
  }>;
  hotel: {
    name: string;
    address: string;
    check_in?: string;
    check_out?: string;
  };
  meals_included: string[];  // e.g., ['Breakfast', 'Lunch']
  estimated_cost_usd: number;
};

type FinalItinerary = DailyItinerary[];
```

### telemetry_logs
```typescript
type TelemetryLog = {
  timestamp: number;
  event: string;  // e.g., 'web_search', 'ai_synthesis', 'amadeus_flight_search'
  provider: string;  // e.g., 'Serper', 'Z.AI', 'Amadeus'
  tokens_in?: number;
  tokens_out?: number;
  cost: number;
  duration_ms: number;
  error?: string;
  metadata?: Record<string, any>;
};

type TelemetryLogs = TelemetryLog[];
```

---

## Database Migrations

**Migration 0001: Create trip_templates table**
```sql
-- db/migrations/0001_init_trip_templates.sql
CREATE TABLE trip_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  featured INTEGER DEFAULT 0,
  search_placeholder TEXT,
  search_help_text TEXT,
  progress_messages TEXT,
  research_query_template TEXT,
  destination_criteria_prompt TEXT,
  research_synthesis_prompt TEXT,
  destination_confirmation_prompt TEXT,
  intake_prompt TEXT NOT NULL,
  options_prompt TEXT NOT NULL,
  daily_activity_prompt TEXT,
  why_we_suggest_prompt TEXT,
  workflow_prompt TEXT,
  number_of_options INTEGER DEFAULT 3,
  trip_days_min INTEGER DEFAULT 3,
  trip_days_max INTEGER DEFAULT 21,
  luxury_levels TEXT,
  activity_levels TEXT,
  transport_preferences TEXT,
  tour_search_instructions TEXT,
  hotel_search_instructions TEXT,
  flight_search_instructions TEXT,
  required_fields TEXT,
  optional_fields TEXT,
  example_inputs TEXT,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_templates_featured ON trip_templates(featured, is_active);
```

**Migration 0002: Create themed_trips table**
```sql
-- db/migrations/0002_init_themed_trips.sql
CREATE TABLE themed_trips (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  template_id TEXT NOT NULL,
  correlation_id TEXT,
  chat_history TEXT,
  research_destinations TEXT,
  destinations_confirmed INTEGER DEFAULT 0,
  confirmed_destinations TEXT,
  preferences_json TEXT,
  intake_json TEXT,
  research_summary TEXT,
  options_json TEXT,
  selected_option_index INTEGER,
  selected_flights TEXT,
  selected_hotels TEXT,
  selected_transport TEXT,
  selected_tours TEXT,
  final_itinerary TEXT,
  total_cost_usd REAL,
  status TEXT DEFAULT 'chat',
  progress_step TEXT,
  progress_message TEXT,
  progress_percent INTEGER DEFAULT 0,
  agency_id TEXT,
  handoff_json TEXT,
  handoff_sent_at INTEGER,
  ai_cost_usd REAL DEFAULT 0.0,
  api_cost_usd REAL DEFAULT 0.0,
  telemetry_logs TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_trips_template ON themed_trips(template_id);
CREATE INDEX idx_trips_status ON themed_trips(status);
CREATE INDEX idx_trips_user ON themed_trips(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_trips_created ON themed_trips(created_at DESC);
```

**Seed Data: 5 Featured Templates + "Plan My Trip"**
```sql
-- db/seeds/0001_seed_templates.sql
INSERT INTO trip_templates (id, name, description, icon, featured, ...) VALUES
  ('heritage-001', 'Heritage & Ancestry', '...', '🌳', 1, ...),
  ('wine-002', 'Wine & Food', '...', '🍷', 1, ...),
  ('film-003', 'Film & TV Locations', '...', '🎬', 1, ...),
  ('history-004', 'Historical Events', '...', '📜', 1, ...),
  ('adventure-005', 'Adventure & Outdoor', '...', '🏔️', 1, ...),
  ('generic-999', 'Plan My Trip', '...', '✈️', 0, ...);
```

---

**Next**: Generate API contracts (OpenAPI specs for REST endpoints)
