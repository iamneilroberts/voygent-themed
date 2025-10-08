# Data Model: Template-Driven Trip System

## Overview
This document specifies the extended database schema for the prompt-driven template system, including all new columns, validation rules, indexes, and relationships.

---

## Extended Tables

### 1. `trip_templates` (Extended)

**Purpose**: Store all template configuration including prompts, UI verbiage, workflow control, and provider instructions.

#### New Columns (16 total)

**UI Verbiage (3 columns)**
```sql
search_placeholder TEXT DEFAULT 'Enter your destination or theme...',
search_help_text TEXT DEFAULT 'Describe what kind of trip you''re looking for',
progress_messages TEXT DEFAULT NULL  -- JSON array: ["Researching...", "Analyzing options...", "Building your trip..."]
```

**Workflow Control (6 columns)**
```sql
workflow_prompt TEXT DEFAULT NULL,  -- Master prompt controlling trip generation workflow
daily_activity_prompt TEXT DEFAULT NULL,  -- Prompt for generating daily itinerary details
why_we_suggest_prompt TEXT DEFAULT NULL,  -- Prompt for "why we suggest this" daily explanations
number_of_options INTEGER DEFAULT 4 CHECK(number_of_options BETWEEN 1 AND 10),
trip_days_min INTEGER DEFAULT 3 CHECK(trip_days_min >= 1),
trip_days_max INTEGER DEFAULT 14 CHECK(trip_days_max >= trip_days_min)
```

**Config Arrays (3 columns)**
```sql
luxury_levels TEXT DEFAULT '["budget","comfort","premium","luxury"]',  -- JSON array
activity_levels TEXT DEFAULT '["relaxed","moderate","active","intense"]',  -- JSON array
transport_preferences TEXT DEFAULT '["flights","trains","car","mixed"]'  -- JSON array
```

**Provider Instructions (4 columns)**
```sql
tour_search_instructions TEXT DEFAULT NULL,  -- How to search TripAdvisor/tours
hotel_search_instructions TEXT DEFAULT NULL,  -- Amadeus hotel search criteria
flight_search_instructions TEXT DEFAULT NULL,  -- Amadeus flight search criteria
estimate_margin_percent INTEGER DEFAULT 17 CHECK(estimate_margin_percent BETWEEN 10 AND 25)
```

#### Complete Schema
```sql
CREATE TABLE IF NOT EXISTS trip_templates (
  -- Existing columns
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT DEFAULT '✈️',
  intake_prompt TEXT NOT NULL,
  options_prompt TEXT NOT NULL,
  required_fields TEXT NOT NULL,  -- JSON array
  optional_fields TEXT DEFAULT '[]',  -- JSON array
  example_inputs TEXT DEFAULT '[]',  -- JSON array
  research_synthesis_prompt TEXT DEFAULT NULL,  -- From Migration 009
  research_query_template TEXT DEFAULT NULL,  -- From Migration 009
  is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- NEW: UI Verbiage
  search_placeholder TEXT DEFAULT 'Enter your destination or theme...',
  search_help_text TEXT DEFAULT 'Describe what kind of trip you''re looking for',
  progress_messages TEXT DEFAULT NULL,  -- JSON array

  -- NEW: Workflow Control
  workflow_prompt TEXT DEFAULT NULL,
  daily_activity_prompt TEXT DEFAULT NULL,
  why_we_suggest_prompt TEXT DEFAULT NULL,
  number_of_options INTEGER DEFAULT 4 CHECK(number_of_options BETWEEN 1 AND 10),
  trip_days_min INTEGER DEFAULT 3 CHECK(trip_days_min >= 1),
  trip_days_max INTEGER DEFAULT 14 CHECK(trip_days_max >= trip_days_min),

  -- NEW: Config Arrays
  luxury_levels TEXT DEFAULT '["budget","comfort","premium","luxury"]',
  activity_levels TEXT DEFAULT '["relaxed","moderate","active","intense"]',
  transport_preferences TEXT DEFAULT '["flights","trains","car","mixed"]',

  -- NEW: Provider Instructions
  tour_search_instructions TEXT DEFAULT NULL,
  hotel_search_instructions TEXT DEFAULT NULL,
  flight_search_instructions TEXT DEFAULT NULL,
  estimate_margin_percent INTEGER DEFAULT 17 CHECK(estimate_margin_percent BETWEEN 10 AND 25)
);
```

#### Validation Rules

