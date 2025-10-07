# Tasks: Interface Redesign & Agent Handoff Enhancement

## Overview
This document breaks down the implementation plan into executable tasks. Tasks marked **[P]** can be executed in parallel. Tasks are ordered by dependencies.

## Phase 0: Database Migration

### T001: [X] Create White-Label Database Migration [P]
**File**: `migrations/008_add_white_label.sql`

**Description**: Create SQL migration to add agencies table and extend themed_trips table for white-label support.

**Requirements**:
- Create `agencies` table with columns: id, name, custom_domain, logo_url, primary_color, accent_color, contact_email, contact_phone, created_at, updated_at
- Add `agency_id` column to `themed_trips` table
- Add `status` column to `themed_trips` table if not exists
- Ensure all changes are additive (no data loss)

**Acceptance**:
- Migration file created with valid SQL
- No DROP or DELETE statements (additive only)
- All tables/columns properly typed

**Dependencies**: None

---

### T002: [X] Test Migration Locally
**Command**: `npx wrangler d1 execute voygent-themed --local --file=migrations/008_add_white_label.sql`

**Description**: Run migration on local D1 database and verify schema changes.

**Requirements**:
- Migration runs without errors
- Verify agencies table created: `SELECT sql FROM sqlite_master WHERE type='table' AND name='agencies'`
- Verify themed_trips columns added: `PRAGMA table_info(themed_trips)`

**Acceptance**:
- No SQL errors
- All new tables/columns exist
- Existing data intact

**Dependencies**: T001

---

### T003: [X] Apply Migration to Production
**Command**: `npx wrangler d1 execute voygent-themed --remote --file=migrations/008_add_white_label.sql`

**Description**: Apply migration to production D1 database after local testing successful.

**Requirements**:
- Backup verification (D1 handles this automatically)
- Run migration on remote database
- Verify schema changes in production

**Acceptance**:
- Migration completes successfully
- Production database schema updated
- No downtime or errors

**Dependencies**: T002

---

## Phase 1: Frontend Interface Redesign

### T004: Create Compact Theme Selector Component [P]
**Files**:
- `public/index.html` (update theme selector section)
- `public/css/theme-selector.css` (new file)

**Description**: Replace large theme cards with compact button row showing 5 featured themes.

**Requirements**:
- Create compact button layout (flex row, max height 120px)
- Each button shows icon + name
- Active button has visual highlight (border or background)
- Responsive: stack vertically on mobile (<600px)
- Update existing theme-card styles to compact-theme-btn

**HTML Structure**:
```html
<div class="theme-selector-compact">
  <button class="theme-btn active" data-theme="heritage">
    <span class="icon">🌳</span>
    <span class="label">Heritage</span>
  </button>
  <!-- ... 4 more featured themes -->
</div>
```

**Acceptance**:
- 5 buttons display in single row on desktop
- Clicking button highlights it and triggers theme change
- Mobile view stacks buttons or horizontal scrolls
- Existing theme.js module still works

**Dependencies**: None

---

### T005: Create Theme Carousel for Additional Themes [P]
**Files**:
- `public/index.html` (add carousel section)
- `public/css/carousel.css` (new file)
- `public/js/theme-carousel.js` (new file)

**Description**: Add horizontal scrollable carousel below featured themes to display 6+ themes.

**Requirements**:
- Load themes from `/api/templates` endpoint
- Filter out 5 featured themes (already shown above)
- Render remaining themes in horizontal scroll container
- Smooth scroll behavior with CSS
- Optional: Add left/right arrow navigation

**HTML Structure**:
```html
<div class="theme-carousel">
  <button class="scroll-btn left" aria-label="Scroll left">←</button>
  <div class="carousel-track">
    <!-- Theme buttons dynamically inserted -->
  </div>
  <button class="scroll-btn right" aria-label="Scroll right">→</button>
</div>
```

**Acceptance**:
- Carousel displays themes not in featured list
- Horizontal scroll works on touch and mouse
- Clicking theme updates selection
- Empty carousel hidden if all themes are featured

**Dependencies**: T004 (shares theme selection logic)

---

### T006: Create Unified Quick Search Component [P]
**Files**:
- `public/index.html` (replace "Follow Your Family Roots" section)
- `public/js/quick-search.js` (new file)

