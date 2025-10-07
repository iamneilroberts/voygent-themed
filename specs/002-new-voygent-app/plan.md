# Voygent " Interface Redesign & Agent Handoff  Implementation Plan

## Overview
This plan implements a cleaner, more intuitive voygent.app interface with:
1. Compact theme selector (5 featured + scrollable carousel)
2. Unified quick-search input with single action button
3. Real-time progress indicators
4. Complete traveler intake form for agent handoff
5. White-label branding support for agencies

## Architecture

### Frontend (No Changes to Backend Trip Generation)
- **Static HTML/JS**: Single-page app with ES6 modules
- **No build step**: Direct JS imports, native browser features
- **Responsive**: Mobile-first, 320px+ width support
- **Progressive enhancement**: Works without JS for basic form submission

### Backend Additions
- **New endpoint**: `POST /api/trips/:id/request-quote` (traveler intake)
- **New endpoint**: `GET /api/branding` (white-label config)
- **Database migrations**: Add `agencies` table, extend `themed_trips`

### White-Label Architecture
```
User visits: clients.heritagetravel.com
             “
Frontend checks domain ’ GET /api/branding
             “
Returns: { name, logo_url, primary_color, accent_color, agency_id }
             “
Apply branding to UI, store agency_id in localStorage
             “
On quote request: Include agency_id ’ routes to agency's agent pool
```

## Phase 1: Frontend Interface Redesign (3 days)

### 1.1 Theme Selector Refactor
**Files**: `public/index.html`, `public/js/theme-selector.js`

**Changes**:
- Replace large theme cards with compact button row
- Add horizontal scroll container for 6+ themes
- Update CSS for compact layout (max height: 120px)
- Ensure mobile responsiveness (stack on <600px width)

**Code Structure**:
```javascript
// public/js/theme-selector.js
export function renderCompactThemes(themes) {
  const featured = themes.filter(t => t.isFeatured).sort((a,b) => a.displayOrder - b.displayOrder);
  const additional = themes.filter(t => !t.isFeatured);

  renderFeaturedRow(featured.slice(0, 5));
  renderCarousel(featured.slice(5).concat(additional));
}
```

**Acceptance Criteria**:
- [ ] 5 featured themes display in single row (flex layout)
- [ ] 6+ themes appear in horizontally scrollable carousel
- [ ] Clicking theme highlights button and updates selectedTheme
- [ ] Works on mobile (320px width minimum)

### 1.2 Unified Quick Search Input
**Files**: `public/index.html`, `public/js/quick-search.js`

**Changes**:
- Replace "Follow Your Family Roots" section with dynamic quick-search
- Add data attributes for theme-specific placeholders
- Update on theme change via event listener
- Move "Create My Trip" button to bottom (becomes "Generate Trip Options")

**HTML Structure**:
```html
<div class="quick-search-section">
  <h2 id="themeTitle">Heritage & Ancestry Trip</h2>
  <input
    type="text"
    id="quickSearch"
    placeholder="Enter family surname (e.g., McLeod)"
  />

  <div class="or-divider"><span>OR</span></div>

  <!-- Customize section below -->
</div>
```

**Acceptance Criteria**:
- [ ] Quick search field placeholder updates when theme changes
- [ ] Title updates to match selected theme
- [ ] "OR" divider visually separates quick vs. detailed input

### 1.3 Collapsible Customize Section
**Files**: `public/index.html`, `public/css/styles.css`

**Changes**:
- Convert "Customize Your Trip" to `<details>` element
- Move "Upload Documents" section inside customize
- Keep all existing form fields (no removal)
- Add smooth expand/collapse animation

**HTML Structure**:
```html
<details id="customizeSection">
  <summary>=Ý Customize Your Trip</summary>
  <div class="customize-content">
    <!-- Theme-specific fields -->
    <div class="form-group">
      <label for="surnames">Family Surnames</label>
      <input type="text" id="surnames" />
    </div>

    <!-- Common fields -->
    <div class="form-group">
      <label for="duration">Duration (days)</label>
      <input type="number" id="duration" value="7" />
    </div>

    <!-- Upload Documents (moved here) -->
    <div class="upload-section">
      <h3>=Î Upload Documents</h3>
      <input type="file" id="fileInput" multiple />
      <div id="fileList"></div>
    </div>
  </div>
</details>
```

**Acceptance Criteria**:
- [ ] Section collapsed by default
- [ ] Clicking summary expands to show all fields
- [ ] Upload Documents appears inside (no separate section)
- [ ] Smooth animation (CSS transition)

### 1.4 Single Action Button
**Files**: `public/js/main.js`, `public/js/research.js`