1. **JSON Field Validation** (enforced in API layer):
   - `progress_messages`: Array of 1-10 strings, max 100 chars each
   - `luxury_levels`: Array of 1-6 strings, max 20 chars each
   - `activity_levels`: Array of 1-6 strings, max 20 chars each
   - `transport_preferences`: Array of 1-10 strings, max 20 chars each
   - `required_fields`: Array of 1-20 strings, max 50 chars each
   - `optional_fields`: Array of 0-20 strings, max 50 chars each

2. **Text Length Validation**:
   - `workflow_prompt`: 100-10,000 characters
   - `daily_activity_prompt`: 50-2,000 characters
   - `why_we_suggest_prompt`: 50-1,000 characters
   - `search_placeholder`: 10-100 characters
   - `search_help_text`: 10-300 characters

3. **Business Logic**:
   - At least one of `workflow_prompt`, `intake_prompt`, or `options_prompt` must be non-null
   - `estimate_margin_percent` must be 10-25 (allows 10-25% markup)
   - `trip_days_max` must be ≥ `trip_days_min`

#### Indexes
```sql
CREATE INDEX idx_templates_active ON trip_templates(is_active, created_at DESC);
CREATE INDEX idx_templates_name ON trip_templates(name);
```

---

### 2. `handoff_documents` (NEW)

**Purpose**: Store comprehensive handoff documents for travel agent quotes.

#### Schema
```sql
CREATE TABLE IF NOT EXISTS handoff_documents (
  id TEXT PRIMARY KEY,  -- UUID
  trip_id TEXT NOT NULL REFERENCES themed_trips(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,

  -- Core Data
  chat_history TEXT NOT NULL,  -- JSON: [{role, content, timestamp}] - last 100 messages
  research_summary TEXT NOT NULL,  -- Full AI research synthesis
  user_preferences TEXT NOT NULL,  -- JSON: {luxury_level, activity_level, transport, days, budget, special_requests}

  -- Trip Options
  all_flight_options TEXT NOT NULL,  -- JSON array of all flights shown
  selected_flight_id TEXT DEFAULT NULL,
  all_hotel_options TEXT NOT NULL,  -- JSON array of all hotels shown
  selected_hotel_ids TEXT DEFAULT NULL,  -- JSON array of selected hotel IDs
  all_transport_options TEXT DEFAULT NULL,  -- JSON array
  selected_transport_ids TEXT DEFAULT NULL,  -- JSON array

  -- Itinerary
  daily_itinerary TEXT NOT NULL,  -- JSON array of daily plans with why_we_suggest
  total_estimate_usd REAL NOT NULL,
  margin_percent INTEGER NOT NULL,

  -- Agent Interaction
  agent_id TEXT DEFAULT NULL,  -- Travel agent who claimed the quote
  agent_quote_usd REAL DEFAULT NULL,
  agent_notes TEXT DEFAULT NULL,
  quote_status TEXT DEFAULT 'pending' CHECK(quote_status IN ('pending', 'quoted', 'booked', 'cancelled')),

  -- Export Formats
  pdf_url TEXT DEFAULT NULL,  -- Cloudflare R2 URL
  json_export TEXT DEFAULT NULL,  -- Complete structured data

  -- Metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  quoted_at DATETIME DEFAULT NULL,
  expires_at DATETIME NOT NULL  -- 30 days from creation
);
```

#### Validation Rules

1. **JSON Field Structures**:

   **chat_history**:
   ```json
   [
     {"role": "user", "content": "...", "timestamp": "2025-10-07T10:00:00Z"},
     {"role": "assistant", "content": "...", "timestamp": "2025-10-07T10:00:15Z"}
   ]
   ```
   - Max 100 messages, chronological order
   - Each message max 10,000 chars

   **user_preferences**:
   ```json
   {
     "luxury_level": "comfort",
     "activity_level": "moderate",
     "transport": "flights",
     "days": 7,
     "adults": 2,
     "children": 0,
     "budget_usd": 5000,
     "special_requests": "vegetarian meals, accessible rooms"
   }
   ```

   **all_flight_options**:
   ```json
   [
     {
       "id": "flight_001",
       "from": "JFK",
       "to": "EDI",
       "departure": "2025-06-15T10:00:00Z",
       "arrival": "2025-06-15T22:30:00Z",
       "carrier": "Delta",
       "flight_number": "DL123",
       "class": "economy",
       "price_usd": 650,
       "duration_hours": 7.5,
       "stops": 0
     }
   ]
   ```

   **daily_itinerary**:
   ```json
   [
     {
       "day": 1,
       "date": "2025-06-15",
       "location": "Edinburgh",
       "activities": [
         {"time": "09:00", "activity": "Edinburgh Castle tour", "type": "paid_tour", "cost_usd": 35},
         {"time": "14:00", "activity": "Royal Mile walk", "type": "free", "cost_usd": 0}
       ],
       "why_we_suggest": "Edinburgh Castle provides essential historical context for your Scottish heritage research.",
       "meals": {"breakfast": "hotel", "lunch": "local cafe", "dinner": "traditional Scottish restaurant"},
       "accommodation": "Old Town Chambers",
       "daily_total_usd": 285
     }
   ]
   ```

