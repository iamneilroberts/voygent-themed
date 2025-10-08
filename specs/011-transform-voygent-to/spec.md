# Feature Specification: Transform Voygent to Prompt-Driven Template System

**Feature Branch**: `011-transform-voygent-to`
**Created**: 2025-10-07
**Status**: Draft
**Dependencies**: Feature 006 (Full Logging and Admin Dashboard)

## Problem Statement

Voygent currently has hard-coded trip creation logic with A/B variant comparison, heritage-specific workflows, and minimal diagnostic visibility. The system needs to become a generalized, prompt-driven platform that can support any trip theme (heritage, culinary, adventure, wellness, etc.) with all behavior, verbiage, and workflow controlled by database templates rather than code. Additionally, the production deployment shows obsolete code, and diagnostic features are missing.

The business model is: use the cheapest AI provider that will suffice to create detailed themed trips with accurate price estimates, then offer users "Get a free quote from a travel professional" to hand off an easy-to-quote document to travel agent subscribers. Travel agents quote in their backend software and the quote routes back to the user. This allows Voygent to minimize AI costs while enabling travel agents to earn comfortable commissions with minimal work.

## Goals

1. **Remove A/B Comparison**: Eliminate obsolete A/B variant comparison logic entirely
2. **Prompt-Driven Architecture**: Move all AI instructions, workflow logic, and user-facing text into the `trip_templates` table
3. **Integrated Diagnostics**: Add comprehensive diagnostic window with live logging from Feature 006
4. **Generalized Search**: Replace heritage-specific search with template-driven search that works for any trip theme
5. **Research-First Workflow**: Display AI research summary immediately; only build trips after research is shown to user
6. **Accurate Price Estimates**: Use Amadeus APIs for realistic flight/hotel pricing; estimate rental cars, tours, meals
7. **Travel Agent Handoff**: Generate structured quote document for travel agent subscribers to quote in their systems
8. **Template-Controlled Behavior**: All verbiage, search queries, trip options count, workflow steps driven by templates
9. **Production Deployment Verification**: Ensure voygent.app runs current code, not preview/obsolete versions

## Non-Goals

- Direct booking or payment processing (no transactions through Voygent)
- Acting as OTA or travel agency (we facilitate handoff to licensed agents)
- Deep genealogy research beyond trip planning needs
- Multi-language support in this phase

## User Scenarios & Testing

### Primary User Story
A traveler wants to plan any type of themed trip (heritage, culinary, film location, historical event, adventure, wellness). They enter what they're interested in through a generalized search, see AI-generated research about their interest, review multiple trip configurations based on their preferences, and receive a detailed itinerary with accurate price estimates for flights, hotels, rental cars, and curated tours—all controlled by the trip template selected. They then click "Get a free quote from a travel professional" which sends a structured handoff document to a travel agent subscriber who quotes the trip in their agency software and sends the official quote back to the traveler.

### Acceptance Scenarios

1. **Production Deployment Verification**
   - **Given** voygent.app is deployed, **When** user visits site, **Then** they see current code with no A/B comparison and diagnostic window present
   - **Given** deployment is checked, **When** reviewing Cloudflare settings, **Then** production environment points to main branch, not preview

2. **Generalized Trip Search**
   - **Given** user selects any trip template, **When** they see the search interface, **Then** all text, placeholders, and examples come from the template
   - **Given** user enters search term, **When** research begins, **Then** search query format is defined by template's `research_query_template`
   - **Given** "no trip theme" option exists, **When** selected, **Then** user can freeform describe any trip without theme constraints

3. **Research-First Workflow**
   - **Given** user submits trip interest, **When** research starts, **Then** progress updates show template-driven status messages
   - **Given** research completes, **When** AI summary is ready, **Then** it displays immediately with 2-3 paragraph summary (150-250 words)
   - **Given** research is displayed, **When** waiting to build trips, **Then** no trip options are generated until user sees research

4. **Diagnostic Integration**
   - **Given** Feature 006 logging is deployed, **When** user opens diagnostic window, **Then** they see real-time logs with request IDs, timing, provider calls
   - **Given** diagnostic window is open, **When** trip creation progresses, **Then** each workflow step appears with timestamps and status
   - **Given** error occurs, **When** viewing diagnostics, **Then** full error details with stack trace and context are visible

