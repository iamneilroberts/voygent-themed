# Phase 0: Research & Technology Decisions

**Feature**: VoyGent V3 Template-Driven Trip Planner
**Date**: 2025-10-09
**Purpose**: Document technology choices, best practices, and implementation patterns

## Research Questions Resolved

### Q1: How to implement AI provider fallback chain with cost optimization?

**Decision**: Multi-tier provider selection with automatic fallback and cost tracking

**Rationale**:
- Z.AI offers llama-3.3-70b at ~$0.0001/1k tokens (10-20x cheaper than GPT-4)
- OpenRouter provides access to multiple models with unified API
- Need automatic fallback for availability/rate limit issues
- Cost tracking required for SC-004 (<$0.50/trip target)

**Implementation Pattern**:
```typescript
// functions/lib/ai-providers.ts
interface AIProvider {
  name: string;
  model: string;
  costPer1kTokens: number;
  generate(prompt: string, maxTokens: number): Promise<{text: string, tokens: number}>;
}

const providers: AIProvider[] = [
  { name: 'Z.AI', model: 'llama-3.3-70b', costPer1kTokens: 0.0001, generate: ... },
  { name: 'OpenRouter', model: 'anthropic/claude-3-haiku', costPer1kTokens: 0.00025, generate: ... },
  { name: 'Backup', model: 'gpt-3.5-turbo', costPer1kTokens: 0.0005, generate: ... }
];

async function generateWithFallback(prompt, maxTokens, taskType) {
  for (const provider of providers) {
    try {
      const result = await provider.generate(prompt, maxTokens);
      await logCost(provider.name, provider.costPer1kTokens * result.tokens / 1000);
      return result;
    } catch (error) {
      if (isLastProvider) throw error;
      continue; // Try next provider
    }
  }
}
```

**Alternatives Considered**:
- **Single provider (OpenAI GPT-4)**: Rejected - 10x higher cost ($0.03/1k tokens), doesn't meet SC-004
- **No fallback**: Rejected - single point of failure, poor reliability
- **Manual provider selection**: Rejected - adds UI complexity, users don't care which model is used

---

### Q2: How to enforce phase gates preventing premature API calls?

**Decision**: Middleware-based phase gate validation with database status checks

**Rationale**:
- FR-010 prohibits booking APIs during Phase 1 (research)
- FR-011 requires `destinations_confirmed=true` before Phase 2
- Constitution §2 mandates two-phase workflow enforcement
- Middleware intercepts requests before expensive API calls execute

**Implementation Pattern**:
```typescript
// functions/middleware/phase-gate.ts
export async function enforcePhaseGate(request, env) {
  const tripId = request.params.id;
  const trip = await env.DB.prepare('SELECT status, destinations_confirmed FROM themed_trips WHERE id = ?').bind(tripId).first();

  // Block booking API calls if destinations not confirmed
  if (request.url.includes('/confirm-destinations') === false) {
    if (!trip.destinations_confirmed && isPhase2Endpoint(request.url)) {
      return new Response(JSON.stringify({
        error: 'Destinations must be confirmed before trip building',
        status: trip.status,
        requiresConfirmation: true
      }), { status: 403 });
    }
  }

  return null; // Allow request to proceed
}
```

**Alternatives Considered**:
- **Client-side enforcement only**: Rejected - easily bypassed, no server-side guarantee
- **Cost-based rate limiting**: Rejected - doesn't prevent accidental phase violations
- **Manual developer discipline**: Rejected - human error likely, no programmatic enforcement

---

### Q3: How to structure D1 database schema for template-driven architecture?

**Decision**: Two-table design with JSON fields for flexible template data

**Rationale**:
- `trip_templates` table stores all theme behavior (research prompts, destination criteria, etc.)
- `themed_trips` table stores conversation state and trip data
- JSON fields provide flexibility for template evolution without schema migrations
- SQLite JSON functions enable querying within JSON fields if needed

