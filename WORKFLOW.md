# VoyGent Complete Workflow

This document describes the complete end-to-end workflow for the VoyGent themed travel planning application, from initial visit through agent handover, booking, and commission tracking.

## Phase 1: Initial Visit & Theme Selection

### 1.1 Homepage & Theme Discovery
- User visits voygent.app
- **Featured themes** display as icon cards (5 themes from database where `is_featured = 1`, sorted by `display_order`)
- "Browse All" button opens modal with:
  - Search input for filtering by theme name, description, or tags
  - Grid of all active themes from `trip_templates` table
  - Tag-based filtering (e.g., "family", "adventure", "history")
- User selects a theme (heritage, tvmovie, historical, culinary, adventure, or custom themes added via admin)

### 1.2 Theme Selection Impact
- Hero section updates with theme-specific messaging
- Input placeholder changes to match theme (e.g., "Roberts family interested in Scotland" for heritage)
- Form adapts to show theme-relevant quick start options

### 1.3 Input Options
User chooses between:
- **Quick Start**: Simple text description
- **Expanded Preferences**: Detailed form with fields specific to theme:
  - Heritage: surnames, suspected origins, immigration window
  - TV/Movie: titles, specific scenes, fan level
  - Historical: events, time periods, specific sites
  - Culinary: cuisines, regions, dietary restrictions, cooking classes
  - Adventure: activities, difficulty level, gear requirements

## Phase 2: Research & Intake Normalization

### 2.1 User Clicks "Create My Trip"
- POST to `/api/research` with:
  - `theme`: Selected theme ID
  - `text`: User's input description
  - `files`: Optional image uploads (OCR processed for text extraction)

### 2.2 Progress Display
- Real-time progress bar shows:
  - "Understanding your preferences..." (intake normalization)
  - "Researching [theme-specific topic]..." (web search phase)
  - "Analyzing destinations..." (if applicable)

### 2.3 Intake Normalization (Step 1)
**Endpoint**: `/api/research` line 71-119

**Process**:
1. Load theme template from database via `getTemplate(theme, env.DB)`
2. Use theme's custom `intakePrompt` (from `trip_templates.intake_prompt`)
3. Call LLM provider (OpenAI gpt-4o-mini in "cheap" mode) with:
   - System prompt: Theme-specific intake normalizer
   - User prompt: Combined text input + OCR extracted text
   - Max tokens: 1000
   - Temperature: 0 (deterministic)
4. Parse JSON response, extract structured data
5. Apply validation via `validateIntake()` which:
   - Validates theme-specific required fields
   - Applies defaults for missing common fields:
     - `party.adults = 2` if missing or < 1
     - `party.children = []` if missing
     - `party.accessibility = 'none'` if missing

**Output**: Structured intake object matching theme schema

**Diagnostics Tracked**:
- Provider used (openai/anthropic)
- Model name
- Token counts (input/output)
- Cost in USD
- Duration in milliseconds

### 2.4 Theme-Specific Research (Step 2)
**Endpoint**: `/api/research` line 133-436

**Research by Theme**:

#### Heritage Theme
- Query: `{surname} surname origin history Scotland Ireland England genealogy`
- Web search via Serper or Tavily API
- Extract: surname origins, historical context, regional ties
- Store: summary (800 chars), sources (top 3 URLs)

#### TV/Movie Theme
- Query: `{title} filming locations where to visit travel guide`
- Web search for filming sites
- Extract: location names, visitor information, tour options
- Store: summary, sources

#### Historical Theme
- Query: `{event} historical sites museums where to visit travel guide`
- Web search for sites related to historical event/period
- Extract: museums, monuments, key locations
- Store: summary, sources

#### Culinary Theme
- Query: `{cuisine} cuisine best restaurants regions where to eat travel guide`
- Web search for food regions and restaurants
- Extract: regional specialties, cooking schools, markets
- Store: summary, sources

#### Adventure Theme
- Query: `{activity} best destinations trails parks travel guide`
- Web search for adventure locations
- Extract: trails, parks, difficulty levels, seasons
- Store: summary, sources

