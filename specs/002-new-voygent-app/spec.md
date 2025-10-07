# Voygent " Interface Redesign & Agent Handoff Enhancement

## Problem

The current voygent.app interface has several UX issues:
1. **Cluttered layout**: Theme selector, quick start, and customize sections take up too much vertical space
2. **Confusing flow**: Two separate buttons ("Create My Trip" and "Generate Trip Options") with unclear distinction
3. **Hidden themes**: Users must click "Browse All" to discover non-featured themes
4. **No progress visibility**: "Generate Trip Options" button shows no feedback during long-running operations
5. **Incomplete agent handoff**: Missing critical traveler details needed for quote generation
6. **No white-label support**: Agencies can't customize branding for their clients

## Goals

### Interface Redesign
1. **Compact theme selector**: Display 5 featured themes as compact icon buttons in a single row
2. **Scrollable theme discovery**: Horizontal carousel showing 6th+ themes (no modal required)
3. **Single unified input**: Dynamic quick-search field that changes placeholder based on selected theme
4. **Single action button**: One "Generate Trip Options" button that works for both simple and detailed inputs
5. **Organized customization**: Collapse all detailed fields (including Upload Documents) into "Customize Your Trip"
6. **Progress feedback**: Real-time progress indicators during trip generation

### Agent Handoff Enhancement
7. **Complete traveler intake**: Capture all details agents need to create quotes
8. **White-label branding**: Support agency-level customization (logo, colors, domain)
9. **Seamless handoff**: Store all traveler details with trip for agent access

## Non-Goals (This Phase)