2. **Business Logic**:
   - `expires_at` = `created_at` + 30 days
   - `margin_percent` must match template's `estimate_margin_percent`
   - `total_estimate_usd` must be > 0
   - `agent_quote_usd` must be ≥ `total_estimate_usd` (agent adds their margin)

#### Indexes
```sql
CREATE INDEX idx_handoff_trip ON handoff_documents(trip_id);
CREATE INDEX idx_handoff_agent ON handoff_documents(agent_id, quote_status);
CREATE INDEX idx_handoff_status ON handoff_documents(quote_status, created_at DESC);
CREATE INDEX idx_handoff_expires ON handoff_documents(expires_at) WHERE quote_status = 'pending';
```

---

### 3. `themed_trips` (Modified)

**Changes**: Deprecate A/B comparison field, add handoff reference.

#### Deprecated Column
```sql
variants_json TEXT DEFAULT NULL  -- DEPRECATED: Will be removed after 30-day grace period
```

#### Migration Strategy
1. Keep `variants_json` for backwards compatibility
2. Stop writing to this field immediately
3. Frontend ignores this field
4. Delete column in Migration 022 (after 30 days)

#### No Schema Changes
All new functionality uses existing columns plus relationships to `handoff_documents` table.

---

### 4. `logs` (Existing - Feature 006)

**No changes needed**. Diagnostic window uses existing structure:

```sql
CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  correlation_id TEXT NOT NULL,  -- Links all operations for one trip
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  level TEXT NOT NULL CHECK(level IN ('debug', 'info', 'warn', 'error')),
  category TEXT NOT NULL,  -- 'request', 'provider', 'amadeus', 'template', etc.
  message TEXT NOT NULL,
  metadata TEXT DEFAULT NULL,  -- JSON: additional context
  request_id TEXT DEFAULT NULL,
  user_id TEXT DEFAULT NULL,
  sanitized INTEGER DEFAULT 1 CHECK(sanitized IN (0, 1))
);

CREATE INDEX idx_logs_correlation ON logs(correlation_id, timestamp DESC);
CREATE INDEX idx_logs_category ON logs(category, timestamp DESC);
CREATE INDEX idx_logs_level ON logs(level, timestamp DESC);
```

---

## Data Relationships

```
trip_templates (1) ──< (N) themed_trips
                            │
                            │ (1)
                            │
                            ▼
                            │ (0..1)
                     handoff_documents
                            │
                            │ (N)
                            ▼
                         logs (via correlation_id)
```

### Relationship Rules

1. **Template → Trips**: One template can generate many trips
2. **Trip → Handoff**: One trip can have 0-1 handoff document (optional, created on user request)
3. **Trip → Logs**: One trip links to many logs via `correlation_id = trip.id`
4. **Handoff → Agent**: One handoff assigned to 0-1 agent

---

## Migration Plan

### Migration 020: Extend Templates
```sql
-- UI Verbiage
ALTER TABLE trip_templates ADD COLUMN search_placeholder TEXT DEFAULT 'Enter your destination or theme...';
ALTER TABLE trip_templates ADD COLUMN search_help_text TEXT DEFAULT 'Describe what kind of trip you''re looking for';
ALTER TABLE trip_templates ADD COLUMN progress_messages TEXT DEFAULT NULL;

-- Workflow Control
ALTER TABLE trip_templates ADD COLUMN workflow_prompt TEXT DEFAULT NULL;
ALTER TABLE trip_templates ADD COLUMN daily_activity_prompt TEXT DEFAULT NULL;
ALTER TABLE trip_templates ADD COLUMN why_we_suggest_prompt TEXT DEFAULT NULL;
ALTER TABLE trip_templates ADD COLUMN number_of_options INTEGER DEFAULT 4 CHECK(number_of_options BETWEEN 1 AND 10);
ALTER TABLE trip_templates ADD COLUMN trip_days_min INTEGER DEFAULT 3 CHECK(trip_days_min >= 1);
ALTER TABLE trip_templates ADD COLUMN trip_days_max INTEGER DEFAULT 14 CHECK(trip_days_max >= trip_days_min);

-- Config Arrays
ALTER TABLE trip_templates ADD COLUMN luxury_levels TEXT DEFAULT '["budget","comfort","premium","luxury"]';
ALTER TABLE trip_templates ADD COLUMN activity_levels TEXT DEFAULT '["relaxed","moderate","active","intense"]';
ALTER TABLE trip_templates ADD COLUMN transport_preferences TEXT DEFAULT '["flights","trains","car","mixed"]';

-- Provider Instructions
ALTER TABLE trip_templates ADD COLUMN tour_search_instructions TEXT DEFAULT NULL;
ALTER TABLE trip_templates ADD COLUMN hotel_search_instructions TEXT DEFAULT NULL;
ALTER TABLE trip_templates ADD COLUMN flight_search_instructions TEXT DEFAULT NULL;
ALTER TABLE trip_templates ADD COLUMN estimate_margin_percent INTEGER DEFAULT 17 CHECK(estimate_margin_percent BETWEEN 10 AND 25);

-- Indexes
CREATE INDEX idx_templates_active ON trip_templates(is_active, created_at DESC);
CREATE INDEX idx_templates_name ON trip_templates(name);
```