**Output**: Research object with:
- `step`: Research type identifier
- `query`: Search query used
- `summary`: Truncated summary text
- `sources`: Array of source URLs
- `error`: Error message if search failed

### 2.5 Response to Frontend
Returns JSON with:
```json
{
  "intake": { /* structured intake data */ },
  "research": [ /* array of research steps */ ],
  "diagnostics": {
    "intake": { /* LLM call diagnostics */ }
  }
}
```

## Phase 3: Trip Options Generation

### 3.1 Frontend Automatically Calls Generate
After receiving research results, frontend automatically calls:
- POST to `/api/generate` with full research payload

### 3.2 Trip Options Creation (2-5 variants)
**Endpoint**: `/api/generate`

**Process**:
1. Load theme's `optionsPrompt` from database
2. Build context from:
   - Structured intake data
   - Research findings and sources
   - Theme-specific requirements
3. Call LLM provider (model based on PROVIDER_MODE):
   - System prompt: Theme-specific options generator
   - User prompt: "Generate 2-5 trip options with distinct approaches"
   - Max tokens: 4000
   - Temperature: 0.7 (creative but consistent)
4. Parse JSON array of trip options
5. Each option includes:
   - **key**: A, B, C, D, or E
   - **title**: Catchy trip name
   - **days**: Array of daily activities
   - **focus**: Main theme/approach
   - **highlights**: Key selling points

**Validation**: Each option validated via `validateOption()`

**Database Storage**:
- Insert into `themed_trips` table:
  - `intake_json`: Original intake data
  - `research_json`: Research results
  - `variants_json`: Array of trip options
  - `selected_variant`: null (not yet selected)
  - `theme`: Theme ID
  - `created_at`: Unix timestamp

**Output**: Trip ID + array of options

### 3.3 Display Trip Options
Frontend shows 2-5 trip cards with:
- Title
- Duration (X days)
- Brief description
- Highlights bullets
- "Select This Trip" button for each

## Phase 4: Hotel Selection

### 4.1 User Selects a Trip Option
- Frontend updates `themed_trips.selected_variant` to chosen key (A/B/C/D/E)
- Extracts unique locations from selected variant's days array

### 4.2 Hotel Search Per Location
**Endpoint**: `/api/providers/hotels`

**For each location in itinerary**:
1. Call Amadeus Hotel Search API:
   - cityCode: Geocoded from location name
   - checkInDate: Derived from day 1 of location stay
   - checkOutDate: Derived from last day of location
   - adults: From intake.party.adults
   - radius: 15km
   - radiusUnit: KM
   - ratings: Based on `luxury_level` preference
   - hotelName: Search filter if user specified
2. Return top 10-15 hotels sorted by:
   - Relevance to trip theme
   - Price per night
   - Rating
   - Proximity to planned activities

**Output per location**:
```json
{
  "location": "Edinburgh",
  "checkIn": "2025-06-15",
  "checkOut": "2025-06-18",
  "hotels": [
    {
      "hotelId": "...",
      "name": "...",
      "rating": 4.5,
      "price": {
        "currency": "USD",
        "total": 450,
        "perNight": 150
      },
      "address": "...",
      "amenities": [],
      "distance": { "value": 2.5, "unit": "KM" }
    }
  ]
}
```

### 4.3 User Selects Hotels
- Frontend displays hotel cards grouped by location
- User clicks "Select" on preferred hotel for each location
- Store selections in `themed_trips.variants_json.hotels`

## Phase 5: Flight Selection

### 5.1 Flight Search
**Endpoint**: `/api/providers/flights`

**Process**:
1. Determine origin from:
   - User's `departure_airport` preference
   - Detected location (IP-based)
   - Default to nearest major hub
2. Extract destination from first itinerary day
3. Extract return from last itinerary day
4. Call Amadeus Flight Offers Search:
   - originLocationCode: IATA code
   - destinationLocationCode: IATA code
   - departureDate: First day of trip
   - returnDate: Last day of trip (if round trip)
   - adults: From intake.party.adults
   - children: From intake.party.children
   - travelClass: Based on luxury_level
   - currencyCode: USD
   - max: 50 offers