**Description**: Create single quick-search input field with dynamic placeholder based on selected theme.

**Requirements**:
- Input field with data attributes for each theme's placeholder
- Update placeholder and title when theme changes
- Listen to 'themeChanged' event from theme-selector.js
- Store input value in shared state

**HTML Structure**:
```html
<div class="quick-search-section">
  <h2 id="themeTitle">Heritage & Ancestry Trip</h2>
  <input
    type="text"
    id="quickSearch"
    class="quick-search-input"
    placeholder="Enter family surname (e.g., McLeod)"
  />
</div>
```

**Placeholders**:
- heritage: "Enter family surname (e.g., McLeod)"
- tvmovie: "Enter show/movie name (e.g., Game of Thrones)"
- historical: "Enter historical event (e.g., D-Day Normandy)"
- culinary: "Enter cuisine or region (e.g., Tuscany pasta)"
- adventure: "Enter activity (e.g., Patagonia hiking)"

**Acceptance**:
- Placeholder updates when theme changes
- Title updates to match theme name
- Input value accessible from other modules

**Dependencies**: T004 (needs theme change events)

---

### T007: Create OR Divider Component [P]
**Files**:
- `public/index.html` (add divider between quick search and customize)
- `public/css/divider.css` (new file)

**Description**: Add visual "OR" divider to separate quick search from detailed customization.

**Requirements**:
- Horizontal line with "OR" text in center
- Subtle styling (light gray, small text)
- Responsive (maintains layout on mobile)

**HTML Structure**:
```html
<div class="or-divider">
  <span>OR</span>
</div>
```

**CSS**:
- Line: border-top with ::before and ::after pseudo-elements
- Text: background color matches page background

**Acceptance**:
- Divider visually separates sections
- Text readable and centered
- Works on all screen sizes

**Dependencies**: None

---

### T008: Convert Customize Section to Collapsible Details [P]
**Files**:
- `public/index.html` (update customize section)
- `public/css/details.css` (new file)

**Description**: Convert "Customize Your Trip" section from always-visible to collapsible `<details>` element.

**Requirements**:
- Use native HTML5 `<details>` and `<summary>` elements
- Move all existing form fields inside details
- Collapsed by default
- Smooth expand/collapse animation (CSS transition)
- Preserve all existing form fields (no removal)

**HTML Structure**:
```html
<details id="customizeSection">
  <summary class="customize-summary">
    <span class="icon">📝</span>
    <span class="text">Customize Your Trip</span>
    <span class="toggle-icon">▼</span>
  </summary>
  <div class="customize-content">
    <!-- All existing form fields -->
  </div>
</details>
```

**CSS Animation**:
- Transition on max-height (0 to 1000px)
- Opacity fade-in/out
- Transform rotate toggle icon

**Acceptance**:
- Section collapsed by default
- Clicking summary expands section smoothly
- All form fields visible when expanded
- Toggle icon rotates (▼ to ▲)

**Dependencies**: None

---

### T009: Move Upload Documents into Customize Section
**Files**:
- `public/index.html` (move upload section)

**Description**: Relocate "Upload Documents" section from separate container into "Customize Your Trip" details element.

**Requirements**:
- Cut upload section HTML from current location
- Paste inside `<div class="customize-content">` (bottom of form)
- Maintain all existing upload functionality
- Update CSS selectors if needed

**Acceptance**:
- Upload section only visible when customize is expanded
- File upload still works correctly
- File list displays properly
- No orphaned CSS or broken references

**Dependencies**: T008 (needs collapsible section)

---

### T010: Create Single Generate Button Component
**Files**:
- `public/index.html` (add single button at bottom)
- `public/js/generate-button.js` (new file)

**Description**: Add single "Generate Trip Options" button that works for both quick search and detailed inputs.

**Requirements**:
- Button positioned below customize section
- Gathers input from both quick-search and detailed fields
- Validates at least one input provided (show error if empty)
- Triggers trip generation API call
- Shows progress overlay on click

**HTML Structure**:
```html
<button id="generateBtn" class="primary-action generate-btn">
  ✨ Generate Trip Options
</button>
```

**JavaScript Logic**:
```javascript
document.getElementById('generateBtn').addEventListener('click', () => {
  const quickSearch = document.getElementById('quickSearch').value.trim();
  const detailedInput = buildTextInput(); // from trips.js

  if (!quickSearch && !detailedInput) {
    showError('Please enter trip details');
    return;
  }

  showProgress(getSelectedTheme());
  doResearchOnly(); // existing function
});
```