5. **Template-Driven Trip Options**
   - **Given** research summary is shown, **When** system builds trip options, **Then** number of options, trip days range, and configuration come from template
   - **Given** trip options are generated, **When** displayed to user, **Then** each option shows: title, summary, duration, estimated budget, "why we suggest" text
   - **Given** template defines luxury levels, **When** building options, **Then** options vary by budget from backpacker to luxury as template specifies

6. **Flight Price Estimates with Amadeus**
   - **Given** user selects a trip option, **When** system searches flights, **Then** Amadeus Flight Offers Search API returns pricing options
   - **Given** flight results exist, **When** presenting to user, **Then** show cheapest, shortest flight, and one upgrade option (comfort/business based on luxury level) as price estimates
   - **Given** user preferences include luxury="Occasional Luxe", **When** showing upgrades, **Then** include business/first class pricing estimates
   - **Given** user sees flight options, **When** viewing prices, **Then** prices are clearly labeled as estimates, not bookable fares

7. **Hotel Price Estimates with Amadeus**
   - **Given** trip has multiple locations, **When** searching hotels, **Then** Amadeus Hotel Search API queries each location for pricing
   - **Given** hotel results returned, **When** presenting to user, **Then** show 3-5 hotel options per location with estimated price ranges, ratings, amenities
   - **Given** luxury preference is "Backpack", **When** filtering hotels, **Then** emphasize budget options under $75/night
   - **Given** luxury preference is "Boutique" or higher, **When** filtering hotels, **Then** emphasize upscale options $150+/night
   - **Given** user reviews hotel options, **When** viewing prices, **Then** prices are daily rates and total estimates for the stay

8. **Transport & Tours**
   - **Given** trip itinerary includes driving, **When** estimating costs, **Then** calculate rental car based on days, number of travelers, and distance
   - **Given** trip uses rail transport, **When** showing options, **Then** estimate rail costs for intercity travel
   - **Given** luxury level is high, **When** considering transport, **Then** include hired driver options with cost estimates
   - **Given** trip locations identified, **When** searching tours, **Then** query TripAdvisor and Tours by Locals for small group/private tours
   - **Given** budget conscious preference, **When** selecting tours, **Then** minimize paid tours, prioritize free/low-cost activities
   - **Given** luxury preference high, **When** selecting tours, **Then** emphasize private guides, exclusive experiences

9. **Final Itinerary Presentation**
   - **Given** AI has generated complete itinerary, **When** presenting to user, **Then** show day-by-day breakdown with activities and estimated costs
   - **Given** each day in itinerary, **When** displaying activities, **Then** include mix of paid tours and free plans
   - **Given** each day listed, **When** showing rationale, **Then** display concise "why we suggest" text tying back to trip theme from template
   - **Given** complete itinerary, **When** presenting costs, **Then** show itemized estimate breakdown: flights, hotels, car rental, tours, meals estimate, total with 15-20% margin built in

10. **Travel Agent Quote Request**
    - **Given** user views complete itinerary with price estimates, **When** page loads, **Then** prominent "Get a free quote from a travel professional" button is visible
    - **Given** user clicks quote button, **When** form appears, **Then** user enters name, email, phone, and any special requests
    - **Given** user submits quote request, **When** processing, **Then** system generates comprehensive handoff document including: complete chat history, research summary, all flight options shown (with selected indicator), all hotel options shown (with selected indicator), daily itinerary, transport details, tours, preferences, budget breakdown, special requests
    - **Given** handoff document created, **When** routing to agent, **Then** document is available as both PDF (user-friendly) and JSON (machine-readable) formats
    - **Given** travel agent receives handoff, **When** reviewing document, **Then** agent sees entire trip context (what user asked for, what was researched, what options were presented, what was selected) plus all details needed to quote in agency software
    - **Given** agent creates quote, **When** quote is ready, **Then** system routes quote back to original user with agent contact information and official pricing

11. **Template-Controlled Workflow**
    - **Given** trip template defines workflow steps, **When** executing trip creation, **Then** system follows template's workflow_prompt instructions
    - **Given** template specifies number_of_options=5, **When** generating trips, **Then** create exactly 5 options
    - **Given** template defines search_instructions, **When** running research, **Then** use those instructions for web search and synthesis
    - **Given** template has custom verbiage fields, **When** showing UI text, **Then** all progress messages, labels, help text come from template

### Edge Cases