**Changes**:
- Remove separate "quickStartBtn" handler
- Add single "Generate Trip Options" button at bottom
- Consolidate input gathering from both quick-search and detailed fields
- Call doResearchOnly() or POST /api/trips based on input

**JavaScript Logic**:
```javascript
// public/js/main.js
document.getElementById('generateBtn').addEventListener('click', () => {
  const quickSearch = document.getElementById('quickSearch').value.trim();
  const detailedInput = buildTextInput(); // from trips.js

  if (!quickSearch && !detailedInput) {
    showError('Please enter trip details');
    return;
  }

  // Combine inputs
  const combinedInput = quickSearch || detailedInput;

  // Show progress overlay
  showProgress(getSelectedTheme());

  // Call backend
  doResearchOnly();
});
```

**Acceptance Criteria**:
- [ ] Single button works for quick-search input
- [ ] Single button works for detailed customize input
- [ ] Validates that at least one input is provided
- [ ] Shows progress overlay immediately on click

## Phase 2: Progress Indicators (1 day)

### 2.1 Progress Overlay Component
**Files**: `public/index.html`, `public/js/progress.js`, `public/css/progress.css`

**Changes**:
- Add full-screen modal overlay with spinner
- Display theme-specific progress messages
- Animate progress bar based on estimated durations
- Auto-hide on completion or error

**HTML Structure**:
```html
<div id="progressOverlay" class="hidden">
  <div class="progress-modal">
    <div class="spinner"></div>
    <p id="progressMessage">Understanding your preferences...</p>
    <div class="progress-bar">
      <div class="progress-fill" id="progressFill" style="width: 0%"></div>
    </div>
  </div>
</div>
```

**JavaScript Logic**:
```javascript
// public/js/progress.js
const PROGRESS_STEPS = {
  heritage: [
    { percent: 10, message: 'Understanding your preferences...', duration: 2000 },
    { percent: 40, message: 'Researching Roberts family heritage sites...', duration: 8000 },
    { percent: 70, message: 'Creating trip options...', duration: 10000 },
    { percent: 95, message: 'Finalizing itinerary...', duration: 5000 }
  ],
  tvmovie: [
    { percent: 10, message: 'Understanding your preferences...', duration: 2000 },
    { percent: 40, message: 'Finding filming locations...', duration: 8000 },
    { percent: 70, message: 'Creating trip options...', duration: 10000 },
    { percent: 95, message: 'Finalizing itinerary...', duration: 5000 }
  ]
  // ... other themes
};

export function showProgress(theme) {
  const overlay = document.getElementById('progressOverlay');
  overlay.classList.remove('hidden');

  const steps = PROGRESS_STEPS[theme] || PROGRESS_STEPS.heritage;
  let currentStep = 0;

  function advance() {
    if (currentStep >= steps.length) return;

    const step = steps[currentStep];
    document.getElementById('progressMessage').textContent = step.message;
    document.getElementById('progressFill').style.width = step.percent + '%';

    currentStep++;
    if (currentStep < steps.length) {
      setTimeout(advance, step.duration);
    }
  }

  advance();
}

export function hideProgress() {
  document.getElementById('progressOverlay').classList.add('hidden');
}
```

**Acceptance Criteria**:
- [ ] Progress overlay displays immediately on button click
- [ ] Messages are theme-specific and relevant
- [ ] Progress bar animates smoothly (not jumpy)
- [ ] Overlay hides when API call completes (success or error)
- [ ] Spinner animation works on all browsers

## Phase 3: Traveler Intake Form (2 days)

### 3.1 Modal Form Component
**Files**: `public/index.html`, `public/js/traveler-intake.js`, `public/css/modal.css`

**Changes**:
- Add modal overlay with traveler intake form
- Show modal when "Get a free quote" button clicked
- Collect required fields (name, email) and optional fields
- Validate before submission