5. Group by:
   - Outbound flight time (morning/afternoon/evening)
   - Number of stops (nonstop/1 stop/2+ stops)
   - Price range (economy/premium/business)

**Output**:
```json
{
  "offers": [
    {
      "id": "...",
      "price": {
        "currency": "USD",
        "total": 1200,
        "base": 950,
        "fees": 250
      },
      "outbound": {
        "departure": { "iataCode": "JFK", "at": "2025-06-15T08:00:00" },
        "arrival": { "iataCode": "EDI", "at": "2025-06-15T20:30:00" },
        "duration": "PT7H30M",
        "stops": 0,
        "carriers": ["BA"]
      },
      "return": { /* same structure */ }
    }
  ]
}
```

### 5.2 User Selects Flight
- Frontend displays flight cards grouped by price tier and stops
- User clicks "Select" on preferred flight
- Store selection in `themed_trips.variants_json.flights`

## Phase 6: Rental Car & Transportation

### 6.1 Car Rental Suggestion
**Endpoint**: `/api/providers/cars` (if `intake.transport.car_ok = true`)

**Process**:
1. Determine rental locations from itinerary
2. For each location segment requiring car:
   - Call Amadeus Car Rental API:
     - pickUpLocation: Airport or city center
     - dropOffLocation: Same or different city
     - pickUpDate: Segment start
     - dropOffDate: Segment end
     - provider: Major rental companies (Hertz, Avis, etc.)
3. Return options sorted by:
   - Price per day
   - Vehicle class (economy/standard/SUV)
   - Automatic vs manual transmission
   - Company rating

**Output**: Car rental options with pricing

### 6.2 Rail/Transport Alternatives
If `intake.transport.rail = true`:
- Suggest rail passes (Eurail, BritRail, etc.)
- Include point-to-point train options via Rail Europe API
- Compare costs: car rental vs rail vs driver-guide

## Phase 7: Tours & Activities

### 7.1 Viator Products Search
**Endpoint**: `/api/providers/tours`

**Process**:
1. For each location in itinerary:
   - Call Viator Search API:
     - destinationId: Location code
     - startDate: Range covering location days
     - endDate: Range end
     - categoryId: Filter by theme (heritage = historical tours, culinary = food tours)
     - sortOrder: TRAVELER_RATING