- **When** template has no `workflow_prompt` defined, **Then** fall back to sensible default workflow
- **When** Amadeus API returns no flights, **Then** show estimated pricing based on typical routes and note manual booking needed in handoff
- **When** hotel search returns < 3 options, **Then** use broader search radius or alternative sources; note limitation in handoff
- **When** tour search finds no results, **Then** suggest DIY activities and free attractions; include research links in handoff
- **When** user has accessibility requirements, **Then** filter hotels/tours for accessibility features; highlight in handoff document
- **When** trip spans multiple countries, **Then** handle currency conversion and display local prices with USD equivalent
- **When** diagnostic logging fails, **Then** continue trip creation without blocking, log error separately
- **When** no travel agents are subscribed, **Then** collect quote request but display message that agent will be assigned
- **When** user requests quote without providing contact info, **Then** prompt for required fields before generating handoff
- **When** estimated prices exceed user's stated budget, **Then** flag in handoff document and suggest budget adjustments to agent

## Requirements

### Functional Requirements

#### FR-001: Production Deployment Verification
- System MUST verify voygent.app points to production code, not preview deployment
- Admin dashboard MUST show current deployed version and branch
- Deployment pipeline MUST clearly distinguish production from preview environments

#### FR-002: Remove A/B Comparison Logic
- System MUST remove all code related to A/B variant comparison
- UI MUST NOT show "Variant A vs Variant B" comparison interface
- API endpoints for `/api/trips/:id/ab` MUST be removed or deprecated
- Database queries MUST NOT reference variant A/B fields

#### FR-003: Generalized Trip Search
- System MUST provide "No trip theme" option allowing freeform trip description
- Search interface MUST display template-specific placeholder text from `trip_templates.search_placeholder`
- Search examples MUST come from `trip_templates.example_inputs`
- Search help text MUST come from `trip_templates.search_help_text`

#### FR-004: Template Schema Extensions
- `trip_templates` table MUST add columns:
  - `search_placeholder` TEXT: placeholder text for search input
  - `search_help_text` TEXT: help text shown near search
  - `progress_messages` TEXT (JSON): status messages for each workflow step
  - `workflow_prompt` TEXT: AI instructions for orchestrating trip creation workflow
  - `number_of_options` INTEGER: how many trip options to generate (1-10)
  - `trip_days_min` INTEGER: minimum trip duration in days
  - `trip_days_max` INTEGER: maximum trip duration in days
  - `luxury_levels` TEXT (JSON): array of luxury options applicable to this template
  - `activity_levels` TEXT (JSON): array of activity levels (gentle, moderate, ambitious)
  - `transport_preferences` TEXT (JSON): transport options (rail, car, driver, mixed)
  - `tour_search_instructions` TEXT: how to search for tours (keywords, priorities)
  - `hotel_search_instructions` TEXT: how to filter hotels (style, amenities, location priorities)
  - `flight_search_instructions` TEXT: preferences for flights (direct vs connections, budget vs comfort)
  - `daily_activity_prompt` TEXT: AI instructions for planning each day's activities
  - `why_we_suggest_prompt` TEXT: AI instructions for generating "why we suggest" rationale

#### FR-005: Research-First Workflow
- System MUST complete research and display summary BEFORE generating trip options
- Research summary MUST appear immediately after research completes
- Research summary MUST be 150-250 words in 2-3 paragraphs
- Trip option generation MUST NOT start until research summary is displayed to user
- UI MUST show clear separation: Research Phase � Trip Options Phase � Booking Phase

#### FR-006: Integrated Diagnostics Window
- UI MUST display diagnostic/logging window accessible via toggle button
- Diagnostic window MUST show logs from Feature 006 logging system in real-time
- Each log entry MUST show: timestamp, severity, operation, message, duration
- Diagnostic window MUST filter logs by current trip's correlation_id
- Diagnostic window MUST support severity filtering (DEBUG, INFO, WARN, ERROR, CRITICAL)
- Diagnostic window MUST auto-scroll to newest entries
- Diagnostic window MUST be collapsible/expandable and persist state in session

#### FR-007: Amadeus Flight Price Estimates
- System MUST call Amadeus Flight Offers Search API for each trip to obtain realistic pricing
- Flight search MUST use parameters: origin, destination, departure date, return date, adults, children, cabin class
- System MUST retrieve at least 3 flight price estimates: cheapest, shortest, one upgrade option
- Upgrade option MUST be comfort/premium economy for luxury="Comfort" or "Savvy"
- Upgrade option MUST be business/first class for luxury="Boutique", "Occasional Luxe", "Full Luxury"
- Flight results MUST show: airline, departure/arrival times, duration, stops, estimated price, cabin class
- Prices MUST be clearly labeled as "Estimated" and not bookable through Voygent
- Flight estimates MUST be included in travel agent handoff document