**Acceptance**:
- Button works with quick search only
- Button works with detailed customize only
- Button works with both inputs (merged)
- Shows validation error if no input
- Progress overlay appears immediately

**Dependencies**: T006 (quick search), T008 (customize section)

---

### T011: Remove Old Quick Start Button
**Files**:
- `public/index.html` (remove old button)
- `public/js/main.js` (remove button event listener)

**Description**: Clean up old "Create My Trip" button from quick start section (now replaced by single generate button).

**Requirements**:
- Remove `<button id="quickStartBtn">` from HTML
- Remove event listener for quickStartBtn from main.js
- Verify no broken references

**Acceptance**:
- Old button no longer visible
- No console errors about missing element
- New generate button is sole action button

**Dependencies**: T010 (new button must work first)

---

## Phase 2: Progress Indicators

### T012: Create Progress Overlay Component [P]
**Files**:
- `public/index.html` (add progress overlay)
- `public/css/progress.css` (new file)
- `public/js/progress.js` (new file)

**Description**: Create full-screen progress overlay with spinner, message, and progress bar.

**Requirements**:
- Modal overlay covering entire page
- Spinner animation (CSS or inline SVG)
- Progress message text (dynamic)
- Progress bar with animated fill
- Hidden by default (class: hidden)

**HTML Structure**:
```html
<div id="progressOverlay" class="progress-overlay hidden">
  <div class="progress-modal">
    <div class="spinner"></div>
    <p id="progressMessage" class="progress-message">Understanding your preferences...</p>
    <div class="progress-bar">
      <div class="progress-fill" id="progressFill" style="width: 0%"></div>
    </div>
  </div>
</div>
```

**CSS**:
- Overlay: position fixed, z-index 9999, background rgba(0,0,0,0.7)
- Modal: centered, white background, padding, border-radius
- Spinner: CSS animation rotate or keyframes
- Progress bar: gray background, colored fill with transition

**Acceptance**:
- Overlay hidden by default
- Overlay covers entire page when visible
- Spinner animates smoothly
- Progress bar can be updated via JS

**Dependencies**: None

---

### T013: Create Progress Step Definitions [P]
**Files**:
- `public/js/progress-steps.js` (new file)

**Description**: Define progress step sequences for each theme with messages and durations.

**Requirements**:
- Export PROGRESS_STEPS object keyed by theme
- Each theme has array of steps with: percent, message, duration
- Messages are theme-specific and relevant
- Total duration estimates ~25-30 seconds (typical API call time)

**Data Structure**:
```javascript
export const PROGRESS_STEPS = {
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
  ],
  // ... other themes
};
```

**Acceptance**:
- All 5 themes have progress steps defined
- Messages are theme-specific
- Duration totals roughly match API call times
- Percentages add up to ~95% (leave room for completion)

**Dependencies**: None

---

### T014: Implement Progress Controller Functions
**Files**:
- `public/js/progress.js` (extend existing file)

**Description**: Implement showProgress() and hideProgress() functions to control overlay.

**Requirements**:
- showProgress(theme): Shows overlay and animates progress
- hideProgress(): Hides overlay and resets progress
- Loads steps from progress-steps.js
- Advances through steps with setTimeout
- Updates message and progress bar on each step

**JavaScript Implementation**:
```javascript
import { PROGRESS_STEPS } from './progress-steps.js';

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
  const overlay = document.getElementById('progressOverlay');
  overlay.classList.add('hidden');

  // Reset for next use
  document.getElementById('progressFill').style.width = '0%';
  document.getElementById('progressMessage').textContent = '';
}
```

**Acceptance**:
- Progress overlay shows when called
- Messages update according to theme
- Progress bar animates smoothly
- Overlay hides when called
- No memory leaks (clears timeouts)

**Dependencies**: T012 (overlay HTML), T013 (step definitions)

---

### T015: Wire Progress to Generate Button
**Files**:
- `public/js/generate-button.js` (update existing)
- `public/js/research.js` (update existing)

**Description**: Connect progress overlay to generate button click and API call completion.