**HTML Structure**:
```html
<div id="travelerIntakeModal" class="modal hidden">
  <div class="modal-backdrop" onclick="closeTravelerIntake()"></div>
  <div class="modal-content">
    <button class="modal-close" onclick="closeTravelerIntake()">×</button>

    <h2>Complete Your Quote Request</h2>
    <p>Help us connect you with the perfect travel professional</p>

    <form id="travelerIntakeForm">
      <!-- Required fields -->
      <div class="form-group">
        <label>Primary Traveler Name <span class="required">*</span></label>
        <input type="text" name="primary_name" required />
      </div>

      <div class="form-group">
        <label>Email <span class="required">*</span></label>
        <input type="email" name="email" required />
      </div>

      <div class="form-group">
        <label>Phone Number</label>
        <input type="tel" name="phone" placeholder="(555) 123-4567" />
      </div>

      <!-- Optional fields (collapsible) -->
      <details>
        <summary>Additional Traveler Details (Optional)</summary>

        <div class="form-group">
          <label>All Travelers (names and ages)</label>
          <textarea name="travelers" rows="3" placeholder="e.g., John Smith (45), Jane Smith (42), Emily Smith (12)"></textarea>
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
          <textarea name="restrictions" rows="2" placeholder="e.g., vegetarian, gluten-free, wheelchair accessible"></textarea>
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

    <div id="submissionConfirmation" class="hidden">
      <h3> Quote Request Submitted!</h3>
      <p>A travel professional will contact you within 24 hours.</p>
      <button onclick="closeTravelerIntake()">Close</button>
    </div>
  </div>
</div>
```

**JavaScript Logic**:
```javascript
// public/js/traveler-intake.js
export function showTravelerIntake(tripId) {
  document.getElementById('travelerIntakeModal').classList.remove('hidden');

  const form = document.getElementById('travelerIntakeForm');
  form.onsubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Get agency_id from localStorage (white-label)
    const agencyId = localStorage.getItem('agency_id');
    if (agencyId) {
      data.agency_id = agencyId;
    }

    try {
      const response = await fetch(`/api/trips/${tripId}/request-quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to submit quote request');
      }

      // Show confirmation
      form.classList.add('hidden');
      document.getElementById('submissionConfirmation').classList.remove('hidden');

    } catch (error) {
      alert('Error: ' + error.message);
    }
  };
}

export function closeTravelerIntake() {
  document.getElementById('travelerIntakeModal').classList.add('hidden');
  document.getElementById('travelerIntakeForm').classList.remove('hidden');
  document.getElementById('submissionConfirmation').classList.add('hidden');
}
```

**Acceptance Criteria**:
- [ ] Modal opens when "Get a free quote" button clicked
- [ ] Required fields (name, email) are validated
- [ ] Optional fields collapsed by default
- [ ] Form submits to POST /api/trips/:id/request-quote
- [ ] Confirmation message displays after successful submission
- [ ] Modal closes via backdrop click or close button

### 3.2 Backend Endpoint: POST /api/trips/:id/request-quote
**Files**: `functions/api/trips/[id]/request-quote.ts`

**Implementation**:
```typescript
interface Env {
  DB: D1Database;
}

