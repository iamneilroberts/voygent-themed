# Feature Specification: VoyGent V3 Template-Driven Trip Planner

**Feature Branch**: `001-voygent-v3-template`
**Created**: 2025-10-09
**Status**: Draft
**Input**: User description: "VoyGent V3 - Template-driven conversational trip planner with two-phase workflow"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Destination Research and Confirmation (Priority: P1) 🎯 MVP

A user wants to plan a themed trip (Heritage, Wine & Food, Film Locations, etc.) but doesn't know the best destinations yet. They describe their interest in natural language, and the AI researches potential destinations, presents 2-4 recommendations with context, and allows the user to confirm or refine choices before committing to detailed trip planning.

**Why this priority**: This is the core innovation that differentiates V3 from V1. Without this conversational research phase, users waste time reviewing trips to destinations they don't want, and the platform wastes money on expensive API calls for flights/hotels that won't be booked. This story delivers immediate value by helping users discover and validate destinations.

**Independent Test**: Can be fully tested by selecting a trip theme, entering a natural language request (e.g., "Sullivan family heritage in Ireland"), receiving 2-4 destination recommendations with rationale, and confirming choices. The system transitions to "awaiting confirmation" status without making any booking API calls. Deliverable value: users can explore destinations risk-free.

**Acceptance Scenarios**:

1. **Given** user selects "Heritage & Ancestry" theme and enters "Sullivan family from Cork, Ireland", **When** AI completes research, **Then** user sees 2-4 destination recommendations (e.g., Cork City, Kinsale, Blarney) with brief descriptions of why each is relevant (historical sites, genealogy resources, family connections)

2. **Given** user views destination recommendations, **When** user responds "Yes, all three sound perfect", **Then** system records confirmed destinations (Cork, Kinsale, Blarney) and transitions to Phase 2 (trip building)

3. **Given** user views destination recommendations, **When** user responds "Skip Blarney, add Killarney instead", **Then** system updates destination list, confirms the change in chat, and asks if ready to build trip

4. **Given** user views destination recommendations, **When** user asks "Are there Sullivan sites in Dublin?", **Then** AI performs additional research and presents updated recommendations including Dublin if relevant

5. **Given** user is in research phase, **When** user views chat interface, **Then** user sees friendly progress message ("Researching Sullivan family origins...") WITHOUT technical details (no model names, costs, token counts, or provider names)

6. **Given** admin user is in research phase, **When** admin views diagnostic panel, **Then** admin sees full technical telemetry (research queries, AI model used, tokens, costs, timing) separate from user-facing chat

---

### User Story 2 - Trip Customization with Preferences Panel (Priority: P1) 🎯 MVP

A user wants to control trip parameters (duration, travelers, luxury level, activity level, departure airport) BEFORE the AI researches destinations, ensuring recommendations match their constraints and budget from the start.

**Why this priority**: Preferences directly impact destination research (e.g., 3-day trips vs 14-day trips suggest different destination combinations) and trip pricing. Making preferences visible and editable upfront prevents users from receiving trips that don't match their needs, reducing frustration and abandoned sessions. This is P1 because it's integral to the research phase (P1).

**Independent Test**: Can be tested by opening the trip planner interface and immediately seeing the "Customize My Trip" panel expanded with all editable preferences (duration, travelers, luxury, activity, departure airport). Change preferences, start a trip request, and verify that AI research considers these constraints (e.g., selecting 3-day duration yields nearby destination clusters vs 14-day trips suggesting multi-city tours).

**Acceptance Scenarios**:

1. **Given** user opens trip planner interface, **When** page loads, **Then** "Customize My Trip" preferences panel is visible and expanded (not collapsed) showing current settings: Duration (7-10 days default), Travelers (2 adults default), Luxury Level (Comfort default), Activity Level (Moderate default), Departure Airport (user's nearest major airport or prompt for input)

2. **Given** user sees preferences panel, **When** user clicks "Duration" dropdown, **Then** user can select from ranges: 3-5 days, 5-7 days, 7-10 days, 10-14 days, 14+ days

3. **Given** user changes duration to "3-5 days" and enters "Tuscany wine tour", **When** AI researches destinations, **Then** recommendations focus on compact geographic clusters (e.g., Chianti + Florence only, not adding distant Montalcino)

4. **Given** user changes luxury level to "Budget", **When** user proceeds to trip building phase, **Then** system searches for economy hotels and budget-friendly tours

5. **Given** user collapses preferences panel after setting values, **When** user continues conversation, **Then** AI uses saved preferences and user can re-expand panel at any time to adjust

---

### User Story 3 - Detailed Trip Building with Real Pricing (Priority: P2)

After user confirms destinations, the system calls real booking APIs (Amadeus for flights/hotels, Viator for tours) to build 2-4 detailed itinerary options with accurate pricing, day-by-day activities, and accommodation recommendations. User selects preferred option to view full itinerary.

**Why this priority**: This delivers on the core promise of the platform—personalized trips with real pricing. However, it depends on P1 (destination confirmation) to avoid wasted API costs. It's P2 because users can conceptually validate the research phase (P1) and see value before this phase completes, but this phase is essential for trip booking conversion.

**Independent Test**: Can be tested independently by using a pre-seeded trip with confirmed destinations (Cork, Kinsale, Killarney) and triggering Phase 2. System should call flight APIs, hotel APIs, and tour APIs, then present 2-4 trip options with total cost, daily itineraries, and hotel names. User can select one option to view detailed day-by-day breakdown.

**Acceptance Scenarios**:

1. **Given** user has confirmed destinations (Cork, Kinsale, Killarney) and preferences (8 days, 2 adults, Comfort level, JFK departure), **When** Phase 2 begins, **Then** user sees progress messages in chat: "Finding flights from JFK to Cork...", "Checking hotels in Cork, Kinsale, Killarney...", "Discovering heritage tours..."

2. **Given** system is searching for flights, hotels, and tours, **When** all API calls complete successfully, **Then** system presents 2-4 trip options in chat, each showing: Total Cost (with 15% margin built in), Flight summary (airline, route, times), Hotel tier (e.g., "4-star city center"), Number of tours included, Brief itinerary highlights

3. **Given** user views trip options, **When** user clicks "See Details" on Option 2, **Then** system displays day-by-day itinerary with: Daily activities and tours, Meal suggestions, Hotel names and locations, Estimated daily costs

4. **Given** user views detailed itinerary, **When** user clicks "Get a free quote from a travel pro", **Then** system generates handoff document with all trip details and presents success message: "Your trip request has been sent to a travel professional. Expect a quote within 24 hours."

5. **Given** system is calling booking APIs, **When** API call fails (timeout, auth error, no availability), **Then** system degrades gracefully: retries once, falls back to generic suggestions for that component (e.g., "Hotels in Cork: typically $120-180/night for 4-star"), logs error in admin telemetry, shows friendly user message ("We're having trouble finding exact hotel availability. Your travel agent will provide specific options in your quote.")

---

### User Story 4 - Template Management and Theme Selection (Priority: P2)

Users can select from 5 featured trip themes (Heritage & Ancestry, Wine & Food, Film & TV Locations, Historical Events, Adventure & Outdoor) plus a generic "Plan My Trip" option. Each theme uses a different database template that defines research prompts, destination criteria, and trip building logic. Admins can add new themes by inserting database records without code changes.

**Why this priority**: This is the architectural foundation that prevents V1's hardcoded theme problem. It's P2 because the system can function with one template initially (proving the concept), but the template-driven architecture must work correctly before launch to ensure scalability. This story enables business growth through new themes without developer involvement.

**Independent Test**: Can be tested by loading the homepage and seeing 6 theme cards (5 featured + Plan My Trip). Clicking each theme loads that template's configuration from the database. Admin test: insert a new "Photography Tours" template via database, refresh homepage, and verify the new theme appears without code deployment.

**Acceptance Scenarios**:

1. **Given** user visits homepage, **When** page loads, **Then** user sees 6 trip theme cards: Heritage & Ancestry 🌳, Wine & Food 🍷, Film & TV Locations 🎬, Historical Events 📜, Adventure & Outdoor 🏔️, Plan My Trip (generic)

2. **Given** user clicks "Heritage & Ancestry", **When** chat interface opens, **Then** system loads template from database with research_query_template ("search for: {surname} origin country, {country} heritage sites"), destination_criteria_prompt ("prioritize: ancestral towns, genealogy centers, heritage museums"), and search_placeholder ("E.g., Sullivan family from Cork, Ireland")

3. **Given** user clicks "Wine & Food", **When** chat interface opens, **Then** system loads different template with research_query_template ("search for: {region} wineries, {region} culinary experiences"), destination_criteria_prompt ("prioritize: family-owned wineries, cooking schools, food markets, Michelin restaurants"), and search_placeholder ("E.g., Best wineries in Tuscany")

4. **Given** admin inserts new template "Photography Tours" with `featured=1` in `trip_templates` table, **When** homepage reloads, **Then** new theme appears alongside other featured themes without code deployment

5. **Given** template defines `number_of_options=4` for Wine & Food trips, **When** Phase 2 completes, **Then** system generates 4 trip options (not the default 3)

---

### User Story 5 - Mobile-Responsive Chat Experience (Priority: P3)

Users on mobile devices (phones, tablets) can access the full chat interface, preferences panel, destination research, trip options, and detailed itineraries with touch-friendly controls and readable text sizing. All interactive elements work on mobile browsers.

**Why this priority**: Travel planning often happens on mobile (commuting, browsing in spare time, discussing with companions), so mobile support expands the addressable user base. It's P3 because desktop functionality proves the concept first, but mobile is essential for user reach before public launch.

**Independent Test**: Can be tested on a phone by opening the trip planner, interacting with the chat (type message, see AI responses), adjusting preferences (tap dropdowns, select values), viewing destination recommendations (scrollable list), and reviewing trip options (swipe/scroll through cards). All text should be readable, all buttons tappable, and no horizontal scrolling required.

**Acceptance Scenarios**:

1. **Given** user opens trip planner on mobile phone, **When** page loads, **Then** chat interface fills screen width, preferences panel stacks vertically, text is readable without zooming (minimum 16px base font), and all interactive elements have minimum 44x44px touch targets

2. **Given** mobile user views destination recommendations, **When** user taps on a destination card, **Then** card expands to show full details without breaking layout

3. **Given** mobile user views trip options in Phase 2, **When** user swipes left/right, **Then** user can browse through multiple trip options with smooth transitions

4. **Given** mobile user reviews detailed itinerary, **When** user scrolls through day-by-day activities, **Then** content is readable, images load appropriately sized for mobile, and "Get a free quote" button remains accessible (sticky footer or visible at bottom)

5. **Given** mobile user has slow network connection, **When** user sends chat message, **Then** system shows sending indicator, and if AI response is delayed, shows "AI is thinking..." message (prevents user from perceiving the app as broken)

---

### Edge Cases

- **What happens when user provides vague input?** (e.g., "I want a vacation") - AI asks clarifying questions: "What interests you? (History, Food, Nature, Films, Adventure, etc.)" and guides user to select a theme or provide more specific interests

- **What happens when research returns zero relevant destinations?** (e.g., "Breaking Bad filming locations in Antarctica") - AI responds: "I couldn't find destinations matching your request. Breaking Bad was filmed in Albuquerque, New Mexico. Would you like to explore those locations instead?" If user declines, offers to switch themes or try generic trip planning.

- **What happens when user confirms destinations but flight API returns no results?** (e.g., no flights to small regional airports) - System tries nearest major airport automatically, notifies user: "No direct flights to Cork. We found options via Dublin (1-hour drive to Cork). Does this work?" If user declines, asks for alternative departure city or destination.

- **What happens when user abandons conversation mid-research?** - System saves conversation state in database with status='researching'. If user returns within 24 hours, offers to continue: "Welcome back! I was researching Sullivan heritage sites in Ireland. Ready to see recommendations?" After 24 hours, offers fresh start or resume.

- **What happens when hotel API returns only luxury hotels but user selected Budget preference?** - System shows available options with disclaimer: "Most hotels in [destination] during [dates] are in higher price ranges ($200-300/night). We've included the best available options. Your travel agent may find better rates or suggest nearby towns with budget accommodations."

- **What happens when user tries to book a trip for tomorrow?** - System checks trip_days_min (minimum 3 days) and notices departure date is <7 days away, warns user: "Most flights and hotels require advance booking. Prices may be significantly higher for last-minute travel. Proceed anyway?" If user confirms, proceeds but flags as high-urgency in travel agent handoff.

- **What happens when admin diagnostic telemetry is requested but user is not admin?** - System returns 403 Forbidden for `/api/trips/:id/logs` endpoint, user chat interface never shows technical details regardless of role.

- **What happens when user's conversation includes multiple conflicting preferences?** (e.g., "Budget trip" then later "I want luxury hotels") - AI asks: "I noticed you mentioned budget earlier but now luxury hotels. Which is more important? I can create options at different price points if you'd like to compare."

- **What happens when template is misconfigured?** (e.g., missing required `research_query_template` field) - System logs error in admin telemetry, falls back to generic "Plan My Trip" template, shows user message: "We're having trouble loading this theme. Switched to general trip planning. You can still describe your ideal trip." Admin sees specific error: "Template ID heritage-001 missing research_query_template field."

## Requirements *(mandatory)*

### Functional Requirements

#### Phase 1: Destination Research

- **FR-001**: System MUST load trip template from database based on user's theme selection (Heritage, Wine & Food, Film Locations, etc.) and use template fields to drive all subsequent behavior

- **FR-002**: System MUST accept natural language user input describing trip interests (e.g., "Sullivan family from Cork, Ireland", "Breaking Bad filming locations", "Best wineries in Tuscany")

- **FR-003**: System MUST use template's `research_query_template` to construct web search queries based on user input (extract key terms, apply template patterns like "{surname} + origin country + heritage sites")

- **FR-004**: System MUST perform web searches (Serper or Tavily API) using constructed queries and return 10-30 search results per query

- **FR-005**: System MUST use template's `destination_criteria_prompt` to guide AI synthesis of search results into 2-4 destination recommendations (e.g., "prioritize ancestral towns, genealogy centers" for Heritage theme)

- **FR-006**: System MUST present destination recommendations in chat interface showing: Destination name, Geographic context (e.g., "30 min south of Cork"), 2-3 key sites or reasons relevant to theme, Brief travel logistics note if applicable

- **FR-007**: System MUST use template's `destination_confirmation_prompt` to ask user which destinations they want to explore, how many days, and any specific priorities

- **FR-008**: System MUST parse user's response to extract confirmed destinations (using AI to interpret natural language like "yes all three" or "skip Blarney, add Killarney")

- **FR-009**: System MUST store research results in `themed_trips.research_destinations` (JSON array of destination objects) and confirmed destinations in `themed_trips.confirmed_destinations` (JSON array of destination names)

- **FR-010**: System MUST NOT call booking APIs (Amadeus flights/hotels, Viator tours) during Phase 1—only web search APIs permitted

#### Phase 2: Trip Building

- **FR-011**: System MUST validate `themed_trips.destinations_confirmed = true` before allowing Phase 2 to proceed (prevents premature API calls)

- **FR-012**: System MUST call Amadeus Flight Offers Search API with: origin airport (from user preferences), destination airport (from confirmed destinations), departure date range (flexible based on duration preference), number of travelers, cabin class (derived from luxury level: Budget→Economy, Comfort→Premium Economy, Luxury→Business)

- **FR-013**: System MUST call Amadeus Hotel Search API for each confirmed destination with: city code, check-in/check-out dates (derived from itinerary structure), number of travelers, hotel rating filter (derived from luxury level: Budget→2-3 star, Comfort→3-4 star, Luxury→4-5 star)

- **FR-014**: System MUST call Viator tours API for each confirmed destination with: destination name, search keywords (from template's `tour_search_instructions` and `destination_criteria_prompt`, e.g., "heritage tours Cork", "genealogy experiences"), activity level filter (from user preferences)

- **FR-015**: System MUST use template's `options_prompt` to instruct AI on creating trip options (e.g., "Create 3 itineraries for {confirmed_destinations} with {user_preferences}, balancing cost, experience quality, and pacing")

- **FR-016**: System MUST generate 2-4 trip options (number defined by template's `number_of_options` field) with: Total cost in USD (including flights, hotels, tours, estimated meals, with 15% margin), Flight summary (airline, route, layovers, times), Hotel tier and locations, Number and types of tours included, Day-by-day itinerary overview

- **FR-017**: System MUST store trip options in `themed_trips.options_json` (JSON array of option objects) and mark status as 'options_ready'

- **FR-018**: System MUST allow user to select one trip option and view detailed itinerary showing: Day-by-day schedule with morning/afternoon/evening activities, Tour names and descriptions, Hotel names and addresses, Meal recommendations (template's `daily_activity_prompt` guides AI on meal suggestions), Estimated daily costs, Transportation between cities (template's `transport_preferences` guides recommendations: train, car rental, flight)

#### User Interface

- **FR-019**: System MUST display full-page chat interface with: User messages aligned right, AI messages aligned left, Scrollable message history, Text input box at bottom, Send button

- **FR-020**: System MUST display "Customize My Trip" preferences panel in expanded state by default (not collapsed) showing: Duration (dropdown: 3-5, 5-7, 7-10, 10-14, 14+ days), Travelers (number input: adults, optional children), Luxury Level (dropdown: Budget, Comfort, Luxury), Activity Level (dropdown: Relaxed, Moderate, Active), Departure Airport (text input with autocomplete)

- **FR-021**: System MUST allow user to collapse preferences panel after initial view, with button to re-expand at any time, and persist preference changes across conversation

- **FR-022**: System MUST show user-facing progress messages in chat during Phase 1 ("Researching [theme] destinations...") and Phase 2 ("Finding flights...", "Checking hotels...", "Discovering tours...") WITHOUT displaying technical details (no model names, costs, tokens, provider names, error stack traces)

- **FR-023**: System MUST show admin diagnostic telemetry in separate panel (only visible when `user.role='admin'` AND `diagnostics_enabled=true`) displaying: Research queries and result counts, AI model name, token counts (input/output), Cost per API call, Timing (ms) per operation, Full error messages and stack traces

- **FR-024**: System MUST render homepage with theme selection cards showing: Theme name and icon (e.g., "Heritage & Ancestry 🌳"), Brief description (from template's `description` field), Example search placeholder (from template's `example_inputs` field), 5 featured themes (where `featured=1`) + "Plan My Trip" generic option

#### Data Persistence

- **FR-025**: System MUST store all chat messages in `themed_trips.chat_history` (JSON array: `[{role: 'user'|'assistant', content: '...', timestamp: unix}]`)

- **FR-026**: System MUST update `themed_trips.status` field to reflect current phase: 'chat' (initial), 'researching' (Phase 1 in progress), 'awaiting_confirmation' (destinations presented, waiting for user), 'building_trip' (Phase 2 in progress), 'options_ready' (trip options available)

- **FR-027**: System MUST store user preferences in `themed_trips.preferences_json` (JSON object with duration, travelers, luxury_level, activity_level, departure_airport) and apply to all trip building operations

- **FR-028**: System MUST track progress message and progress_percent for user-facing display, updating `themed_trips.progress_message` and `themed_trips.progress_percent` fields

#### Travel Agent Handoff

- **FR-029**: System MUST generate structured handoff document when user clicks "Get a free quote from a travel pro" containing: User contact info (if collected), Selected trip option with full details, Confirmed destinations and preferences, Flight/hotel/tour selections, Total estimated cost, Special requests or notes from chat conversation

- **FR-030**: System MUST store handoff document in `themed_trips.handoff_json` and mark trip as ready for agent review (status or flag TBD in implementation)

#### Template Management

- **FR-031**: System MUST load all templates from `trip_templates` table at runtime—NO hardcoded theme logic permitted in application code

- **FR-032**: System MUST support adding new themes by inserting database records without code changes (all behavior defined in template fields: research_query_template, destination_criteria_prompt, research_synthesis_prompt, intake_prompt, options_prompt, etc.)

- **FR-033**: System MUST validate template completeness on load (required fields: name, research_query_template, destination_criteria_prompt, options_prompt) and log errors if template is misconfigured, falling back to generic "Plan My Trip" template

### Key Entities

- **Trip Template**: Defines all behavior for a theme (Heritage, Wine & Food, etc.). Attributes: id, name, description, icon, featured flag, search_placeholder, search_help_text, research_query_template, destination_criteria_prompt, research_synthesis_prompt, destination_confirmation_prompt, intake_prompt, options_prompt, daily_activity_prompt, number_of_options, trip_days_min/max, luxury_levels (JSON), activity_levels (JSON), transport_preferences (JSON), tour_search_instructions, hotel_search_instructions, flight_search_instructions, required_fields (JSON), optional_fields (JSON), example_inputs (JSON). Relationships: One template → Many trips.

- **Trip**: Represents a user's trip planning session. Attributes: id, user_id, template_id, correlation_id, chat_history (JSON array), research_destinations (JSON array), destinations_confirmed (boolean), confirmed_destinations (JSON array), preferences_json (JSON object), status (enum), progress_step, progress_message, progress_percent, intake_json, research_summary, options_json, selected_option_index, selected_flights, selected_hotels, selected_tours, final_itinerary, total_cost_usd, agency_id, handoff_json, timestamps. Relationships: Many trips → One template.

- **Destination (embedded in Trip)**: A location researched and recommended. Attributes: name, geographic_context, key_sites (array), travel_logistics_note, rationale (why it matches theme), estimated_days. Not a separate table—stored as JSON within trip.research_destinations.

- **Trip Option (embedded in Trip)**: A complete itinerary variation. Attributes: option_index, total_cost_usd, flight_summary, hotel_tier_description, tour_count, itinerary_highlights (brief), detailed_itinerary (day-by-day array of activities). Not a separate table—stored as JSON within trip.options_json.

- **User Preferences (embedded in Trip)**: User's travel constraints. Attributes: duration_range (e.g., "7-10 days"), travelers_adults, travelers_children, luxury_level (Budget/Comfort/Luxury), activity_level (Relaxed/Moderate/Active), departure_airport. Stored as JSON within trip.preferences_json.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users complete destination research phase (Phase 1) and confirm destinations in under 5 minutes from starting conversation (measured by time between first user message and `destinations_confirmed=true`)

- **SC-002**: 80% of users who view destination recommendations proceed to confirm destinations (measured by ratio of trips with `destinations_confirmed=true` to trips reaching `status='awaiting_confirmation'`)

- **SC-003**: System generates 2-4 complete trip options with real pricing within 2 minutes of user confirming destinations (measured by time between `destinations_confirmed=true` and `status='options_ready'`)

- **SC-004**: Average AI cost per trip is under $0.50 USD (measured by sum of all AI API costs logged in admin telemetry for Phase 1 + Phase 2, divided by completed trips reaching `status='options_ready'`)

- **SC-005**: System reduces booking API calls (Amadeus flights/hotels, Viator tours) by 70% compared to V1 baseline (measured by API call count per trip in V3 vs historical V1 data, where V3 only calls these APIs after confirmation)

- **SC-006**: Chat interface and all interactive elements function correctly on mobile devices with screen widths 320px-768px (measured by manual testing on 5 common mobile devices: iPhone SE, iPhone 14, Samsung Galaxy S21, iPad Mini, Android tablet)

- **SC-007**: Admin diagnostic telemetry displays full technical details (model names, costs, tokens, timing) for admin users while user-facing chat shows zero technical details (measured by code review and manual testing of admin vs non-admin user views)

- **SC-008**: System handles 100 concurrent users planning trips without response time degradation >20% (measured by load testing with 100 simulated concurrent chat sessions, comparing average response time to single-user baseline)

- **SC-009**: New trip themes can be added by inserting database records without code deployment (measured by test of adding "Photography Tours" template via database and verifying it appears on homepage and functions correctly without any code changes)

- **SC-010**: 90% of users successfully complete mobile trip planning flow from theme selection through viewing trip options on phone browsers (measured by mobile user testing sessions with task completion tracking)

## Assumptions

- Users have internet access and modern web browsers (Chrome, Firefox, Safari, Edge from last 2 years)
- Users are comfortable with chat-based interactions (precedent: ChatGPT, customer service chatbots)
- Booking APIs (Amadeus, Viator) have >95% uptime during business hours (standard SLA for travel APIs)
- Users will tolerate 1-2 minute wait times for AI research and trip building (common for complex search operations)
- 15% travel agent margin is built into displayed pricing (business requirement from PROMPT.md)
- Trip duration defaults to 7-10 days if user doesn't specify (most common leisure trip length)
- Departure airport defaults to user's nearest major airport based on IP geolocation (can be changed in preferences)
- Luxury level defaults to "Comfort" (mid-tier—most common booking preference)
- Users can resume conversations within 24 hours; after that, state may be archived (standard session timeout)
- Mobile devices run iOS 13+ or Android 9+ browsers (covers 95%+ of current mobile users)
- Admin users are identified by `user.role='admin'` field in database (authentication mechanism to be implemented)
- Web search APIs (Serper/Tavily) return 10-30 results per query with <2 second response time (per API documentation)
- AI synthesis of search results into destination recommendations takes 2-5 seconds (typical for LLM inference with 500-1500 token outputs)
- Templates can be updated in database at any time and changes take effect immediately on next trip creation (no caching issues)
