# New Coding Session: VoyGent V2 - Complete Template-Driven Travel Planning Platform

## Executive Summary

Build VoyGent V2 from scratch: a complete, template-driven travel planning system optimized for Cloudflare Pages + D1 database. The system generates AI-powered, theme-specific trip itineraries with **conversational research workflow**, **user-facing progress feedback**, and **admin-only diagnostic telemetry**, accurate pricing from real APIs (Amadeus, Viator, TripAdvisor), and seamless handoff to travel agents for commission-based bookings.

**Critical Paradigm**: ALL trip logic, prompts, and UI text come from database templates—NO hardcoded theme logic in JavaScript.

---

## Business Model

1. User selects trip theme (Heritage, Wine & Food, Film Locations, etc.) or uses generic "Plan My Trip"
2. **Phase 1**: AI researches destinations based on theme + user input → presents findings to user in chat
3. **User confirms/refines** destinations in chat conversation
4. **Phase 2**: AI creates detailed trip options with accurate flight/hotel/tour pricing for confirmed destinations
5. User sees detailed itinerary with cost breakdown (15% travel agent margin built in)
6. User clicks "Get a free quote from a travel pro"
7. Structured handoff document sent to subscribed travel agent
8. Agent quotes in their system, routes quote back to user
9. User books through agent → commission split between agent and platform

**Key Optimization**: Use cheapest AI providers (Z.AI, OpenRouter) to maximize margin while delivering sophisticated, personalized trips.

---

## Core Requirements

### 1. Template-Based Architecture

**Principle**: Zero hardcoded trip logic. All behavior controlled by `trip_templates` table.

Each template defines:
- **Research Prompts**: 
  - `research_query_template`: How to search for destinations (e.g., "{surnames[0]} origin country city heritage sites")
  - `research_synthesis_prompt`: How to synthesize research into destination recommendations
  - `destination_criteria_prompt`: What makes a good destination for this theme (e.g., "Look for: ancestral towns, heritage museums, family castles, genealogy centers")
- **Trip Building Prompts**: `intake_prompt`, `options_prompt`, `daily_activity_prompt`, `why_we_suggest_prompt`, `workflow_prompt`
- **UI Text**: `search_placeholder`, `search_help_text`, `progress_messages` (JSON)
- **Constraints**: `number_of_options` (1-10), `trip_days_min/max`, `luxury_levels`, `activity_levels`, `transport_preferences`
- **API Instructions**: `tour_search_instructions`, `hotel_search_instructions`, `flight_search_instructions`

**5 Featured Templates on Homepage** (from DB column `featured=1`):
1. Heritage & Ancestry 🌳
2. Wine & Food 🍷
3. Film & TV Locations 🎬
4. Historical Events 📜
5. Adventure & Outdoor 🏔️

Plus: **"Plan My Trip"** (generic template, no theme constraints)

---

## 2. Conversational Research Workflow (CRITICAL CHANGE)

### Phase 1: Destination Research & User Confirmation

**Step 1: Initial Research**
User provides input (e.g., "Sullivan family from Cork, Ireland" or "Breaking Bad filming locations" or "Best wineries in Tuscany")

**Step 2: AI Researches Destinations**
- Template's `research_query_template` guides what to search for:
  - **Heritage**: "{surname} family origin country" → "{country} {region} heritage sites" → "genealogy centers in {region}"
  - **TV/Movie**: "{title} filming locations" → "{location} tourist sites" → "behind-the-scenes tours"
  - **Wine/Food**: "{region} wineries" → "{region} culinary experiences" → "wine tours {region}"
  - **Literary**: "{author} hometown" → "{author} inspiration locations" → "literary landmarks {region}"
  
- Template's `destination_criteria_prompt` guides what makes a good destination:
  - **Heritage**: "Prioritize: ancestral towns, family castles, heritage museums, genealogy research centers, local historical societies"
  - **TV/Movie**: "Prioritize: actual filming locations, behind-the-scenes tours, iconic scenes, cast/crew favorite spots"
  - **Wine/Food**: "Prioritize: family-owned wineries, cooking schools, food markets, Michelin restaurants, farm-to-table experiences"