#### FR-008: Amadeus Hotel Price Estimates
- System MUST call Amadeus Hotel Search API for each location in trip to obtain realistic pricing
- Hotel search MUST use parameters: city/lat-lon, check-in date, check-out date, adults, rooms
- System MUST retrieve 3-5 hotel options per location with varied price ranges
- Hotel results MUST show: name, star rating, estimated price per night, estimated total price, amenities, distance from center
- Hotel filtering MUST respect luxury preference:
  - "Backpack": hostels, budget hotels, <$75/night
  - "Savvy"/"Comfort": 3-4 star hotels, $75-175/night
  - "Boutique"/"Occasional Luxe": 4-5 star boutique, $175-350/night
  - "Full Luxury": 5-star luxury, $350+/night
- Prices MUST be clearly labeled as "Estimated" and not bookable through Voygent
- Hotel estimates MUST be included in travel agent handoff document with specific property names and categories

#### FR-009: Rental Car & Transport Estimation
- System MUST estimate rental car cost based on:
  - Number of days with driving activities
  - Number of travelers (vehicle size)
  - Country/region pricing (lookup table or API)
- System MUST estimate rail transport costs for intercity travel using distance and class
- System MUST offer hired driver option for luxury preferences with daily rate estimate
- Transport estimates MUST display breakdown: daily rate, number of days, total cost

#### FR-010: Tour & Activity Search
- System MUST search TripAdvisor API for tours, activities, and attractions at each location
- System MUST search Tours by Locals API for small group and private tours
- Tour search MUST use template's `tour_search_instructions` for keywords and filtering
- Tour results MUST be filtered by:
  - Budget preference (minimize tours for budget, maximize for luxury)
  - Activity level (gentle = cultural/sightseeing, ambitious = hiking/adventure)
  - Group size (small group or private based on luxury)
- System MUST show 2-5 tour options per location with: name, duration, price, rating, description
- System MUST suggest free activities (parks, monuments, self-guided walks) for budget trips