**Requirements**:
- Call showProgress(theme) when generate button clicked
- Pass current theme to progress controller
- Call hideProgress() when API call completes (success or error)
- Ensure progress shown before API call starts

**Code Changes**:
```javascript
// In generate-button.js
document.getElementById('generateBtn').addEventListener('click', () => {
  const theme = getSelectedTheme();
  showProgress(theme); // Show immediately

  doResearchOnly(); // Existing function
});

// In research.js (at end of doResearchOnly)
try {
  const response = await fetch('/api/research', { ... });
  // ... process response ...
  hideProgress();
} catch (error) {
  hideProgress();
  showError(error.message);
}
```

**Acceptance**:
- Progress shows immediately on button click
- Progress hides when API call completes
- Progress hides on error (doesn't get stuck)
- User can see progress during long API calls

**Dependencies**: T010 (generate button), T014 (progress functions)

---

## Phase 3: Traveler Intake Form

### T016: Create Traveler Intake Modal HTML [P]
**Files**:
- `public/index.html` (add modal at bottom)
- `public/css/traveler-intake.css` (new file)

**Description**: Create modal dialog for traveler intake form with required and optional fields.

**Requirements**:
- Modal overlay with backdrop (click to close)
- Form with required fields: primary_name, email
- Form with optional fields: phone, travelers, passport_status, restrictions, airline_loyalty, hotel_loyalty, contact_method
- Optional fields in collapsible details element
- Close button (X) in top-right corner
- Submit button at bottom

**HTML Structure**: (See plan.md Phase 3.1 for full HTML)

**CSS**:
- Modal: position fixed, z-index 10000 (above progress)
- Backdrop: rgba(0,0,0,0.5), blur effect optional
- Content: centered, white background, max-width 600px, padding 30px
- Form: standard form styling, labels above inputs
- Responsive: full-screen on mobile

**Acceptance**:
- Modal hidden by default (class: hidden)
- Required fields have asterisk (*)
- Optional fields collapsed by default
- Form looks professional and clean
- Works on mobile (320px+ width)

**Dependencies**: None

---

### T017: Create Traveler Intake Controller [P]
**Files**:
- `public/js/traveler-intake.js` (new file)

**Description**: Implement JavaScript functions to show/hide modal and handle form submission.

**Requirements**:
- showTravelerIntake(tripId): Shows modal and sets up form handler
- closeTravelerIntake(): Hides modal and resets form
- validateForm(): Checks required fields before submission
- submitForm(): POSTs to /api/trips/:id/request-quote
- showConfirmation(): Displays success message after submission

**JavaScript Implementation**:
```javascript
export function showTravelerIntake(tripId) {
  const modal = document.getElementById('travelerIntakeModal');
  modal.classList.remove('hidden');

  const form = document.getElementById('travelerIntakeForm');
  form.onsubmit = async (e) => {
    e.preventDefault();

    if (!validateForm(form)) {
      return;
    }

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Add agency_id if white-label
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
        throw new Error(error.details || 'Failed to submit');
      }

      showConfirmation();
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

function validateForm(form) {
  const name = form.elements.primary_name.value.trim();
  const email = form.elements.email.value.trim();

  if (!name || !email) {
    alert('Please fill in all required fields');
    return false;
  }

  // Basic email validation
  if (!email.includes('@')) {
    alert('Please enter a valid email address');
    return false;
  }

  return true;
}

function showConfirmation() {
  document.getElementById('travelerIntakeForm').classList.add('hidden');
  document.getElementById('submissionConfirmation').classList.remove('hidden');
}
```

**Acceptance**:
- Modal shows when function called
- Form validates required fields
- Form submits to backend API
- Success message displays after submission
- Modal can be closed via backdrop or button

**Dependencies**: T016 (modal HTML)

---

### T018: Wire Intake Form to "Get Free Quote" Button
**Files**:
- `public/index.html` (ensure button exists)
- `public/js/main.js` or relevant module

**Description**: Connect "Get a free quote" button to traveler intake modal.

**Requirements**:
- Find all elements with class "request-quote-btn"
- Add click event listener
- Extract tripId from button data attribute
- Call showTravelerIntake(tripId)

**Code Changes**:
```javascript
import { showTravelerIntake } from './traveler-intake.js';

// After itinerary displayed
document.querySelectorAll('.request-quote-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tripId = btn.dataset.tripId;
    showTravelerIntake(tripId);
  });
});
```

**Acceptance**:
- Clicking "Get free quote" opens traveler intake modal
- Modal has correct tripId for submission
- Works for all quote buttons on page

**Dependencies**: T017 (intake controller)

---

### T019: [X] Create Backend Endpoint: POST /api/trips/:id/request-quote [P]
**Files**:
- `functions/api/trips/[id]/request-quote.ts` (new file)

**Description**: Create backend endpoint to handle traveler intake form submission and create handoff record.

**Requirements**:
- Accept POST request with traveler data
- Validate required fields (primary_name, email)
- Load existing trip from database
- Build handoff payload with traveler + trip data
- Store payload in themed_trips.handoff_json
- Update status to 'quote_requested'
- Return success response

**TypeScript Implementation**: (See plan.md Phase 3.2 for full code)

**Acceptance**:
- Endpoint responds to POST /api/trips/:id/request-quote
- Validates required fields (400 if missing)
- Returns 404 if trip not found
- Stores complete handoff payload in database
- Returns 200 with success message

**Dependencies**: T003 (database migration with handoff_json column)

---

### T020: Test Traveler Intake End-to-End
**Test Scenario**:
1. Generate trip options
2. Select option and view itinerary
3. Click "Get a free quote"
4. Fill in required fields (name, email)
5. Submit form
6. Verify confirmation message
7. Check database for handoff_json record

**Acceptance**:
- Form displays correctly
- Validation works (shows errors for missing fields)
- Submission succeeds with valid data
- Confirmation message displays
- Database record created with correct handoff payload
- Trip status updated to 'quote_requested'

**Dependencies**: T016, T017, T018, T019

---

## Phase 4: White-Label Branding

### T021: [X] Create Branding API Endpoint [P]
**Files**:
- `functions/api/branding/index.ts` (new file)

**Description**: Create GET endpoint to return branding configuration based on request domain.

**Requirements**:
- Extract hostname from request URL
- Query agencies table for custom_domain match
- Return agency branding if match found
- Return default Voygent branding if no match
- Handle errors gracefully (always return valid branding)

**TypeScript Implementation**: (See plan.md Phase 4.2 for full code)

**Acceptance**:
- GET /api/branding returns JSON with branding config
- Returns agency branding for matching custom domain
- Returns default branding for voygent.app domain
- Returns default branding on database error
- Response includes: name, logo_url, primary_color, accent_color, agency_id

**Dependencies**: T003 (database migration with agencies table)

---

### T022: Create Branding Loader Module [P]
**Files**:
- `public/js/branding.js` (new file)

**Description**: Create JavaScript module to load and apply branding configuration from API.

**Requirements**:
- loadBranding(): Fetches branding from /api/branding
- applyBranding(branding): Updates UI with agency branding
- Stores agency_id in localStorage for later use
- Updates logo, colors, button text

**JavaScript Implementation**: (See plan.md Phase 4.3 for full code)

**Functions**:
- `loadBranding()`: Fetch API, store agency_id, apply branding
- `applyBranding(branding)`: Update logo, CSS variables, button text

**Acceptance**:
- Branding loads on page load
- Logo updates if custom logo provided
- Colors applied via CSS custom properties (--primary-color, --accent-color)
- "Get a free quote" button text includes agency name
- agency_id stored in localStorage
- Falls back gracefully on errors

**Dependencies**: T021 (branding API)

---

### T023: Integrate Branding into Main App
**Files**:
- `public/js/main.js` (update)
- `public/css/styles.css` (add CSS variables)

**Description**: Wire branding loader into main app initialization and update CSS to use variables.

**Requirements**:
- Call loadBranding() on DOMContentLoaded (before other init)
- Update CSS to use CSS custom properties for colors
- Ensure branding loads before theme selector renders

**Code Changes**:
```javascript
// In main.js
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

**CSS Variables**:
```css
:root {
  --primary-color: #667eea;
  --accent-color: #764ba2;
}

/* Use throughout styles */
.theme-btn.active {
  border-color: var(--primary-color);
}

button.primary-action {
  background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
}
```

**Acceptance**:
- Branding loads before UI renders
- Colors update correctly with agency branding
- Default colors work if no agency branding
- No flash of unstyled content (FOUC)

**Dependencies**: T022 (branding loader)

---

### T024: Test White-Label Branding
**Test Scenario**:

**Test 1: Default Branding**
1. Visit localhost:8788 (or voygent.app)
2. Verify logo shows "🌍 Voygent"
3. Verify colors are default purple/blue
4. Verify "Get a free quote" button text is generic

**Test 2: Agency Branding**
1. Insert test agency: `INSERT INTO agencies (id, name, custom_domain, logo_url, primary_color, accent_color) VALUES ('test', 'Heritage Travel', 'localhost:8788', '/test-logo.png', '#c41e3a', '#8b0000')`
2. Visit localhost:8788
3. Verify logo shows agency logo (or name if image not found)
4. Verify colors changed to red theme
5. Verify "Get a free quote" button says "Get quote from Heritage Travel"
6. Fill intake form and verify agency_id='test' included in submission

**Acceptance**:
- Default branding works correctly
- Agency branding loads and applies correctly
- agency_id passed in form submissions
- No console errors

**Dependencies**: T021, T022, T023

---

## Phase 5: Testing & Polish

### T025: Responsive Design Testing
**Test Devices**:
- Desktop: 1920x1080, 1366x768
- Tablet: 768x1024 (iPad), 1024x768 (iPad landscape)
- Mobile: 375x667 (iPhone), 320x568 (iPhone SE)

**Test Scenarios**:
1. Theme selector layout
2. Quick search input sizing
3. Customize section expansion
4. Generate button positioning
5. Progress overlay display
6. Traveler intake modal sizing
7. Theme carousel scrolling

**Acceptance**:
- All components visible and usable on all screen sizes
- No horizontal scroll (except intentional carousel)
- Text readable without zooming
- Buttons large enough for touch (44px min)
- Forms usable on mobile keyboards

**Dependencies**: All frontend tasks (T004-T018)

---

### T026: Cross-Browser Compatibility Testing
**Browsers**:
- Chrome 120+ (Windows, Mac, Android)
- Firefox 120+ (Windows, Mac)
- Safari 17+ (Mac, iOS)
- Edge 120+ (Windows)

**Features to Test**:
- CSS Grid/Flexbox layouts
- HTML5 details element
- CSS custom properties
- Fetch API
- ES6 modules
- localStorage

**Acceptance**:
- All features work in all browsers
- No console errors
- Visual consistency (within reason)
- Polyfills added if needed for older browsers

**Dependencies**: All frontend tasks

---

### T027: Accessibility (A11y) Testing
**WCAG 2.1 AA Requirements**:
- Color contrast ratios (4.5:1 for text)
- Keyboard navigation (all interactive elements)
- Screen reader compatibility (ARIA labels)
- Focus indicators visible
- Form labels associated with inputs

**Testing**:
- Run Lighthouse accessibility audit
- Test with keyboard only (no mouse)
- Test with screen reader (NVDA or VoiceOver)
- Check color contrast in all themes/brands

**Fixes**:
- Add aria-labels to icon buttons
- Ensure proper heading hierarchy (h1 → h2 → h3)
- Add skip-to-content link
- Ensure focus trap in modals
- Add loading/busy states for screen readers

**Acceptance**:
- Lighthouse accessibility score > 90
- All interactive elements keyboard accessible
- Screen reader announces all important content
- No WCAG AA violations

**Dependencies**: All frontend tasks

---

### T028: Performance Optimization
**Metrics to Measure**:
- First Contentful Paint (FCP) < 1.5s
- Largest Contentful Paint (LCP) < 2.5s
- Time to Interactive (TTI) < 3.5s
- Total Blocking Time (TBT) < 300ms
- Cumulative Layout Shift (CLS) < 0.1

**Optimizations**:
- Minify CSS and JS (optional for Pages)
- Lazy load non-critical images
- Defer non-critical JavaScript
- Optimize images (compress, proper formats)
- Minimize third-party scripts

**Testing**:
- Run Lighthouse performance audit
- Test on slow 3G connection
- Test with CPU throttling (4x slowdown)

**Acceptance**:
- Lighthouse performance score > 85
- Page loads quickly on slow connections
- No janky animations or scrolling
- Forms respond immediately to input

**Dependencies**: All frontend tasks

---

### T029: Error Handling & Edge Cases
**Edge Cases to Test**:
1. Empty form submission (validation)
2. Network error during API call
3. API timeout (>30 seconds)
4. Invalid trip ID in URL
5. Missing database tables (migration not run)
6. Duplicate form submission (double click)
7. Browser without localStorage
8. Very long text inputs (overflow)
9. Special characters in inputs (SQL injection attempt)
10. Large file uploads

**Required Fixes**:
- Add debounce to generate button (prevent double-click)
- Show error messages for network failures
- Add timeout to API calls (show error after 30s)
- Validate and sanitize all inputs
- Handle localStorage errors gracefully
- Add loading states during API calls
- Limit file upload sizes

**Acceptance**:
- All edge cases handled gracefully
- User sees helpful error messages
- No uncaught exceptions in console
- No data loss on errors

**Dependencies**: All tasks

---

### T030: Documentation & Comments
**Files to Document**:
- `README.md`: Update with new features
- `specs/002-new-voygent-app/CHANGELOG.md`: Create changelog
- Code comments: Add JSDoc to public functions

**Documentation Requirements**:
- Feature description
- Setup instructions (migrations)
- White-label setup guide
- API endpoint documentation
- Known issues and limitations

**Code Comments**:
- JSDoc for all exported functions
- Inline comments for complex logic
- TODO comments for future improvements

**Acceptance**:
- README updated with new features
- Changelog documents all changes
- Code has helpful comments
- Documentation is accurate and up-to-date

**Dependencies**: All tasks

---

## Parallel Execution Examples

### Parallel Batch 1: Database & Frontend Setup (Day 1)
Can run in parallel:
```bash
# Terminal 1: Database migration
Task: T001, T002, T003

# Terminal 2: Theme selector
Task: T004, T005

# Terminal 3: Quick search
Task: T006, T007
```

### Parallel Batch 2: Core UI Components (Day 2)
Can run in parallel:
```bash
# Terminal 1: Customize section
Task: T008, T009

# Terminal 2: Progress overlay
Task: T012, T013

# Terminal 3: Traveler intake UI
Task: T016
```

### Parallel Batch 3: Backend Endpoints (Day 3)
Can run in parallel:
```bash
# Terminal 1: Request quote endpoint
Task: T019

# Terminal 2: Branding endpoint
Task: T021

# Terminal 3: Branding loader
Task: T022
```

### Sequential Batch: Integration (Days 4-5)
Must run sequentially (shared files):
```bash
Task: T010 (generate button)
Task: T011 (remove old button)
Task: T014 (progress controller)
Task: T015 (wire progress)
Task: T017 (intake controller)
Task: T018 (wire intake)
Task: T023 (branding integration)
```

### Parallel Batch 4: Testing (Days 6-7)
Can run in parallel:
```bash
# Terminal 1: Responsive testing
Task: T025

# Terminal 2: Browser testing
Task: T026

# Terminal 3: Accessibility
Task: T027

# Terminal 4: Performance
Task: T028
```

## Task Summary

**Total Tasks**: 30
**Parallel Tasks**: 15 (50%)
**Sequential Tasks**: 15 (50%)
**Estimated Time**: 7-10 days
**Files Changed**: ~25
**Lines of Code**: ~2,000

## Dependencies Graph

```
Phase 0: Database
T001 → T002 → T003

Phase 1: Frontend
T004 ─┬─→ T005
      └─→ T006 → T010 → T011
T007 ────────────┘
T008 → T009

Phase 2: Progress
T012 ─┬─→ T014 → T015
T013 ─┘

Phase 3: Intake
T016 → T017 → T018
       T019 → T020

Phase 4: Branding
T021 → T022 → T023 → T024

Phase 5: Testing
T025, T026, T027, T028, T029 → T030
```

## Constitutional Compliance

✅ **Critical path preserved**: No changes to core trip generation flow

✅ **Cheap-first policy**: New endpoints are simple CRUD, no LLM calls

✅ **No inventory claims**: Intake form includes disclaimer text

✅ **Reproducibility**: All changes work in both local and production

## Next Steps

After completing tasks:
1. Run full regression test suite
2. Deploy to preview environment
3. User acceptance testing (UAT)
4. Merge to main branch
5. Deploy to production
6. Monitor for errors in Cloudflare dashboard
7. Gather user feedback
8. Iterate on improvements