**Step 3: Present Research Summary to User IN CHAT**
AI responds in chat interface with:
```
Based on my research of Sullivan family origins in Cork, Ireland, here's what I found:

📍 **Recommended Destinations:**

1. **Cork City** (Primary origin)
   - Sullivan family historical records at Cork City Library
   - Heritage sites: St. Fin Barre's Cathedral, Cork City Gaol
   - Local genealogy center with Sullivan family archives

2. **Kinsale** (30 min south)
   - Charles Fort (Sullivan family military history)
   - Historic harbor town with maritime museums
   - Coastal scenery and charming villages

3. **Blarney** (20 min north)
   - Blarney Castle (Sullivan nobility connections)
   - Rock Close gardens
   - Traditional Irish craft shops

**What would you like to explore?**
- Focus on all three destinations? (7-10 day trip)
- Just Cork City and one other? (5-7 days)
- Add any other Irish locations you're interested in?
- Any specific aspects of Sullivan heritage you want to prioritize?

Please let me know your preferences, and I'll create detailed trip options!
```

**Step 4: User Responds in Chat**
User can:
- Confirm destinations: "Yes, all three sound perfect"
- Refine: "Skip Blarney, but add Killarney instead"
- Ask questions: "Are there any Sullivan family sites in Dublin?"
- Add preferences: "I want to focus on genealogy research, not just sightseeing"

**Step 5: AI Clarifies (if needed)**
If user response is vague or contradictory, AI asks follow-up questions:
- "How many days would you like to spend in Cork vs. Kinsale?"
- "Are you more interested in historical sites or natural scenery?"

**Step 6: User Confirms Final Destinations**
AI summarizes: "Got it! I'll build trip options for Cork (4 days), Kinsale (2 days), Killarney (2 days). Generating your itinerary options now..."

### Phase 2: Trip Building (ONLY AFTER USER CONFIRMATION)

**Now AI proceeds to**:
- Call Amadeus Flight API (origin → confirmed destinations)
- Call Amadeus Hotel API (for each confirmed city)
- Call Viator/TripAdvisor for tours (matching destination criteria from template)
- Generate 2-4 detailed itinerary options using template's `options_prompt`
- Present options to user with pricing

**User sees**: Progress messages like "Finding flights to Cork...", "Checking hotels in Kinsale...", "Discovering heritage tours..."

**Admin sees**: Full telemetry with API calls, costs, tokens

---

## 3. Chat Interface Design

**Chat Window** (primary interaction):
- Full-page chat interface (not sidebar)
- User messages on right, AI responses on left
- AI can display rich content:
  - Research summaries with bullet points
  - Destination cards with images (optional)
  - Questions with suggested response buttons
  - Trip options with pricing tables
  
**"Customize My Trip" Panel** (EXPANDED BY DEFAULT):
Located above or beside chat input, always visible with:
```
✈️ Trip Preferences (click any to change)
├─ Duration: 7-10 days [change]
├─ Travelers: 2 adults [change]
├─ Luxury Level: Comfort [change]
├─ Activity Level: Moderate [change]
└─ Departure Airport: JFK [change]
```

**Why Expanded by Default**: Users must understand they can set preferences BEFORE research starts. Collapsed state hides this critical control.

**User Flow**:
1. Select template → chat interface opens
2. See "Customize My Trip" panel (expanded, prominent)
3. Adjust preferences if desired
4. Type initial request in chat: "Plan a Sullivan family heritage trip"
5. AI researches → presents destination recommendations in chat
6. User confirms/refines in chat
7. AI builds trip options → displays in chat with pricing
8. User selects option → sees detailed itinerary
9. Clicks "Get a free quote" button

---

## 4. Two-Tier Progress System

### A. User-Facing Progress (Chat Messages)

**During Research Phase**:
```
🔍 Researching Sullivan family origins...
   One moment while I search historical records and travel destinations...
```

**During Trip Building Phase** (after user confirms destinations):
```
✈️ Finding flights from JFK to Cork...
🏨 Checking hotels in Cork, Kinsale, Killarney...
🎭 Discovering heritage tours and experiences...
📋 Building your trip options...
```

**What Users DO NOT See**:
- ❌ Model names, token counts, costs, provider names
- ❌ Technical errors or stack traces
- ❌ Database operations