**Schema Design**:
```sql
-- trip_templates: Defines behavior for each theme
CREATE TABLE trip_templates (
  id TEXT PRIMARY KEY,  -- e.g., 'heritage-001', 'wine-002'
  name TEXT NOT NULL,   -- e.g., 'Heritage & Ancestry'
  description TEXT NOT NULL,
  icon TEXT NOT NULL,   -- e.g., '🌳'
  featured INTEGER DEFAULT 0,  -- 1 for homepage display

  -- UI Text
  search_placeholder TEXT,
  search_help_text TEXT,
  progress_messages TEXT,  -- JSON: {"researching": "Discovering your heritage...", ...}

  -- Phase 1: Research Prompts
  research_query_template TEXT,  -- "{surname} family origin, {country} heritage sites"
  destination_criteria_prompt TEXT,  -- "Prioritize: ancestral towns, genealogy centers"
  research_synthesis_prompt TEXT,  -- "Present 2-4 destinations with historical significance"
  destination_confirmation_prompt TEXT,  -- "Which destinations interest you?"

  -- Phase 2: Trip Building Prompts
  intake_prompt TEXT NOT NULL,
  options_prompt TEXT NOT NULL,
  daily_activity_prompt TEXT,
  why_we_suggest_prompt TEXT,
  workflow_prompt TEXT,

  -- Constraints
  number_of_options INTEGER DEFAULT 3,
  trip_days_min INTEGER DEFAULT 3,
  trip_days_max INTEGER DEFAULT 21,
  luxury_levels TEXT,  -- JSON: ["Budget", "Comfort", "Luxury"]
  activity_levels TEXT,  -- JSON: ["Relaxed", "Moderate", "Active"]
  transport_preferences TEXT,  -- JSON: ["flight", "train", "car rental"]

  -- API Instructions
  tour_search_instructions TEXT,
  hotel_search_instructions TEXT,
  flight_search_instructions TEXT,

  -- Metadata
  required_fields TEXT,  -- JSON: ["duration", "travelers"]
  optional_fields TEXT,  -- JSON: ["departure_date"]
  example_inputs TEXT,  -- JSON: ["Sullivan family from Cork, Ireland"]

  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- themed_trips: Stores conversation state and trip data
CREATE TABLE themed_trips (
  id TEXT PRIMARY KEY,  -- UUID
  user_id TEXT,  -- NULL for anonymous users
  template_id TEXT NOT NULL,  -- FK to trip_templates.id
  correlation_id TEXT,  -- For tracking related operations

  -- Chat Conversation (Constitution required)
  chat_history TEXT,  -- JSON: [{role: 'user', content: '...', timestamp: unix}, ...]

  -- Phase 1: Research (Constitution required)
  research_destinations TEXT,  -- JSON: [{name: 'Cork', context: '...', sites: [...], rationale: '...'}]
  destinations_confirmed INTEGER DEFAULT 0,  -- Phase gate (Constitution required)
  confirmed_destinations TEXT,  -- JSON: ['Cork', 'Kinsale', 'Killarney'] (Constitution required)

  -- Phase 2: Trip Building
  preferences_json TEXT,  -- JSON: {duration: '7-10 days', travelers: 2, luxury: 'Comfort', ...}
  intake_json TEXT,
  research_summary TEXT,
  options_json TEXT,  -- JSON: [{option_index: 1, total_cost: 3500, flights: {...}, hotels: [...], ...}]
  selected_option_index INTEGER,
  selected_flights TEXT,  -- JSON
  selected_hotels TEXT,  -- JSON
  selected_transport TEXT,  -- JSON
  selected_tours TEXT,  -- JSON
  final_itinerary TEXT,  -- JSON: [{day: 1, activities: [...], hotel: {...}, ...}]
  total_cost_usd REAL,

  -- User-Facing Progress (Constitution required)
  status TEXT DEFAULT 'chat',  -- 'chat'|'researching'|'awaiting_confirmation'|'building_trip'|'options_ready'
  progress_step TEXT,
  progress_message TEXT,
  progress_percent INTEGER DEFAULT 0,

  -- Travel Agent Handoff
  agency_id TEXT,
  handoff_json TEXT,

  -- Admin Telemetry (not user-visible)
  ai_cost_usd REAL DEFAULT 0.0,
  api_cost_usd REAL DEFAULT 0.0,
  telemetry_logs TEXT,  -- JSON: [{timestamp, provider, tokens, cost, duration_ms, ...}]

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_trips_template ON themed_trips(template_id);
CREATE INDEX idx_trips_status ON themed_trips(status);
CREATE INDEX idx_trips_user ON themed_trips(user_id) WHERE user_id IS NOT NULL;
```