- No changes to backend trip generation logic (already works)
- No payment processing (quotes happen in agent's system)
- No agent dashboard UI (separate feature)
- No real-time collaboration features

## User Journeys

### Primary Journey: Traveler Creates Trip
1. User lands on voygent.app (or white-labeled agency.travelagent.com)
2. Sees 5 featured theme icons + horizontal scroll of 6+ more themes
3. Clicks "Heritage & Ancestry" theme
4. Quick search field updates: "Enter family surname (e.g., McLeod)"
5. User types "Roberts" and clicks "Generate Trip Options"
6. **Progress indicator shows**: "Understanding your preferences..." ’ "Researching Roberts family heritage sites..." ’ "Creating trip options..."
7. System displays 2-4 trip options with research summary
8. User selects an option, reviews itinerary
9. User clicks "Get a free quote from a travel professional"
10. **Traveler Intake Form** appears with fields for:
    - Full name(s) of all travelers
    - Email (pre-filled if available)
    - Phone number
    - Ages of all travelers
    - Passport status (valid/expired/none)
    - Special dietary/medical restrictions
    - Airline loyalty programs (e.g., Delta SkyMiles #)
    - Hotel loyalty programs (e.g., Marriott Bonvoy #)
    - Preferred contact method
11. User submits form
12. Confirmation: "Thanks! A travel professional will contact you within 24 hours."
13. Backend creates handoff record with all trip details + traveler info

### Alternative Journey: Detailed Customization
1. User clicks theme, enters quick search
2. **Clicks "Customize Your Trip"** to expand
3. Fills in detailed fields: origins, duration, luxury level, transport preferences
4. **Uploads genealogy documents** (now in same section)
5. Clicks single "Generate Trip Options" button at bottom
6. Same progress flow as above

### Agency White-Label Journey
1. Agency (e.g., "Heritage Travel Experts") subscribes to white-label tier
2. Admin configures:
   - Custom domain: clients.heritagetravel.com
   - Logo upload
   - Brand colors (primary, accent)
   - Agency contact info
3. Client receives email: "Plan your trip at clients.heritagetravel.com"
4. Client sees agency's branding throughout experience
5. When requesting quote, client info goes directly to agency's agent pool

## Top Risks

1. **Layout complexity on mobile**: Horizontal theme scroll may be awkward on small screens
   - *Mitigation*: Test on mobile, fall back to vertical stack if needed
2. **Progress indicator accuracy**: Backend doesn't currently emit progress events
   - *Mitigation*: Use estimated timing based on typical durations, add real events in future
3. **Form abandonment**: Long traveler intake form may discourage quote requests
   - *Mitigation*: Make most fields optional, save partial progress
4. **White-label configuration overhead**: Complex admin UI
   - *Mitigation*: Start with simple config (logo + colors only), expand later

## Acceptance Criteria

### Interface Redesign
- [ ] Theme selector displays 5 featured themes in single compact row (max height: 120px)
- [ ] 6th+ themes appear in horizontal scrollable carousel below featured themes
- [ ] Clicking theme updates quick-search placeholder to theme-specific text
- [ ] Single "Generate Trip Options" button at bottom works for both simple and detailed inputs
- [ ] "Customize Your Trip" section collapses by default, expands on click
- [ ] "Upload Documents" section moved inside "Customize Your Trip"
- [ ] Progress indicator shows during trip generation with theme-specific messages
- [ ] All sections properly responsive on mobile (320px width minimum)

### Agent Handoff Enhancement
- [ ] "Get a free quote" button appears after itinerary generation
- [ ] Clicking button shows traveler intake form modal/section
- [ ] Form captures: full names, email, phone, ages, passport status, restrictions, loyalty programs
- [ ] Form validates required fields (name, email) before submission
- [ ] Form stores data in `themed_trips.handoff_json` field
- [ ] Confirmation message displays after successful submission
- [ ] Backend endpoint: `POST /api/trips/:id/request-quote` creates handoff record

### White-Label Branding
- [ ] Admin endpoint: `POST /api/agencies/:id/branding` accepts logo, colors, domain
- [ ] Frontend checks domain and loads agency branding from database
- [ ] Agency logo displays in header (falls back to Voygent logo)
- [ ] Agency colors override default purple/blue theme
- [ ] "Get a free quote" button shows agency name (e.g., "Get quote from Heritage Travel Experts")
- [ ] Handoff records include agency_id for routing to correct agent pool

## Technical Approach

### Frontend Changes (public/index.html + js/)

#### Theme Selector Redesign
```html
<!-- Compact featured themes (single row) -->
<div class="theme-selector-compact">
  <button class="theme-btn" data-theme="heritage"><3 Heritage</button>
  <button class="theme-btn" data-theme="tvmovie"><¬ TV/Movie</button>
  <button class="theme-btn" data-theme="historical">” Historical</button>
  <button class="theme-btn" data-theme="culinary"><t Culinary</button>
  <button class="theme-btn" data-theme="adventure"><Ô Adventure</button>
</div>

<!-- Horizontal scroll for additional themes -->
<div class="theme-carousel">
  <div class="theme-scroll-container">
    <!-- Dynamically loaded from /api/templates -->
  </div>
</div>
```

#### Unified Input Section
```html
<div class="quick-search-section">
  <h2 id="themeTitle">Heritage & Ancestry Trip</h2>
  <input
    type="text"
    id="quickSearch"
    placeholder="Enter family surname (e.g., McLeod)"
    data-heritage-placeholder="Enter family surname (e.g., McLeod)"
    data-tvmovie-placeholder="Enter show/movie name (e.g., Game of Thrones)"
    data-historical-placeholder="Enter historical event (e.g., D-Day Normandy)"
    data-culinary-placeholder="Enter cuisine or region (e.g., Tuscany pasta)"
    data-adventure-placeholder="Enter activity (e.g., Patagonia hiking)"
  />

  <div class="or-divider">
    <span>OR</span>
  </div>

  <details id="customizeSection">
    <summary>=Ý Customize Your Trip</summary>
    <div class="customize-content">
      <!-- Theme-specific fields -->
      <!-- Common fields: duration, dates, party size, etc. -->

      <!-- Upload Documents (moved here) -->
      <div class="upload-section">
        <h3>=Î Upload Documents</h3>
        <input type="file" multiple />
      </div>
    </div>
  </details>

  <button id="generateBtn" class="primary-action">
    ( Generate Trip Options
  </button>
</div>
```

#### Progress Indicator
```html
<div id="progressOverlay" class="hidden">
  <div class="progress-modal">
    <div class="spinner"></div>
    <p id="progressMessage">Understanding your preferences...</p>
    <div class="progress-bar">
      <div class="progress-fill" id="progressFill"></div>
    </div>
  </div>
</div>
```

**JavaScript** (`public/js/progress.js`):
```javascript
const PROGRESS_STEPS = {
  heritage: [
    { percent: 10, message: 'Understanding your preferences...', duration: 2000 },
    { percent: 40, message: 'Researching Roberts family heritage sites...', duration: 8000 },
    { percent: 70, message: 'Creating trip options...', duration: 10000 },
    { percent: 95, message: 'Finalizing itinerary...', duration: 5000 }
  ],
  // ... other themes
};

function showProgress(theme) {
  const steps = PROGRESS_STEPS[theme];
  document.getElementById('progressOverlay').classList.remove('hidden');

  let currentStep = 0;
  function advance() {
    if (currentStep >= steps.length) return;

    const step = steps[currentStep];
    document.getElementById('progressMessage').textContent = step.message;
    document.getElementById('progressFill').style.width = step.percent + '%';

    currentStep++;
    setTimeout(advance, step.duration);
  }

  advance();
}
```

#### Traveler Intake Form
```html
<div id="travelerIntakeModal" class="modal hidden">
  <div class="modal-content">
    <h2>Complete Your Quote Request</h2>
    <p>Help us connect you with the perfect travel professional</p>

    <form id="travelerIntakeForm">
      <!-- Required fields -->
      <div class="form-group">
        <label>Primary Traveler Name *</label>
        <input type="text" name="primary_name" required />
      </div>

      <div class="form-group">
        <label>Email *</label>
        <input type="email" name="email" required />
      </div>

      <div class="form-group">
        <label>Phone Number</label>
        <input type="tel" name="phone" />
      </div>

      <!-- Optional fields (collapsible) -->
      <details>
        <summary>Additional Traveler Details (Optional)</summary>

        <div class="form-group">
          <label>All Travelers (names and ages)</label>
          <textarea name="travelers" placeholder="e.g., John Smith (45), Jane Smith (42), Emily Smith (12)"></textarea>
        </div>

        <div class="form-group">
          <label>Passport Status</label>
          <select name="passport_status">
            <option value="">Select...</option>
            <option value="all_valid">All travelers have valid passports</option>
            <option value="some_expired">Some passports expired or expiring soon</option>
            <option value="none">No passports yet</option>
          </select>
        </div>

        <div class="form-group">
          <label>Dietary or Medical Restrictions</label>
          <textarea name="restrictions" placeholder="e.g., vegetarian, wheelchair accessible"></textarea>
        </div>

        <div class="form-group">
          <label>Airline Loyalty Programs</label>
          <input type="text" name="airline_loyalty" placeholder="e.g., Delta SkyMiles #123456" />
        </div>

        <div class="form-group">
          <label>Hotel Loyalty Programs</label>
          <input type="text" name="hotel_loyalty" placeholder="e.g., Marriott Bonvoy #987654" />
        </div>

        <div class="form-group">
          <label>Preferred Contact Method</label>
          <select name="contact_method">
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="either">Either</option>
          </select>
        </div>
      </details>

      <button type="submit" class="primary-action">
        Submit Quote Request
      </button>
    </form>
  </div>
</div>
```

### Backend Changes

#### New Endpoint: POST /api/trips/:id/request-quote
```typescript
// functions/api/trips/[id]/request-quote.ts
export async function onRequestPost(context: { request: Request; env: Env; params: { id: string } }) {
  const { request, env, params } = context;
  const tripId = params.id;

  const formData = await request.json();

  // Validate required fields
  if (!formData.primary_name || !formData.email) {
    return new Response(JSON.stringify({
      error: 'Missing required fields',
      details: 'primary_name and email are required'
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // Load existing trip
  const trip = await env.DB
    .prepare('SELECT * FROM themed_trips WHERE id = ?')
    .bind(tripId)
    .first();

  if (!trip) {
    return new Response(JSON.stringify({
      error: 'Trip not found'
    }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }

  // Build handoff payload
  const handoffPayload = {
    traveler: {
      primary_name: formData.primary_name,
      email: formData.email,
      phone: formData.phone || null,
      all_travelers: formData.travelers || null,
      passport_status: formData.passport_status || null,
      restrictions: formData.restrictions || null,
      airline_loyalty: formData.airline_loyalty || null,
      hotel_loyalty: formData.hotel_loyalty || null,
      contact_method: formData.contact_method || 'email'
    },
    trip: {
      theme: trip.theme,
      intake: JSON.parse(trip.intake_json),
      research: JSON.parse(trip.research_json),
      selected_variant: trip.selected_variant,
      itinerary: JSON.parse(trip.variants_json)
    },
    requested_at: new Date().toISOString(),
    agency_id: formData.agency_id || null  // For white-label routing
  };

  // Store handoff payload
  await env.DB
    .prepare('UPDATE themed_trips SET handoff_json = ?, status = ?, updated_at = unixepoch() WHERE id = ?')
    .bind(JSON.stringify(handoffPayload), 'quote_requested', tripId)
    .run();

  // TODO: Notify agent pool (separate feature)

  return new Response(JSON.stringify({
    success: true,
    message: 'Quote request submitted successfully'
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
```

#### New Endpoint: GET /api/branding (White-Label)
```typescript
// functions/api/branding/index.ts
export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;

  // Extract domain from request
  const url = new URL(request.url);
  const hostname = url.hostname;

  // Check if custom domain exists in agencies table
  const agency = await env.DB
    .prepare('SELECT * FROM agencies WHERE custom_domain = ?')
    .bind(hostname)
    .first();

  if (!agency) {
    // Return default Voygent branding
    return new Response(JSON.stringify({
      name: 'Voygent',
      logo_url: '/logo.png',
      primary_color: '#667eea',
      accent_color: '#764ba2',
      agency_id: null
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // Return agency branding
  return new Response(JSON.stringify({
    name: agency.name,
    logo_url: agency.logo_url,
    primary_color: agency.primary_color,
    accent_color: agency.accent_color,
    agency_id: agency.id
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
```

#### Database Schema Addition
```sql
-- Migration: Add agencies table for white-label
CREATE TABLE IF NOT EXISTS agencies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  custom_domain TEXT UNIQUE,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#667eea',
  accent_color TEXT DEFAULT '#764ba2',
  contact_email TEXT,
  contact_phone TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Add agency_id to themed_trips for routing
ALTER TABLE themed_trips ADD COLUMN agency_id TEXT REFERENCES agencies(id);

-- Add handoff_json and status columns (if not exists)
ALTER TABLE themed_trips ADD COLUMN handoff_json TEXT;
ALTER TABLE themed_trips ADD COLUMN status TEXT DEFAULT 'draft';
-- Status values: draft, researching, options_generated, quote_requested, quote_provided, booked
```

## Dependencies

### Intersects with 002-trip-handover
This spec enhances the existing trip handover work by:
1. Adding complete traveler intake form (extends handoff payload)
2. Adding white-label branding support (routing to agency agent pools)
3. Updating handoff_json schema to include traveler details

**Action Required**: Update `specs/002-trip-handover-to/plan.md` to reference:
- New traveler intake form fields (primary_name, email, phone, etc.)
- White-label agency_id routing
- Updated handoff_json schema

### No Breaking Changes
- All existing API endpoints continue to work
- Database migrations are additive only
- Frontend changes are contained to index.html and new JS modules

## Success Metrics

1. **User engagement**: 50% reduction in bounce rate on homepage (fewer users leaving without starting trip)
2. **Quote requests**: 30% increase in "Get a free quote" clicks (better traveler info capture)
3. **Mobile usage**: No degradation in mobile traffic (responsive design maintained)
4. **White-label adoption**: 5+ agencies sign up for white-label tier within 60 days

## Open Questions

1. Should horizontal theme carousel auto-scroll or require manual interaction?
2. What's the minimum viable white-label config (just logo + colors, or more)?
3. Should traveler intake form support multiple contact persons (e.g., trip organizer + spouse)?
4. How do we handle form field validation errors gracefully (inline vs. modal)?

## Timeline Estimate

- Interface redesign (HTML/CSS/JS): 2-3 days
- Progress indicators: 1 day
- Traveler intake form + backend: 1-2 days
- White-label branding (basic): 2 days
- Testing + polish: 1-2 days

**Total**: 7-10 days for complete implementation

## Future Enhancements (Out of Scope)

- Real-time progress events from backend (WebSocket/SSE)
- Agency admin dashboard for branding config
- Multi-language support for white-label clients
- Saved traveler profiles (auto-fill on return visits)
- Agent response time tracking