### B. Admin Diagnostic Telemetry (Admin-Only)

**Access**: Only when `user.role = 'admin'` AND `config.diagnostics_enabled = true`

**What Admins See**:
```
[INFO] Research Phase 1: Origin search "Sullivan family origin" → 12 results
[INFO] Z.AI llama-3.3-70b: 127 tokens in, 243 out, $0.00009, 1.2s
[INFO] Research Phase 2: Destination search "Cork heritage sites" → 8 results
[INFO] Z.AI synthesis: 892 tokens in, 1247 out, $0.00041, 3.1s
[INFO] User confirmed destinations: Cork, Kinsale, Killarney
[INFO] Amadeus Flight Search: JFK→ORK → 12 offers (487ms)
[INFO] Total cost: AI $0.23, APIs $0.05, Total $0.28
```

---

## 5. Template Schema with Research Guidance

**`trip_templates`**:
```sql
CREATE TABLE trip_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  featured INTEGER DEFAULT 0,
  
  -- UI Text
  search_placeholder TEXT,
  search_help_text TEXT,
  progress_messages TEXT,                    -- JSON
  
  -- Research Prompts (Phase 1: Destination Discovery)
  research_query_template TEXT,              -- "Search for: {surnames[0]} origin country, {country} heritage sites"
  destination_criteria_prompt TEXT,          -- "Good destinations have: ancestral towns, genealogy centers, heritage museums"
  research_synthesis_prompt TEXT,            -- How to present findings: "List 2-4 destinations with: historical significance, travel logistics, key sites"
  destination_confirmation_prompt TEXT,      -- What to ask user: "Which destinations interest you? How many days? Any must-sees?"
  
  -- Trip Building Prompts (Phase 2: After User Confirms)
  intake_prompt TEXT NOT NULL,
  options_prompt TEXT NOT NULL,              -- "Create {number_of_options} itineraries for {confirmed_destinations} with {user_preferences}"
  daily_activity_prompt TEXT,
  why_we_suggest_prompt TEXT,
  workflow_prompt TEXT,
  
  -- Constraints
  number_of_options INTEGER DEFAULT 3,
  trip_days_min INTEGER DEFAULT 3,
  trip_days_max INTEGER DEFAULT 21,
  luxury_levels TEXT,                        -- JSON
  activity_levels TEXT,                      -- JSON
  transport_preferences TEXT,                -- JSON
  tour_search_instructions TEXT,
  hotel_search_instructions TEXT,
  flight_search_instructions TEXT,
  required_fields TEXT,                      -- JSON
  optional_fields TEXT,                      -- JSON
  example_inputs TEXT,                       -- JSON
  
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
```

---

## 6. Example Workflows by Theme

### Heritage Trip Example

**User Input**: "Sullivan family from Cork, Ireland"

**AI Research** (guided by template):
1. Search: "Sullivan surname origin Ireland"
2. Search: "Sullivan family Cork heritage sites"
3. Search: "genealogy research Cork Ireland"
4. Synthesize into 2-4 destination recommendations

**AI Response in Chat**:
```
Based on Sullivan family history, I recommend:

📍 Cork City (origin hub) - 4-5 days
   • Cork City Library archives
   • St. Fin Barre's Cathedral
   • Heritage walking tours
   
📍 Kinsale (historic port) - 2 days
   • Charles Fort (Sullivan military history)
   • Maritime museum
   
Which destinations interest you? How many days total?
```

**User**: "Both, plus add Killarney. 8 days total."

**AI**: "Perfect! Building options for Cork (4d), Kinsale (2d), Killarney (2d)..."
→ Proceeds to flight/hotel search, tour booking, itinerary generation

---

### TV/Movie Trip Example

**User Input**: "Breaking Bad filming locations"

**AI Research** (guided by template):
1. Search: "Breaking Bad filming locations Albuquerque"
2. Search: "Breaking Bad tours New Mexico"
3. Search: "Walter White house address"
4. Synthesize into destinations