**Alternatives Considered**:
- **Normalized schema with separate tables for destinations, options**: Rejected - over-engineering for current scale, JSON simpler
- **NoSQL document store**: Rejected - D1 SQLite mandated by constitution, SQL provides transaction guarantees
- **Hardcoded template logic in code**: Rejected - violates Constitution §1 (template-driven architecture)

---

### Q4: How to implement streaming AI responses in chat interface?

**Decision**: Server-Sent Events (SSE) for streaming, with fallback to polling

**Rationale**:
- SSE provides real-time streaming from Cloudflare Functions to browser
- User sees AI response appear incrementally (better perceived performance)
- Fallback to polling for older browsers or restrictive networks
- Cloudflare Functions support SSE via Response streaming

**Implementation Pattern**:
```typescript
// Frontend: public/js/chat.js
async function sendMessage(message) {
  const response = await fetch(`/api/trips/${tripId}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message }),
    headers: { 'Accept': 'text/event-stream' }
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        appendToChatMessage(data.token); // Display incrementally
      }
    }
  }
}

// Backend: functions/api/trips/[id]/chat.ts
export async function onRequest(context) {
  const { message } = await context.request.json();

  // Streaming response
  const stream = new ReadableStream({
    async start(controller) {
      const aiResponse = await generateAIResponse(message);
      // Stream tokens as they're generated
      for (const token of aiResponse) {
        controller.enqueue(`data: ${JSON.stringify({ token })}\n\n`);
      }
      controller.close();
    }
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' }
  });
}
```

**Alternatives Considered**:
- **WebSockets**: Rejected - Cloudflare Functions don't support persistent WebSocket connections
- **Long polling only**: Rejected - higher latency, more server load, poor UX
- **Wait for complete response**: Rejected - 2-5 second wait feels slow, violates SC-001 perceived performance

---

### Q5: How to implement mobile-responsive chat interface?

**Decision**: CSS Grid + Flexbox with mobile-first breakpoints, no framework

**Rationale**:
- Constitution §3 mandates vanilla JS (no React/Vue)
- Mobile-first design starts with 320px width, progressively enhances to desktop
- CSS Grid for overall layout, Flexbox for message bubbles and preferences panel
- Touch targets 44x44px minimum (iOS/Android accessibility guidelines)

**Implementation Pattern**:
```css
/* Mobile-first base styles (320px+) */
.chat-container {
  display: grid;
  grid-template-rows: auto 1fr auto; /* header, messages, input */
  height: 100vh;
  padding: 0;
}

.preferences-panel {
  display: flex;
  flex-direction: column; /* Stack vertically on mobile */
  gap: 1rem;
  padding: 1rem;
  background: #f5f5f5;
}

.preference-row {
  min-height: 44px; /* Touch target minimum */
  font-size: 16px; /* Prevent iOS auto-zoom */
}