#### FR-011: Daily Itinerary Generation
- System MUST generate day-by-day itinerary for selected trip option
- Each day MUST include:
  - Date and location
  - 2-4 planned activities (mix of paid tours and free activities)
  - Meal suggestions (restaurants, local specialties)
  - Estimated daily cost
  - "Why we suggest" rationale tying activities to trip theme (using template's `why_we_suggest_prompt`)
- Itinerary MUST balance activity level: gentle = 2-3 activities/day, ambitious = 4-5 activities/day
- Days with long travel (flights, trains) MUST have fewer planned activities

#### FR-012: Template-Driven Prompts
- System MUST retrieve all AI prompts from `trip_templates` table, not hard-coded
- Research synthesis MUST use template's `research_synthesis_prompt`
- Trip options generation MUST use template's `options_prompt`
- Daily activity planning MUST use template's `daily_activity_prompt`
- Workflow orchestration MUST use template's `workflow_prompt`
- "Why we suggest" text MUST use template's `why_we_suggest_prompt`
- System MUST replace template variables (e.g., `{input}`, `{search_results}`, `{preferences}`) with actual values

#### FR-013: Template-Driven UI Verbiage
- All progress messages MUST come from template's `progress_messages` JSON
- Search input placeholder MUST come from template's `search_placeholder`
- Search help text MUST come from template's `search_help_text`
- Trip option cards MUST use template-defined labels and descriptions
- Error messages MUST have template-specific fallbacks for context-appropriate messaging

#### FR-014: User Preference Collection
- System MUST collect user preferences before generating trip options:
  - Number of days (range from template's `trip_days_min` to `trip_days_max`)
  - Luxury level (from template's `luxury_levels`)
  - Activity level (from template's `activity_levels`)
  - Transport preference (from template's `transport_preferences`)
  - Accessibility requirements (boolean + text description)
  - Dietary restrictions (text field)
  - Budget range (optional, min-max USD)
- Preferences MUST be passed to trip generation and used to filter/customize results

#### FR-015: Final Itinerary Presentation
- System MUST compile complete itinerary showing:
  - **Flights**: selected flight options with all details and estimated prices
  - **Hotels**: selected hotel options per location with estimated pricing
  - **Transport**: rental car or rail pass estimates with costs
  - **Daily Plan**: day-by-day activities, meals, "why we suggest" rationale
  - **Tours**: curated tour recommendations with pricing and booking info
  - **Cost Breakdown**: itemized estimated costs (flights, hotels, car, tours, meals estimate, total)
- All prices MUST be clearly labeled as "Estimates" with 15-20% margin built in
- Itinerary MUST display prominent "Get a free quote from a travel professional" button
- Itinerary MUST be shareable via unique URL
- System MUST use cheapest AI provider sufficient for quality trip generation (prioritize cost efficiency)

#### FR-016: Travel Agent Handoff Document
- System MUST generate structured handoff document when user requests quote
- Handoff document MUST include:
  - **Complete Chat History**: All user messages and AI responses from the trip creation session
  - **Research Summary**: Full AI-generated research summary shown to user
  - **Traveler Contact Information**: name, email, phone
  - **Trip Summary**: theme, destinations, dates, number of travelers, preferences
  - **All Flight Options Shown**: Every flight option presented to user with prices, with clear indicator of which was selected
  - **All Hotel Options Shown**: Every hotel option presented per location with prices, with clear indicator of which was selected
  - **Selected Daily Itinerary**: Complete day-by-day plan with activities, meals, "why we suggest" rationale
  - **Ground Transport Details**: rental car days/type, rail passes, hired driver needs with estimates
  - **Tour List**: All recommended tours with provider names, booking links, pricing
  - **User Preferences**: luxury level, activity level, transport preference, dietary restrictions, accessibility requirements
  - **Estimated Budget Breakdown**: Itemized by category (flights, hotels, car, tours, meals, total) with Voygent margin built in
  - **Special Requests**: Any additional notes or requirements from traveler
- Document format MUST be compatible with agency software (Sabre, Amadeus, Travelport) for easy quoting
- Document MUST be exportable as PDF (user-friendly) and structured JSON (machine-readable)
- Document MUST clearly show Voygent estimates to allow agent markup room for commission (15-20% margin)

#### FR-017: Travel Agent Quote Routing
- System MUST route handoff document to subscribed travel agent(s)
- System MUST track quote request status (sent, viewed by agent, quote returned)
- When agent completes quote, system MUST route quote back to original traveler
- Quote MUST include agent contact information for follow-up
- System MUST log all handoff and quote activities for admin visibility

#### FR-018: Logging Integration
- All API calls (Amadeus, TripAdvisor, Tours by Locals, LLM) MUST be logged via Feature 006 logging system
- Each workflow step MUST log: start time, end time, status, errors
- AI provider costs MUST be tracked and logged for each trip generation
- System MUST prioritize cheapest AI provider (Z.AI, OpenRouter) with cascading fallbacks
- Log entries MUST include correlation_id linking all logs for a single trip
- Diagnostic window MUST pull logs from `logs` table filtered by correlation_id
- Performance metrics (API response times) MUST be recorded in logs for admin dashboard

### Non-Functional Requirements

#### NFR-001: Performance
- Research phase MUST complete within 10 seconds for web search + synthesis
- Trip options generation MUST complete within 30 seconds for 3-5 options
- Flight search via Amadeus MUST complete within 5 seconds
- Hotel search via Amadeus MUST complete within 5 seconds per location
- Diagnostic window MUST update in real-time with < 2 second lag

#### NFR-002: Scalability
- Template system MUST support 50+ trip templates without performance degradation
- Template prompt fields MUST support up to 10,000 characters each
- System MUST handle 100 concurrent trip creations without API rate limit failures

#### NFR-003: Reliability
- API failures (Amadeus, TripAdvisor) MUST NOT block trip creation; show manual alternatives
- Template missing required fields MUST fall back to sensible defaults
- Diagnostic logging failure MUST NOT prevent trip creation

#### NFR-004: Usability
- Template-driven verbiage MUST make sense for each trip type without code changes
- Diagnostic window MUST be accessible to non-technical users (clear error messages, no jargon)
- Trip workflow MUST feel smooth with clear progress indicators at each phase

#### NFR-005: Maintainability
- Code MUST contain minimal hard-coded trip logic; all behavior in templates
- Adding new trip template MUST NOT require code changes
- Template schema MUST be documented with example values for each field

### Key Entities

#### Trip Template (Extended)
Stores all configuration, prompts, and verbiage for a trip theme type.

**Fields:**
- `id` TEXT: unique template identifier
- `name` TEXT: display name (e.g., "Heritage Trip", "Culinary Adventure")
- `description` TEXT: what this trip type offers
- `icon` TEXT: icon class or emoji
- `is_active` INTEGER: whether template is available
- `search_placeholder` TEXT: placeholder for search input (e.g., "Enter your surname or ancestral region")
- `search_help_text` TEXT: help text displayed near search
- `example_inputs` TEXT (JSON): array of example searches
- `research_query_template` TEXT: how to format web search query
- `research_synthesis_prompt` TEXT: AI prompt to synthesize research into summary
- `intake_prompt` TEXT: AI prompt to normalize user input
- `options_prompt` TEXT: AI prompt to generate trip options
- `workflow_prompt` TEXT: AI prompt orchestrating entire workflow
- `daily_activity_prompt` TEXT: AI prompt for planning daily activities
- `why_we_suggest_prompt` TEXT: AI prompt for generating rationale text
- `progress_messages` TEXT (JSON): status messages for each step (e.g., `{"research": "Researching your heritage...", "options": "Creating trip options..."}`)
- `number_of_options` INTEGER: how many trip options to generate (default 3)
- `trip_days_min` INTEGER: minimum days for trips of this type
- `trip_days_max` INTEGER: maximum days for trips of this type
- `luxury_levels` TEXT (JSON): applicable luxury levels (e.g., `["Backpack", "Savvy", "Comfort", "Boutique", "Occasional Luxe"]`)
- `activity_levels` TEXT (JSON): activity intensity options (e.g., `["gentle", "moderate", "ambitious"]`)
- `transport_preferences` TEXT (JSON): transport options (e.g., `["rail_first", "car_ok", "driver_guide", "mixed"]`)
- `tour_search_instructions` TEXT: how to search/filter tours
- `hotel_search_instructions` TEXT: how to filter/prioritize hotels
- `flight_search_instructions` TEXT: preferences for flights
- `required_fields` TEXT (JSON): input fields that must be provided
- `optional_fields` TEXT (JSON): optional input fields
- `created_at` INTEGER: timestamp
- `updated_at` INTEGER: timestamp

#### Trip (Extended)
Represents a single trip being planned.

**New/Modified Fields:**
- `template_id` TEXT: FK to trip_templates
- `correlation_id` TEXT: links all logs for this trip
- `research_summary` TEXT: displayed summary after research phase
- `research_completed_at` INTEGER: timestamp when research was shown to user
- `selected_option_index` INTEGER: which trip option user selected
- `selected_flight` TEXT (JSON): chosen flight details
- `selected_hotels` TEXT (JSON): chosen hotels per location
- `selected_transport` TEXT (JSON): car rental or rail pass details
- `selected_tours` TEXT (JSON): array of selected tours
- `final_itinerary` TEXT (JSON): complete day-by-day plan
- `total_cost_usd` REAL: sum of all trip components

#### Flight Option
Structure for Amadeus flight search results (stored in JSON). Prices are estimates only, not bookable.

**Fields:**
- `id`: Amadeus offer ID
- `airline`: carrier name
- `flight_number`: flight identifier
- `departure_time`: ISO timestamp
- `arrival_time`: ISO timestamp
- `duration`: minutes
- `stops`: number of connections
- `cabin_class`: economy, premium_economy, business, first
- `estimated_price_usd`: estimated total price (not bookable fare)

#### Hotel Option
Structure for Amadeus hotel search results (stored in JSON). Prices are estimates only, not bookable.

**Fields:**
- `id`: Amadeus hotel ID
- `name`: hotel name
- `star_rating`: 1-5 stars
- `address`: full address
- `distance_from_center_km`: distance to city center
- `estimated_price_per_night_usd`: estimated nightly rate
- `estimated_total_price_usd`: estimated rate × nights
- `amenities`: array of features (wifi, parking, breakfast, pool, etc.)
- `rating`: guest rating (e.g., 4.5/5)

#### Tour Option
Structure for TripAdvisor/Tours by Locals results (stored in JSON).

**Fields:**
- `id`: tour provider ID
- `name`: tour title
- `provider`: "TripAdvisor" or "Tours by Locals"
- `duration_hours`: tour length
- `price_usd`: per person cost
- `group_size`: "Private", "Small Group (2-10)", "Group (10+)"
- `rating`: average rating (e.g., 4.8/5)
- `description`: short summary
- `meeting_point`: where tour starts
- `booking_link`: URL to book

#### Travel Agent Handoff Document
Comprehensive document generated when user requests quote from travel agent. Stored in database and exportable.

**Fields:**
- `id`: unique handoff document ID
- `trip_id`: FK to trips table
- `created_at`: timestamp when handoff was requested
- `traveler_name`: user's name
- `traveler_email`: user's email
- `traveler_phone`: user's phone (optional)
- `chat_history`: complete JSON array of all messages exchanged during trip creation
- `research_summary`: full AI-generated research text shown to user
- `trip_summary`: JSON object with theme, destinations, dates, travelers count
- `flight_options_shown`: JSON array of all flight options presented, with `selected: true/false` flag
- `hotel_options_shown`: JSON array of all hotel options per location, with `selected: true/false` flag
- `daily_itinerary`: JSON array of day-by-day plan with activities and rationale
- `transport_details`: JSON object with rental car, rail, hired driver details and costs
- `tours_list`: JSON array of recommended tours with booking info
- `user_preferences`: JSON object with luxury, activity, transport, dietary, accessibility preferences
- `estimated_budget`: JSON object with breakdown by category and total
- `special_requests`: text field for additional notes
- `agent_id`: FK to travel agent assigned (or NULL if pending assignment)
- `status`: "pending", "assigned", "quoted", "booked", "cancelled"
- `quote_returned_at`: timestamp when agent provided quote (NULL if pending)
- `agent_quote_details`: JSON object with agent's official quote (prices, terms, booking deadline)

#### Log Entry (from Feature 006)
See Feature 006 spec for full schema. Key fields used in diagnostics:
- `id`, `request_id`, `correlation_id`, `timestamp`, `severity`, `operation`, `message`, `metadata`, `duration_ms`, `status`

## Review & Acceptance Checklist

### Content Quality
- [x] No implementation details (languages, frameworks, specific libraries)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies identified (Feature 006)

## Notes for Implementation Phase

**Known Dependencies:**
- Feature 006 (Full Logging and Admin Dashboard) MUST be deployed to production first
- Amadeus API credentials required (Flight Offers Search API, Hotel Search API)
- TripAdvisor API key required
- Tours by Locals API key required
- D1 database migrations to extend `trip_templates` schema

**Design Decisions Made:**
-  Template-driven architecture: all prompts and verbiage in database, not code
-  Research-first workflow: show summary before generating trip options
-  Remove A/B comparison: single trip option selected, no variants
-  Amadeus for flights/hotels: established travel API with good coverage
-  TripAdvisor + Tours by Locals: comprehensive tour coverage with ratings

**Design Decisions Still Needed:**
- API rate limiting strategy for Amadeus (cache results? throttle requests?)
- Fallback behavior when Amadeus returns no results (manual booking instructions? alternative APIs?)
- Tour API fallback if TripAdvisor/Tours by Locals unavailable
- Currency conversion approach (fixed exchange rates? live API?)

**Success Metrics:**
- 100% of trip types driven by templates without code changes
- Research summary displayed within 10 seconds
- Complete bookable itinerary (flights, hotels, tours) generated within 60 seconds
- Diagnostic window shows all workflow steps in real-time
- Zero A/B comparison code remaining in production
- Admin can create new trip template via admin dashboard without developer involvement

**Migration Plan:**
1. Deploy Feature 006 to production if not already done
2. Extend `trip_templates` schema with new columns
3. Update existing templates with new fields (use sensible defaults)
4. Remove A/B comparison code from frontend and backend
5. Implement generalized search UI reading from templates
6. Integrate diagnostic window with Feature 006 logs
7. Implement research-first workflow with display gate
8. Integrate Amadeus Flight API
9. Integrate Amadeus Hotel API
10. Implement transport cost estimation
11. Integrate TripAdvisor and Tours by Locals APIs
12. Build daily itinerary generator using template prompts
13. Create final itinerary presentation UI
14. Add PDF export and shareable link functionality
15. Verify production deployment points to correct code
16. Test end-to-end with multiple trip templates

**Security Considerations:**
- API keys for Amadeus, TripAdvisor, Tours by Locals MUST be stored securely (Cloudflare secrets)
- Diagnostic logs MUST sanitize PII per Feature 006 requirements
- Shareable trip URLs MUST use non-guessable tokens (UUID)
- Template prompts MUST be validated for prompt injection attacks before use