**AI Response in Chat**:
```
Breaking Bad was filmed entirely in Albuquerque! Here are the key locations:

📍 Albuquerque (main filming hub) - 4-5 days
   • Walter White's house (308 Negra Arroyo Lane)
   • Los Pollos Hermanos (Twisters restaurant)
   • Jesse Pinkman's house
   • Breaking Bad RV tours
   
📍 Santa Fe (day trip) - 1 day
   • Beautiful adobe architecture (show backdrop)
   • Georgia O'Keeffe museum
   
Want to explore both? Or focus just on Albuquerque?
```

**User**: "Just Albuquerque, 5 days"

**AI**: "Got it! Building Breaking Bad tour itineraries for 5 days in Albuquerque..."

---

### Wine/Food Trip Example

**User Input**: "Tuscany wine tour"

**AI Research**:
1. Search: "Tuscany best wineries"
2. Search: "Chianti wine region tours"
3. Search: "Tuscany cooking schools"

**AI Response**:
```
Tuscany has three main wine regions worth exploring:

📍 Chianti (classic wine region) - 3 days
   • Family-owned vineyards
   • Wine tasting classes
   • Medieval hilltop towns
   
📍 Montalcino (Brunello wines) - 2 days
   • Brunello di Montalcino tastings
   • Sant'Antimo Abbey
   
📍 Florence (culinary capital) - 2 days
   • Cooking classes
   • Food markets
   • Michelin dining
   
Which regions appeal to you? Budget level?
```

---

## 7. API Integrations (Phase 2 Only)

**IMPORTANT**: API calls happen ONLY AFTER user confirms destinations in chat.

### Amadeus Flight Offers Search
**When**: After user confirms origin + destinations
**User sees**: "Finding flights from JFK to Cork..."
**Admin sees**: `[INFO] Amadeus Flight Search: JFK→ORK → 12 offers (487ms)`

### Amadeus Hotel Search
**When**: After user confirms cities + duration
**User sees**: "Checking hotels in Cork..."
**Admin sees**: `[INFO] Amadeus Hotel Search: Cork, 4 nights → 23 properties (612ms)`

### Viator API
**When**: After destinations confirmed
**Filter by**: Template's `destination_criteria_prompt` (e.g., "heritage tours", "film location tours")
**User sees**: "Discovering heritage tours in Cork..."
**Admin sees**: `[INFO] Viator: Cork heritage → 15 results (892ms)`

### Web Search (Phase 1)
**When**: During initial research, BEFORE trip building
**Purpose**: Discover destinations based on user input + template criteria
**User sees**: "Researching Sullivan family origins..."
**Admin sees**: `[INFO] Serper: "Sullivan Cork heritage" → 8 results (342ms)`

---

## 8. Database Schema Updates

**`themed_trips`** (add conversation field):
```sql
CREATE TABLE themed_trips (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  template_id TEXT,
  correlation_id TEXT,
  
  -- Chat Conversation
  chat_history TEXT,                         -- JSON: [{role: 'user', content: '...'}, {role: 'assistant', content: '...'}]
  
  -- Research Phase (before trip building)
  research_destinations TEXT,                -- JSON: [{name: 'Cork', why: '...', sites: [...]}]
  destinations_confirmed BOOLEAN DEFAULT 0,
  confirmed_destinations TEXT,               -- JSON: ['Cork', 'Kinsale', 'Killarney']
  
  -- Trip Building Phase (after confirmation)
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
  
  -- User-Facing Progress
  status TEXT DEFAULT 'chat',               -- 'chat'|'researching'|'awaiting_confirmation'|'building_trip'|'options_ready'
  progress_step TEXT,
  progress_message TEXT,
  progress_percent INTEGER DEFAULT 0,
  
  agency_id TEXT,
  handoff_json TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
```

---

## 9. Frontend Architecture

**Chat Interface** (primary):
- `public/index.html`: Homepage + chat window
- `public/js/chat.js`: Chat message handling, user input, AI streaming responses
- `public/js/trip-preferences.js`: "Customize My Trip" panel (expanded by default)
- `public/js/diagnostics.js`: Admin-only telemetry (collapsible panel)

**Key UI Elements**:

**Preferences Panel** (expanded by default):
```html
<div class="trip-preferences-panel expanded">
  <h3>✈️ Customize Your Trip</h3>
  <div class="preference-row">
    <label>Duration:</label>
    <select id="duration">
      <option>3-5 days</option>
      <option selected>7-10 days</option>
      <option>14+ days</option>
    </select>
  </div>
  <!-- More preferences... -->
  <button class="collapse-toggle">Hide Preferences</button>
</div>
```

**Chat Window**:
```html
<div class="chat-window">
  <div class="chat-messages" id="chat-history">
    <!-- Messages here -->
  </div>
  <div class="chat-input-container">
    <textarea id="chat-input" placeholder="Describe your dream trip..."></textarea>
    <button id="send-btn">Send</button>
  </div>
</div>
```

---

## 10. Backend Architecture

**Key Endpoints**:
- `POST /api/trips` - Start conversation (create trip, store initial message)
- `POST /api/trips/:id/chat` - Send user message, get AI response
- `GET /api/trips/:id` - Get trip state (for progress polling)
- `GET /api/trips/:id/logs` - Stream logs (admin-only)
- `POST /api/trips/:id/confirm-destinations` - User confirms destinations → triggers Phase 2
- `POST /api/trips/:id/select` - User selects trip option
- `POST /api/trips/:id/handoff` - Generate handoff doc

**Chat Flow** (`POST /api/trips/:id/chat`):
1. Receive user message
2. Append to `chat_history`
3. Determine conversation state:
   - **If initial message**: Start research (Phase 1)
   - **If awaiting confirmation**: Parse user response, extract confirmed destinations
   - **If refining**: Ask clarifying questions
   - **If confirmed**: Trigger Phase 2 (trip building)
4. Generate AI response using template prompts
5. Return AI message + updated status

**Research Phase Implementation**:
```typescript
// Phase 1: Research destinations
async function researchDestinations(tripId: string, userInput: string, template: Template) {
  // Use template.research_query_template to build search queries
  const queries = buildSearchQueries(userInput, template.research_query_template);
  
  // Search web for each query
  const results = await Promise.all(queries.map(q => searchWeb(q)));
  
  // Use template.research_synthesis_prompt + destination_criteria_prompt
  const destinations = await synthesizeDestinations(results, template);
  
  // Save research_destinations to database
  await db.update('themed_trips', {
    id: tripId,
    research_destinations: JSON.stringify(destinations),
    status: 'awaiting_confirmation'
  });
  
  // Use template.destination_confirmation_prompt to ask user
  const aiMessage = await generateConfirmationMessage(destinations, template);
  
  return aiMessage;
}
```

---

## 11. Success Criteria

**User Experience**:
- [ ] User sees "Customize My Trip" panel expanded by default
- [ ] AI researches destinations, presents 2-4 recommendations in chat
- [ ] User can refine/confirm destinations conversationally
- [ ] Trip building (flights, hotels, tours) happens ONLY AFTER user confirmation
- [ ] Chat interface feels natural, not robotic
- [ ] Works on mobile

**Admin Experience**:
- [ ] Admin sees full telemetry: research queries, API calls, costs
- [ ] Can track conversation state in logs
- [ ] Dashboard shows: Phase 1 completion rate, destination confirmation rate, trip building success rate

**Business**:
- [ ] Reduces wasted API calls (don't search flights until destinations confirmed)
- [ ] Higher user engagement (conversational vs. form-based)
- [ ] AI cost per trip: <$0.50 average

---

## 12. Your Task

**Use `/specify` to create a detailed feature specification** for VoyGent V2 based on this prompt. Then use `/plan` to generate an implementation plan.

**Critical Requirements**:
1. **Two-phase workflow**: Research destinations → User confirms → Build trip
2. **Chat-based interaction**: Conversational, not form-based
3. **Template-driven research**: Templates guide what to search for and how to present findings
4. **Expanded preferences panel**: Visible by default so users understand control
5. **No wasted API calls**: Amadeus only called AFTER user confirms destinations
6. **Admin telemetry**: Separate from user-facing progress

**Constraints**:
- Cloudflare Pages + D1 (SQLite)
- Vanilla JS frontend (no React)
- TypeScript backend
- Mobile-responsive chat interface

Now create the spec with `/specify` and plan with `/plan`!