.chat-messages {
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.message {
  max-width: 85%; /* Prevent edge-to-edge bubbles */
  padding: 0.75rem 1rem;
  border-radius: 1rem;
  word-wrap: break-word;
}

.message-user {
  align-self: flex-end;
  background: #007AFF;
  color: white;
}

.message-assistant {
  align-self: flex-start;
  background: #E5E5EA;
  color: black;
}

/* Tablet (768px+) */
@media (min-width: 768px) {
  .chat-container {
    grid-template-columns: 300px 1fr; /* Sidebar + chat */
    grid-template-rows: 1fr auto;
  }

  .preferences-panel {
    grid-row: 1 / 3; /* Sidebar spans full height */
  }

  .message {
    max-width: 60%; /* Narrower bubbles on wider screens */
  }
}

/* Desktop (1024px+) */
@media (min-width: 1024px) {
  .chat-container {
    max-width: 1200px;
    margin: 0 auto;
  }

  .message {
    max-width: 50%;
  }
}
```

**Alternatives Considered**:
- **Bootstrap/Tailwind**: Rejected - constitution prohibits frameworks, adds unnecessary KB
- **Desktop-first design**: Rejected - mobile is primary use case per Constitution §6
- **Separate mobile app**: Rejected - web app must work on mobile, native apps out of scope

---

## Best Practices Summary

### Cloudflare Pages + Functions
- **Environment variables**: Store API keys in Cloudflare Pages environment (accessed via `env.AMADEUS_API_KEY`)
- **D1 bindings**: Configure in `wrangler.toml`, access via `env.DB`
- **Function routing**: File-based routing (`functions/api/trips/[id]/chat.ts` → `/api/trips/:id/chat`)
- **Cold starts**: Keep functions <1MB, use lightweight dependencies (Hono vs Express)
- **Edge caching**: Cache template data (`trip_templates` table) with `Cache-Control` headers

### D1 Database Best Practices
- **Migrations**: Use `wrangler d1 migrations` for version-controlled schema changes
- **Query patterns**: Prepared statements prevent SQL injection, enable query caching
- **JSON columns**: Use SQLite JSON functions (`json_extract`, `json_array_length`) for querying
- **Indexes**: Add indexes on foreign keys and frequently queried fields (status, template_id, user_id)
- **Transactions**: Wrap multi-step operations (create trip + insert chat message) in transactions

### AI Integration Patterns
- **Prompt engineering**: Store prompts in templates, use variable substitution `{surname}`, `{region}`
- **Token limits**: Set `max_tokens` based on task (200 for destination extraction, 1500 for synthesis)
- **Cost tracking**: Log every AI call with `{ provider, model, tokensIn, tokensOut, cost, timestamp }`
- **Timeout handling**: Set 30-second timeout for AI calls, return partial results or retry with fallback provider

### Chat Interface Best Practices
- **Message persistence**: Store every chat message in `chat_history` for conversation resumption
- **Optimistic UI**: Display user message immediately, show "AI is thinking..." indicator
- **Error recovery**: Allow user to retry failed messages without losing conversation context
- **Accessibility**: ARIA labels for screen readers, keyboard navigation for preferences panel

### Mobile-Specific Considerations
- **Viewport meta**: `<meta name="viewport" content="width=device-width, initial-scale=1">`
- **Touch scrolling**: `-webkit-overflow-scrolling: touch` for smooth iOS scrolling
- **Input zoom prevention**: Use `font-size: 16px` on inputs to prevent iOS auto-zoom
- **Network resilience**: Show offline indicator, queue messages for retry when network returns

---

## Technology Stack Summary

**Approved Stack** (Constitution-mandated):
- **Platform**: Cloudflare Pages + Functions
- **Language**: TypeScript 5.x (backend), ES2022+ JavaScript (frontend)
- **Database**: D1 (SQLite)
- **Web Framework**: Hono (lightweight, Cloudflare-optimized)
- **AI Providers**: Z.AI → OpenRouter → backup (fallback chain)
- **Booking APIs**: Amadeus (flights/hotels), Viator (tours)
- **Search APIs**: Serper or Tavily (web search for destination research)
- **Testing**: Vitest (unit), Playwright (E2E)
- **Frontend**: Vanilla HTML/CSS/JS (no React/Vue/etc.)

**Deployment**:
- **Production**: `voygent.app` (Cloudflare Pages), `voygent-themed` database
- **Development**: `voygent-v3-dev` database, local Wrangler dev server
- **CI/CD**: GitHub Actions → Cloudflare Pages automatic deployment

---

**Next Phase**: Phase 1 (Design) - Generate data-model.md, contracts/, quickstart.md