### Migration 021: Create Handoff Documents
```sql
CREATE TABLE IF NOT EXISTS handoff_documents (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES themed_trips(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  chat_history TEXT NOT NULL,
  research_summary TEXT NOT NULL,
  user_preferences TEXT NOT NULL,
  all_flight_options TEXT NOT NULL,
  selected_flight_id TEXT DEFAULT NULL,
  all_hotel_options TEXT NOT NULL,
  selected_hotel_ids TEXT DEFAULT NULL,
  all_transport_options TEXT DEFAULT NULL,
  selected_transport_ids TEXT DEFAULT NULL,
  daily_itinerary TEXT NOT NULL,
  total_estimate_usd REAL NOT NULL,
  margin_percent INTEGER NOT NULL,
  agent_id TEXT DEFAULT NULL,
  agent_quote_usd REAL DEFAULT NULL,
  agent_notes TEXT DEFAULT NULL,
  quote_status TEXT DEFAULT 'pending' CHECK(quote_status IN ('pending', 'quoted', 'booked', 'cancelled')),
  pdf_url TEXT DEFAULT NULL,
  json_export TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  quoted_at DATETIME DEFAULT NULL,
  expires_at DATETIME NOT NULL
);

CREATE INDEX idx_handoff_trip ON handoff_documents(trip_id);
CREATE INDEX idx_handoff_agent ON handoff_documents(agent_id, quote_status);
CREATE INDEX idx_handoff_status ON handoff_documents(quote_status, created_at DESC);
CREATE INDEX idx_handoff_expires ON handoff_documents(expires_at) WHERE quote_status = 'pending';
```

### Migration 022: Cleanup A/B (30 days after deployment)
```sql
-- Remove deprecated column after grace period
ALTER TABLE themed_trips DROP COLUMN variants_json;
```

---

## API Data Validation

### Template Validation Service
```typescript
interface TemplateValidator {
  validateJSON(field: string, value: string): { valid: boolean; errors: string[] };
  validateTextLength(field: string, value: string, min: number, max: number): boolean;
  validateBusinessLogic(template: Partial<TripTemplate>): { valid: boolean; errors: string[] };
}
```

### Handoff Validation Service
```typescript
interface HandoffValidator {
  validateChatHistory(history: ChatMessage[]): boolean;
  validateFlightOptions(options: FlightOption[]): boolean;
  validateDailyItinerary(itinerary: DailyPlan[]): boolean;
  calculateExpiry(createdAt: Date): Date;  // createdAt + 30 days
}
```

---

## Performance Considerations

1. **Template Queries**: Index on `is_active` ensures fast active template listing
2. **Handoff Queries**: Composite index on `(agent_id, quote_status)` optimizes agent dashboard
3. **Log Correlation**: Index on `correlation_id` enables fast trip diagnostic queries
4. **Expiry Cleanup**: Partial index on `expires_at WHERE quote_status='pending'` for efficient cleanup job

---

## Data Retention

1. **Templates**: Never deleted, only deactivated (`is_active = 0`)
2. **Trips**: Retained indefinitely for user history
3. **Handoffs**: Auto-archive after 90 days if status = 'cancelled' or 'pending'
4. **Logs**: Retain 30 days, then archive to R2 cold storage
5. **PDFs**: Stored in R2, deleted when handoff archived

---

## Security & Privacy

1. **PII Sanitization**: All logs sanitized before storage (Feature 006)
2. **Agent Access**: Agents can only view handoffs assigned to them
3. **User Access**: Users can only view their own trips and handoffs
4. **Admin Access**: Full access to templates, read-only to handoffs
5. **PDF URLs**: Signed URLs with 24h expiry