2. For each day's planned activities:
   - Match tours to activity type
   - Filter by:
     - Duration (must fit in day's schedule)
     - Price (within budget tier)
     - Rating (4+ stars preferred)
     - Availability (on specific dates)
3. Return top 3-5 tours per location

**Output per location**:
```json
{
  "location": "Edinburgh",
  "tours": [
    {
      "productCode": "...",
      "title": "Edinburgh Castle & Old Town Walking Tour",
      "description": "...",
      "duration": "PT3H",
      "price": {
        "currency": "USD",
        "amount": 75
      },
      "rating": 4.8,
      "reviewCount": 2341,
      "images": [],
      "cancellationPolicy": "Free cancellation up to 24 hours"
    }
  ]
}
```

### 7.2 Tours by Locals Integration
**Endpoint**: `/api/providers/guides`

**Process**:
- Search for local guides in destination cities
- Filter by:
  - Theme expertise (e.g., genealogy expert for heritage trips)
  - Languages spoken
  - Availability
  - Reviews
- Return top guides with contact info

### 7.3 Free Activities Suggestions
**Process**:
- For each location, suggest 5-10 free activities:
  - Public parks and gardens
  - Free museum days
  - Walking tours (self-guided)
  - Markets and festivals
  - Scenic viewpoints
  - Historical sites (no entry fee)
- Include in itinerary as "Optional Free Activities"

## Phase 8: Cost Estimation

### 8.1 Calculate Trip Cost
**Endpoint**: `/api/estimate/cost`

**Input**:
```json
{
  "trip_id": "...",
  "airfare": {
    "base_per_person": 950,
    "fees_per_person": 250
  },
  "hotels": [
    { "location": "Edinburgh", "total": 450, "nights": 3 },
    { "location": "Highlands", "total": 600, "nights": 4 }
  ],
  "car_rental": {
    "total": 280,
    "days": 7
  },
  "tours": [
    { "title": "...", "price_per_person": 75 },
    { "title": "...", "price_per_person": 120 }
  ],
  "meals_estimate": {
    "per_person_per_day": 80,
    "days": 7
  },
  "commission_pct": 12
}
```

**Calculation** (from `/functions/api/lib/cost-estimator.ts`):
1. **Airfare total**: (base + fees) × num_adults
2. **Hotels total**: Sum of all hotel costs
3. **Car rental total**: Daily rate × days
4. **Tours total**: Sum of selected tour prices × num_adults
5. **Meals estimate**: per_day_rate × num_days × num_adults
6. **Subtotal**: Sum of above
7. **Commission**: subtotal × (commission_pct / 100)
   - Default: 12% (range 10-15%)
8. **Grand total**: subtotal + commission
9. **Per person**: grand_total / num_adults

**Output**:
```json
{
  "subtotal": 5800,
  "commission_pct": 12,
  "commission_amount": 696,
  "total": 6496,
  "per_person": 3248,
  "breakdown": {
    "airfare": 2400,
    "hotels": 1050,
    "car_rental": 280,
    "tours": 390,
    "meals": 1120,
    "other": 560
  },
  "price_range": {
    "min": 3000,
    "max": 3500,
    "display": "$3,000-$3,500 per person"
  }
}
```

### 8.2 Store Cost Estimate
- Update `themed_trips.variants_json.cost_estimate` with calculation
- Display price range to user (not exact total yet)

## Phase 9: Detailed Itinerary Generation

### 9.1 Generate Markdown Itinerary
**Endpoint**: `/api/itinerary/generate`

**Process**:
1. Load selected trip variant from database
2. Combine:
   - Daily activities from variant
   - Selected hotels per location
   - Selected flights (outbound/return)
   - Selected car rental details
   - Selected tours and activities
   - Free activities suggestions
   - Cost estimate and price range
3. Call LLM provider with:
   - System prompt: "You are a professional travel writer. Create a beautiful, detailed itinerary in markdown format."
   - User prompt: Full trip context
   - Max tokens: 8000
   - Temperature: 0.5 (balanced)
4. Parse markdown output
5. Apply voygent.ai branding:
   - Add header with trip title and dates
   - Include day-by-day sections with:
     - Morning / Afternoon / Evening activities
     - Meal suggestions
     - Hotel information
     - Transportation details
     - Insider tips
   - Add footer with:
     - Price range
     - What's included / not included
     - Travel tips
     - Packing suggestions

**Output**: Formatted markdown itinerary

### 9.2 Display Itinerary
- Render markdown as HTML with styled components
- Add print/download buttons (PDF export)
- Show "Get a free quote from a travel professional" CTA button

## Phase 10: User Modifications via Chat

### 10.1 Itinerary Chat Interface
- User can request changes via chat input below itinerary
- Examples:
  - "Add an extra day in Edinburgh"
  - "Replace the castle tour with a whisky distillery"
  - "Find a cheaper hotel in the Highlands"
  - "Make this more family-friendly"

### 10.2 Chat Processing
**Endpoint**: `/api/chat/modify`

**Process**:
1. Load current itinerary from database
2. Send to LLM with:
   - System prompt: "You are a travel planning assistant. Modify the itinerary based on user requests."
   - Context: Current full itinerary + research + selections
   - User message: Change request
   - Max tokens: 8000
3. Parse updated itinerary
4. If changes affect pricing:
   - Recalculate cost estimate
   - Update price range display
5. Store new version in database with version history

**Output**: Updated itinerary markdown

### 10.3 Versioning
- Store each modification as new version in `themed_trips.variants_json.versions[]`
- Allow user to revert to previous versions
- Track changes for agent handover context

## Phase 11: Finalize & Request Quote

### 11.1 User Clicks "Get a free quote from a travel professional"
**Endpoint**: `/api/handoff/[trip_id]`

**Process**:
1. Validate trip is ready for handoff:
   - Has selected variant
   - Has cost estimate
   - Has detailed itinerary
2. Create handoff package:
   ```json
   {
     "trip_id": "...",
     "created_at": "...",
     "theme": "heritage",
     "intake": { /* original preferences */ },
     "research": { /* web search results */ },
     "selected_variant": { /* chosen trip option */ },
     "selections": {
       "hotels": [ /* hotel choices per location */ ],
       "flights": { /* outbound and return flights */ },
       "car_rental": { /* if applicable */ },
       "tours": [ /* selected tours and activities */ ]
     },
     "cost_estimate": { /* price breakdown */ },
     "itinerary": { /* markdown formatted itinerary */ },
     "modifications": [ /* chat history of changes */ ],
     "user_contact": {
       "name": "...",
       "email": "...",
       "phone": "...",
       "preferred_contact": "email"
     }
   }
   ```
3. Store handoff package in `themed_trips.handoff_json`
4. Set status: `themed_trips.status = 'awaiting_agent'`

### 11.2 Agent Notification
**Endpoint**: `/api/agents/notify`

**Process**:
1. Query for available agents who:
   - Have theme expertise (e.g., heritage travel specialists)
   - Have availability
   - Have good ratings
   - Are in compatible time zones
2. Send notification emails to top 3 agents with:
   - Trip summary (theme, destinations, dates)
   - Price range
   - Client preferences highlights
   - Link to claim trip: `voygent.app/agent/claim/{trip_id}`
3. Log notifications in database

## Phase 12: Agent Claims Trip

### 12.1 Agent Reviews Trip
**Endpoint**: `/agent/claim/{trip_id}`

**Agent sees**:
- Full handoff package
- Client preferences and research
- Selected hotels, flights, tours
- Cost estimate breakdown
- Chat modification history
- Client contact information

### 12.2 Agent Claims Trip
**Action**: POST `/api/agents/claim`

**Process**:
1. Validate agent credentials and availability
2. Update `themed_trips.assigned_agent_id = {agent_id}`
3. Update `themed_trips.status = 'agent_claimed'`
4. Send email to client: "Good news! A travel professional is reviewing your trip."
5. Send email to agent with:
   - Client expectations
   - Next steps for quoting
   - Link to agent dashboard

## Phase 13: Agent Builds Quote

### 13.1 Agent Dashboard
**URL**: `voygent.app/agent/dashboard`

**Agent can**:
- View claimed trips
- See client preferences
- Access supplier booking tools
- Build formal quotes

### 13.2 Quote Building Process
Agent uses external systems or VoyGent's back-end to:
1. **Verify availability**:
   - Call hotels to confirm rooms
   - Check flight inventory
   - Confirm tour bookings
2. **Get exact pricing**:
   - Hotel net rates + markup
   - Flight booking class costs
   - Tour operator quotes
   - Car rental confirmation
3. **Calculate commission**:
   - Typically 10-15% of subtotal
   - Disclosed or included in pricing
4. **Add value-adds**:
   - Booking protection
   - 24/7 support during trip
   - Airport transfers
   - Welcome gifts
5. **Create PDF quote** with:
   - Itemized pricing
   - Terms and conditions
   - Payment schedule (deposit + balance)
   - Cancellation policy
   - Agent contact information

### 13.3 Quote Submission
**Endpoint**: `/api/agents/submit-quote`

**Input**:
```json
{
  "trip_id": "...",
  "agent_id": "...",
  "quote": {
    "total_price": 6800,
    "deposit_required": 1700,
    "balance_due_date": "2025-05-15",
    "items": [
      {
        "category": "Airfare",
        "description": "Round-trip JFK-EDI",
        "quantity": 2,
        "unit_price": 1200,
        "total": 2400
      },
      {
        "category": "Hotels",
        "description": "3 nights Edinburgh + 4 nights Highlands",
        "total": 1150
      }
      /* ... more items ... */
    ],
    "terms": "...",
    "cancellation_policy": "...",
    "payment_link": "https://voygent.app/pay/{quote_id}"
  }
}
```

**Process**:
1. Store quote in database
2. Update `themed_trips.status = 'quote_ready'`
3. Generate payment link for deposit
4. Send email to client: "Your custom quote is ready!"

## Phase 14: Client Reviews Quote

### 14.1 Quote Presentation
**URL**: `voygent.app/quote/{quote_id}`

**Client sees**:
- Original itinerary with confirmed details
- Itemized pricing breakdown
- Total cost and deposit amount
- Payment schedule
- Terms and conditions
- Agent's photo and bio
- "Accept Quote & Pay Deposit" button
- "Request Changes" button (goes back to chat)

### 14.2 Client Accepts Quote
**Action**: Click "Accept Quote & Pay Deposit"

**Process**:
1. Redirect to payment page
2. Collect payment via  agent's back-end system:
   - Deposit amount (typically 25% of total)
   - Payment method (credit card)
   - Billing information
3. Process payment
4. Update `themed_trips.status = 'deposit_paid'`
5. Send confirmation emails:
   - To client: Receipt + booking confirmation
   - To agent: "Client paid deposit, proceed with booking"

## Phase 15: Agent Books Trip

### 15.1 Booking Process
Agent uses back-end systems to:
1. **Book flights**:
   - Confirm with airline or consolidator
   - Issue tickets
   - Send e-tickets to client
2. **Book hotels**:
   - Confirm reservations
   - Provide confirmation numbers
   - Send vouchers if needed
3. **Book tours**:
   - Reserve spots with tour operators
   - Provide confirmation codes
   - Send tickets/vouchers
4. **Arrange transfers**:
   - Book airport pickups
   - Arrange intercity transport
5. **Purchase insurance** (if selected):
   - Travel protection plan
   - Medical coverage
   - Cancel for any reason

### 15.2 Booking Confirmation
**Endpoint**: `/api/agents/confirm-booking`

**Input**:
```json
{
  "trip_id": "...",
  "agent_id": "...",
  "bookings": [
    {
      "type": "flight",
      "confirmation": "ABC123",
      "pnr": "XYZ456",
      "details": { /* flight details */ }
    },
    {
      "type": "hotel",
      "confirmation": "HOTEL789",
      "property": "The Balmoral",
      "details": { /* hotel details */ }
    }
    /* ... more bookings ... */
  ],
  "documents": [
    {
      "type": "itinerary",
      "url": "https://voygent.app/docs/itinerary_{trip_id}.pdf"
    },
    {
      "type": "voucher",
      "url": "https://voygent.app/docs/voucher_{trip_id}.pdf"
    }
  ]
}
```

**Process**:
1. Store booking confirmations in database
2. Update `themed_trips.status = 'booked'`
3. Send email to client with:
   - All confirmation numbers
   - Final itinerary PDF
   - Vouchers and tickets
   - Packing list
   - Pre-trip checklist
   - Agent's contact info for support

### 15.3 Balance Payment Collection
**30-45 days before departure**:
1. System sends email reminder: "Balance due in 30 days"
2. Client clicks payment link
3. Pay remaining balance via agent back-end system
4. Update `themed_trips.balance_paid_at = timestamp`
5. Agent receives notification: "Balance paid, trip fully funded"

## Phase 16: Pre-Trip Support

### 16.1 Automated Pre-Trip Emails
**Schedule**:
- **60 days before**: Passport/visa reminders
- **30 days before**: Balance due reminder
- **14 days before**: Packing list + weather forecast
- **7 days before**: Final itinerary + emergency contacts
- **1 day before**: "Have a great trip!" message

### 16.2 Agent Support
- Client can contact agent via:
  - Email
  - Phone
  - WhatsApp (if provided)
  - VoyGent messaging system
- Agent provides:
  - Itinerary clarifications
  - Last-minute changes
  - Travel advisories
  - Packing advice

## Phase 17: During Trip

### 17.1 Client Access
**URL**: `voygent.app/trips/{trip_id}`

**Client can**:
- View itinerary on mobile
- Access confirmation numbers
- See emergency contacts
- Contact agent for support
- Share trip with family (view-only link)

### 17.2 Agent Monitoring
- Agent receives notifications if:
  - Flight delays/cancellations
  - Weather alerts
  - Hotel issues reported
- Agent can proactively:
  - Rebook disrupted travel
  - Arrange alternative accommodations
  - Adjust itinerary in real-time

## Phase 18: Post-Trip & Commission

### 18.1 Post-Trip Follow-Up
**7 days after return**:
1. Send email: "How was your trip?"
2. Request review/testimonial
3. Offer discount on next trip (10%)
4. Collect photos for marketing (with permission)

### 18.2 Commission Tracking
**Endpoint**: `/api/finance/commissions`

**Process**:
1. Calculate commission breakdown:
   - Base commission: 10-15% of subtotal
   - Supplier overrides: Higher commissions from partners
   - Example:
     - Flights: 5% commission = $120
     - Hotels: 15% commission = $157.50
     - Tours: 20% commission = $78
     - Total commission: $355.50
2. Store in database:
   ```json
   {
     "trip_id": "...",
     "agent_id": "...",
     "total_trip_cost": 6800,
     "commission_earned": 816,
     "breakdown": [
       { "category": "flights", "base": 2400, "rate": 0.05, "amount": 120 },
       { "category": "hotels", "base": 1050, "rate": 0.15, "amount": 157.50 },
       { "category": "tours", "base": 390, "rate": 0.20, "amount": 78 }
     ],
     "platform_fee": 81.60,
     "agent_payout": 734.40,
     "payout_status": "pending",
     "payout_date": null
   }
   ```
3. Platform takes 10% of commission as fee
4. Agent receives 90% of commission

### 18.3 Revenue Sharing
**VoyGent's revenue sources**:
1. **Platform fee**: 10% of agent's commission
   - Example: $81.60 per trip (on $6800 trip)
2. **Supplier partnerships**: Override commissions
   - Hotels pay extra 2-5% for referrals
   - Tour operators pay bonus commissions
3. **Subscription model** (optional):
   - Agents pay $99/month for unlimited leads
   - Or pay per lead ($25-50 per claimed trip)

### 18.4 Agent Payout
**Monthly payout process**:
1. Calculate total commissions earned (trips completed)
2. Subtract platform fees
3. Subtract any refunds/chargebacks
4. Send payment via:
   - Direct deposit (ACH)
   - PayPal
   - Wire transfer
5. Provide detailed statement with trip references

## Phase 19: Analytics & Optimization

### 19.1 Trip Performance Tracking
**Metrics per trip**:
- Time to claim (agent response time)
- Time to quote (agent efficiency)
- Quote acceptance rate
- Average trip value
- Customer satisfaction score
- Agent rating

### 19.2 Theme Performance
**Metrics per theme**:
- Most popular themes
- Conversion rates (intake → quote → booking)
- Average trip values
- Research effectiveness (search result quality)
- Option generation success rate

### 19.3 Agent Performance
**Metrics per agent**:
- Number of trips claimed
- Quote acceptance rate
- Average quote turnaround time
- Customer ratings
- Rebooking rate (repeat clients)
- Total commission earned

### 19.4 Platform Optimization
Use data to:
- Improve intake prompts for better extraction
- Refine option generation for higher acceptance
- Optimize hotel/flight search algorithms
- Enhance cost estimation accuracy
- Identify popular new themes to add
- Train better LLM prompts

## Technical Architecture Summary

### Database Schema
**themed_trips** table:
- `id`: Trip UUID
- `theme`: Theme ID (foreign key to trip_templates)
- `intake_json`: Structured intake data
- `research_json`: Web search results
- `variants_json`: Array of trip options + selections
- `selected_variant`: Chosen option key (A/B/C/D/E)
- `handoff_json`: Agent handoff package
- `assigned_agent_id`: Agent who claimed trip
- `status`: Workflow state (draft/researching/awaiting_agent/agent_claimed/quote_ready/deposit_paid/booked/completed)
- `created_at`: Unix timestamp
- `updated_at`: Unix timestamp

**trip_templates** table:
- `id`: Template ID (heritage, tvmovie, etc.)
- `name`: Display name
- `description`: Theme description
- `icon`: Icon identifier
- `intake_prompt`: Custom intake normalizer prompt
- `options_prompt`: Custom options generator prompt
- `required_fields`: JSON array of required fields
- `optional_fields`: JSON array of optional fields
- `example_inputs`: JSON array of example user inputs
- `tags`: JSON array of searchable tags
- `is_featured`: Boolean (1 = show in featured section)
- `display_order`: Integer for featured theme ordering
- `is_active`: Boolean (1 = available for use)
- `created_at`: Unix timestamp
- `updated_at`: Unix timestamp

### API Endpoints
- `POST /api/research` - Intake normalization + web search
- `POST /api/generate` - Trip options generation
- `GET /api/templates` - List all active themes
- `POST /api/providers/hotels` - Search hotels
- `POST /api/providers/flights` - Search flights
- `POST /api/providers/cars` - Search rental cars
- `POST /api/providers/tours` - Search tours/activities
- `POST /api/estimate/cost` - Calculate trip cost
- `POST /api/itinerary/generate` - Generate markdown itinerary
- `POST /api/chat/modify` - Modify itinerary via chat
- `GET /api/handoff/{trip_id}` - Get handoff package for agent
- `POST /api/agents/claim` - Agent claims trip
- `POST /api/agents/submit-quote` - Agent submits quote
- `POST /api/agents/confirm-booking` - Agent confirms booking
- `GET /api/finance/commissions` - Commission tracking

### External APIs
- **OpenAI GPT-4o-mini**: Intake normalization, option generation
- **Anthropic Claude**: Alternative LLM provider
- **Serper API**: Google search for research
- **Tavily API**: Alternative search API
- **Amadeus API**: Flights, hotels, car rentals
- **Viator API**: Tours and activities
- **Tours by Locals API**: Local guide bookings
- **Stripe API**: Payment processing
- **SendGrid API**: Email notifications

### Frontend Components
- **theme-selector.js**: Dynamic theme selection from database
- **trip-progress.js**: Real-time progress display
- **hotel-selector.js**: Hotel search and selection UI
- **flight-selector.js**: Flight search and selection UI
- **itinerary-display.js**: Markdown itinerary renderer
- **chat-interface.js**: Itinerary modification chat
- **quote-display.js**: Agent quote presentation
- **payment-form.js**: Stripe payment integration

### Environment Variables / Secrets
- `OPENAI_API_KEY`: OpenAI API key
- `ANTHROPIC_API_KEY`: Anthropic API key
- `SERPER_API_KEY`: Serper search API key
- `TAVILY_API_KEY`: Tavily search API key
- `AMADEUS_CLIENT_ID`: Amadeus API client ID
- `AMADEUS_CLIENT_SECRET`: Amadeus API secret
- `VIATOR_API_KEY`: Viator API key
- `STRIPE_SECRET_KEY`: Stripe payment processing
- `SENDGRID_API_KEY`: Email notifications
- `DATABASE_ID`: D1 database ID (voygent-themed)

---

## Future Enhancements

### Phase 20: Mobile App
- Native iOS/Android apps
- Offline itinerary access
- Push notifications for flight changes
- In-trip photo journal
- Real-time agent chat

### Phase 21: AI Travel Companion
- During-trip AI assistant via WhatsApp/SMS
- Suggests alternative activities if weather bad
- Restaurant recommendations based on location
- Translation assistance
- Emergency support routing

### Phase 22: Group Trip Planning
- Multi-traveler coordination
- Split payment handling
- Group chat for trip planning
- Shared itinerary editing
- Group activity voting

### Phase 23: Loyalty Program
- Points for bookings
- Tier-based benefits (silver/gold/platinum)
- Exclusive deals and upgrades
- Referral rewards
- Anniversary trip discounts

### Phase 24: Agent Marketplace
- Agent profiles with specialties
- Client reviews and ratings
- Agent bidding on trips
- Premium agent tier (higher fee, faster response)
- Agent training and certification program

---

**Document Version**: 1.0
**Last Updated**: 2025-10-06
**Author**: VoyGent Development Team
**Status**: Ready for /specify command