export async function onRequestPost(context: { request: Request; env: Env; params: { id: string } }) {
  const { request, env, params } = context;
  const tripId = params.id;

  try {
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
        intake: JSON.parse(trip.intake_json || '{}'),
        research: JSON.parse(trip.research_json || '{}'),
        selected_variant: trip.selected_variant,
        itinerary: JSON.parse(trip.variants_json || '{}')
      },
      requested_at: new Date().toISOString(),
      agency_id: formData.agency_id || null
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

  } catch (error: any) {
    console.error('[Request Quote] Error:', error);

    return new Response(JSON.stringify({
      error: 'Failed to submit quote request',
      details: error.message
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
```

**Acceptance Criteria**:
- [ ] Validates required fields (primary_name, email)
- [ ] Retrieves existing trip from database
- [ ] Builds complete handoff payload with traveler + trip details
- [ ] Stores payload in themed_trips.handoff_json
- [ ] Updates status to 'quote_requested'
- [ ] Returns success response

## Phase 4: White-Label Branding (2 days)

### 4.1 Database Migration
**Files**: `migrations/008_add_white_label.sql`

**SQL**:
```sql
-- Create agencies table
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

-- Add status column if not exists
ALTER TABLE themed_trips ADD COLUMN status TEXT DEFAULT 'draft';
```

**Acceptance Criteria**:
- [ ] Migration runs successfully on local D1
- [ ] Migration runs successfully on remote D1
- [ ] agencies table created with all fields
- [ ] themed_trips.agency_id column added
- [ ] No data loss in existing trips

### 4.2 Branding API Endpoint
**Files**: `functions/api/branding/index.ts`

**Implementation**:
```typescript
interface Env {
  DB: D1Database;
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;

  try {
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

  } catch (error: any) {
    console.error('[Branding] Error:', error);

    // Fail gracefully with default branding
    return new Response(JSON.stringify({
      name: 'Voygent',
      logo_url: '/logo.png',
      primary_color: '#667eea',
      accent_color: '#764ba2',
      agency_id: null
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
}
```

**Acceptance Criteria**:
- [ ] Returns agency branding if custom domain matches
- [ ] Returns default Voygent branding if no match
- [ ] Handles errors gracefully (falls back to default)
- [ ] Response includes all branding fields

### 4.3 Frontend Branding Integration
**Files**: `public/js/branding.js`, `public/js/main.js`

**Implementation**:
```javascript
// public/js/branding.js
export async function loadBranding() {
  try {
    const response = await fetch('/api/branding');
    const branding = await response.json();

    // Store agency_id for later use
    if (branding.agency_id) {
      localStorage.setItem('agency_id', branding.agency_id);
    }

    // Apply branding to UI
    applyBranding(branding);

    return branding;
  } catch (error) {
    console.error('[Branding] Failed to load:', error);
    // Use default branding
    return {
      name: 'Voygent',
      logo_url: '/logo.png',
      primary_color: '#667eea',
      accent_color: '#764ba2',
      agency_id: null
    };
  }
}

function applyBranding(branding) {
  // Update logo
  const logo = document.querySelector('header h1');
  if (branding.logo_url && branding.logo_url !== '/logo.png') {
    logo.innerHTML = `<img src="${branding.logo_url}" alt="${branding.name}" style="max-height: 40px;" />`;
  } else {
    logo.textContent = `< ${branding.name}`;
  }

  // Update CSS custom properties
  document.documentElement.style.setProperty('--primary-color', branding.primary_color);
  document.documentElement.style.setProperty('--accent-color', branding.accent_color);

  // Update "Get a free quote" button text
  const quoteButtons = document.querySelectorAll('.request-quote-btn');
  quoteButtons.forEach(btn => {
    if (branding.agency_id) {
      btn.textContent = `Get quote from ${branding.name}`;
    }
  });
}

// public/js/main.js
import { loadBranding } from './branding.js';

window.addEventListener('DOMContentLoaded', async () => {
  // Load branding first
  await loadBranding();

  // Then initialize rest of app
  initLocationDetection();
  initThemeSelector();
  // ...
});
```

**Acceptance Criteria**:
- [ ] Branding loads on page load
- [ ] Logo updates if custom logo provided
- [ ] Primary and accent colors applied via CSS variables
- [ ] "Get a free quote" button text includes agency name
- [ ] agency_id stored in localStorage for later use
- [ ] Fails gracefully if branding API unavailable

## Phase 5: Testing & Polish (1-2 days)

### 5.1 Manual Testing Checklist
- [ ] Theme selector works on desktop (1920px)
- [ ] Theme selector works on tablet (768px)
- [ ] Theme selector works on mobile (375px, 320px)
- [ ] Quick search input updates placeholder on theme change
- [ ] Generate button works with quick search only
- [ ] Generate button works with detailed customize only
- [ ] Generate button validates input (shows error if empty)
- [ ] Progress overlay shows and hides correctly
- [ ] Progress messages are theme-specific
- [ ] Traveler intake form opens and closes
- [ ] Traveler intake form validates required fields
- [ ] Traveler intake form submits successfully
- [ ] Confirmation message displays after submission
- [ ] White-label branding loads correctly
- [ ] Default branding works when no custom domain

### 5.2 Edge Cases
- [ ] Multiple rapid clicks on Generate button (debounce)
- [ ] Network error during API call (show error, hide progress)
- [ ] Invalid trip ID in request-quote endpoint (404 error)
- [ ] Missing database tables (graceful degradation)
- [ ] Browser without localStorage support (white-label still works)
- [ ] Very long traveler names (truncate or scroll)
- [ ] Special characters in form inputs (sanitize)

### 5.3 Browser Compatibility
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS 14+)
- [ ] Chrome Mobile (Android)

### 5.4 Performance
- [ ] Page load time < 2 seconds
- [ ] First contentful paint < 1 second
- [ ] Branding API response < 500ms
- [ ] Request-quote API response < 1 second
- [ ] No layout shift during theme selection

## Rollout Plan

### Phase 0: Database Migration (Day 1)
1. Create migration file `migrations/008_add_white_label.sql`
2. Test on local D1: `npx wrangler d1 execute voygent-themed --local --file=migrations/008_add_white_label.sql`
3. Apply to remote D1: `npx wrangler d1 execute voygent-themed --remote --file=migrations/008_add_white_label.sql`
4. Verify schema: `npx wrangler d1 execute voygent-themed --remote --command="SELECT sql FROM sqlite_master WHERE type='table'"`

### Phase 1: Frontend Interface (Days 2-4)
1. Create new branch: `002-new-voygent-app`
2. Implement theme selector refactor
3. Implement unified quick search
4. Implement collapsible customize section
5. Implement single action button
6. Test locally: `npx wrangler pages dev public`
7. Deploy to preview: `npx wrangler pages deploy public --project-name voygent-themed`

### Phase 2: Progress Indicators (Day 5)
1. Create progress.js module
2. Add progress overlay HTML/CSS
3. Wire up to Generate button
4. Test with real API calls
5. Deploy to preview

### Phase 3: Traveler Intake (Days 6-7)
1. Create traveler-intake.js module
2. Add modal HTML/CSS
3. Create backend endpoint: `functions/api/trips/[id]/request-quote.ts`
4. Wire up "Get a free quote" button
5. Test form submission end-to-end
6. Deploy to preview

### Phase 4: White-Label Branding (Days 8-9)
1. Run database migration
2. Create branding.js module
3. Create backend endpoint: `functions/api/branding/index.ts`
4. Test with localhost domain (default branding)
5. Insert test agency: `INSERT INTO agencies (id, name, custom_domain, logo_url, primary_color) VALUES ('test-agency', 'Heritage Travel Experts', 'localhost:8788', '/test-logo.png', '#c41e3a')`
6. Test with custom domain (agency branding)
7. Deploy to production

### Phase 5: Production Deployment (Day 10)
1. Merge branch to main
2. Deploy to production: `npx wrangler pages deploy public --project-name voygent-themed`
3. Verify deployment at voygent.app
4. Monitor for errors in Cloudflare dashboard
5. Create agency admin documentation

## Success Metrics

### Quantitative
- [ ] Homepage bounce rate reduced by 50% (baseline: current rate)
- [ ] "Generate Trip Options" click-through rate > 60% (visitors who click after landing)
- [ ] Quote request submissions increased by 30% (baseline: current rate)
- [ ] Mobile traffic maintained or increased (no regression)
- [ ] Page load time < 2 seconds on 3G connection

### Qualitative
- [ ] User feedback: "Interface is clearer and easier to use"
- [ ] Agent feedback: "Handoff data is complete and helpful"
- [ ] Agency feedback: "White-label branding looks professional"

## Open Questions & Decisions

### Question 1: Auto-scroll carousel vs. manual?
**Decision**: Manual scroll (user-initiated). Auto-scroll is distracting and may cause motion sickness.

### Question 2: Minimum white-label config?
**Decision**: Logo + colors only for MVP. Additional fields (contact info, terms URL) can be added later.

### Question 3: Multiple contact persons in intake form?
**Decision**: Single primary contact for MVP. Can add "Additional contact" field later if needed.

### Question 4: Form validation error display?
**Decision**: Inline errors (red border + message below field). More intuitive than modal alerts.

## Dependencies

### Upstream (Blocking This Work)
- None (all backend endpoints already exist except new ones we're creating)

### Downstream (Blocked By This Work)
- **002-trip-handover**: Needs updated handoff_json schema with traveler fields
- **Agent Dashboard**: Will consume handoff records created by this work
- **Agency Admin Panel**: Will manage agencies table created by this work

## Risk Mitigation

### Risk 1: Mobile Layout Issues
**Mitigation**: Mobile-first CSS, test on real devices early, use flexbox/grid for responsive layouts

### Risk 2: Progress Indicator Inaccuracy
**Mitigation**: Use conservative estimates (over-estimate duration), add disclaimer "Estimated time remaining"

### Risk 3: Form Abandonment
**Mitigation**: Most fields optional, save partial progress, show "3 of 9 fields completed" indicator

### Risk 4: White-Label Complexity
**Mitigation**: Start with simple config (logo + colors), defer advanced customization to Phase 2

### Risk 5: Browser Compatibility
**Mitigation**: Use standard HTML/CSS/JS (no experimental features), test on all major browsers, provide fallbacks

## Constitutional Alignment

 **Critical path preserved**: Interface changes don't break "Intake ’ Options ’ Select ’ A/B ’ Save Trip ID" flow

 **Cheap-first policy**: New endpoints use cheap reads/writes, no LLM calls added

 **No inventory claims**: Handoff form clearly states "A travel professional will contact you" (no booking promises)

 **Reproducibility**: All changes work locally with wrangler pages dev, same behavior in production

## Conclusion

This implementation plan delivers a cleaner, more intuitive voygent.app interface while adding critical agent handoff capabilities and white-label support. The phased approach allows for incremental testing and deployment, minimizing risk. All changes are backwards-compatible with existing functionality.

**Total Timeline**: 7-10 days
**Files Changed**: ~15
**Lines of Code**: ~1,500 (mostly frontend)
**Database Migrations**: 1 (additive only)

Ready to proceed with implementation via `/implement` command.
