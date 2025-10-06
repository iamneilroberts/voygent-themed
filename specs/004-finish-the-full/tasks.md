# Implementation Tasks: Complete Full Trip Planning Flow

**Feature**: 004-finish-the-full
**Branch**: `004-finish-the-full`
**Specification**: [spec.md](./spec.md)
**Implementation Plan**: [plan.md](./plan.md)

## Overview

This document contains all implementation tasks for completing the trip planning user flow. Tasks are ordered by dependency and marked with `[P]` when they can be executed in parallel with other tasks.

**Estimated Total Time**: 4-6 hours

---

## Task Dependencies

```
Setup (T001)
  ↓
API Verification (T002)
  ↓
Display Function Core (T003) → [P] CSS Styling (T008, T009)
  ↓
Trip Options Rendering (T004)
  ↓
Option Selection Handler (T005)
  ↓
Itinerary Display (T006)
  ↓
Cost Breakdown (T007)
  ↓
Integration (T010, T011, T012)
  ↓
Error Handling (T013, T014)
  ↓
Testing (T015)
```

---

## Setup Tasks

### T001: Verify Development Environment
**Priority**: Critical
**Estimated Time**: 10 minutes
**Parallel**: No

**Description**: Ensure local development server is running and all recent changes are compiled.

**Files**: None (environment check)

**Steps**:
1. Verify server is running: `wrangler pages dev --local --port 8788 public`
2. Check for compilation errors in console
3. Verify database migrations applied: `npx wrangler d1 list`
4. Test that research phase works (baseline check)
5. Open browser to `http://localhost:8788` and verify page loads

**Acceptance Criteria**:
- [x] Server running without errors
- [x] Can complete research phase
- [x] No console errors on page load
- [x] Database accessible

---

## Backend Verification Tasks

### T002: Verify API Response Format
**Priority**: Critical
**Estimated Time**: 20 minutes
**Parallel**: No
**Dependencies**: T001

**Description**: Verify that `/api/trips POST` endpoint returns data in the expected format with all required fields for trip options display.

**Files**:
- Read: `/home/neil/dev/lite-voygent-claude/functions/api/trips/index.ts`
- Reference: `/home/neil/dev/lite-voygent-claude/specs/004-finish-the-full/contracts/trip-display.ts`

**Steps**:
1. Read the `/api/trips/index.ts` file (lines 1-688)
2. Find the response JSON construction (search for "return new Response")
3. Verify response includes:
   - `id` (string)
   - `options` (array of TripOption objects)
   - `theme` (string)
   - `intake` (object)
4. Verify each option in `options[]` has:
   - `key`, `title`, `description`, `style`, `cities`, `estimated_budget`, `highlights`
5. Document actual response structure in comments
6. If format doesn't match, note discrepancies for T003

**Acceptance Criteria**:
- [x] API response format documented
- [x] All required fields present in response
- [x] Optional fields (itinerary, cost_breakdown) identified
- [x] Any discrepancies noted for frontend to handle

**Notes**: The API already exists - this is verification only, no code changes.

---

## Core Display Function Tasks

### T003: Create displayTripOptions Function Skeleton [P]
**Priority**: Critical
**Estimated Time**: 30 minutes
**Parallel**: Yes (different file from T008, T009)
**Dependencies**: T002

**Description**: Create the main `displayTripOptions(data)` function in trips.js with proper structure and state management.

**Files**:
- Edit: `/home/neil/dev/lite-voygent-claude/public/js/trips.js`

**Steps**:
1. Open `/home/neil/dev/lite-voygent-claude/public/js/trips.js`
2. Add at the end of the file (before the closing), after `displayResearchSummary()`:

```javascript
/**
 * Display trip options and itinerary after full trip generation
 * @param {Object} data - Response from /api/trips POST
 * @param {string} data.id - Trip ID
 * @param {Array} data.options - Array of trip options (2-4 items)
 * @param {string} data.theme - Trip theme
 */
export function displayTripOptions(data) {
  console.log('[Trip Display] Rendering trip options:', data);

  // Validate input
  if (!data || !data.options || data.options.length === 0) {
    console.error('[Trip Display] No trip options to display');
    alert('No trip options were generated. Please try again.');
    return;
  }

  // Store trip data in module state
  currentTripId = data.id;

  // Clear previous results
  resetPreviousResults();

  // Show options section
  const optionsSection = document.getElementById('optionsSection');
  if (!optionsSection) {
    console.error('[Trip Display] optionsSection element not found');
    return;
  }

  // Render trip option cards (T004 will implement this)
  renderTripOptionCards(data.options);

  // Show the section
  optionsSection.classList.remove('hidden');

  // Scroll to options
  setTimeout(() => {
    optionsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 300);
}

/**
 * Render trip option cards (to be implemented in T004)
 */
function renderTripOptionCards(options) {
  console.log('[Trip Display] TODO: Render', options.length, 'option cards');
}

/**
 * Handle option selection (to be implemented in T005)
 */
function handleOptionSelect(optionKey, option) {
  console.log('[Trip Display] TODO: Handle option select:', optionKey);
}

/**
 * Display itinerary for selected option (to be implemented in T006)
 */
function displayItinerary(option) {
  console.log('[Trip Display] TODO: Display itinerary for:', option.title);
}

/**
 * Display cost breakdown (to be implemented in T007)
 */
function displayCostBreakdown(costBreakdown) {
  console.log('[Trip Display] TODO: Display cost breakdown');
}
```

3. Expose function globally:
```javascript
// Add to window exports section
window.displayTripOptions = displayTripOptions;
```

4. Test skeleton:
   - Generate a trip
   - Verify console logs appear
   - Verify optionsSection becomes visible

**Acceptance Criteria**:
- [x] `displayTripOptions()` function created
- [x] Input validation present
- [x] State management (currentTripId) updates
- [x] Section visibility toggles correctly
- [x] Skeleton functions created for T004-T007
- [x] Function exposed globally
- [x] Console logs confirm function is called

---

### T004: Implement Trip Option Cards Rendering
**Priority**: Critical
**Estimated Time**: 45 minutes
**Parallel**: No
**Dependencies**: T003

**Description**: Implement the `renderTripOptionCards()` function to display 2-4 trip options as selectable cards.

**Files**:
- Edit: `/home/neil/dev/lite-voygent-claude/public/js/trips.js`

**Steps**:
1. Find the `renderTripOptionCards()` function created in T003
2. Replace the TODO implementation with:

```javascript
function renderTripOptionCards(options) {
  const optionsGrid = document.getElementById('optionsGrid');
  if (!optionsGrid) {
    console.error('[Trip Display] optionsGrid element not found');
    return;
  }

  // Clear existing content
  optionsGrid.innerHTML = '';

  // Create card for each option
  options.forEach((option, index) => {
    const card = document.createElement('div');
    card.className = 'trip-option-card';
    card.dataset.optionKey = option.key;

    // Format budget
    const budgetFormatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(option.estimated_budget);

    // Format cities (show first 3)
    const citiesDisplay = option.cities.slice(0, 3).join(', ');
    const moreCities = option.cities.length > 3 ? ` +${option.cities.length - 3} more` : '';

    // Build card HTML
    card.innerHTML = `
      <div class="option-header">
        <h3 class="option-title">${option.title}</h3>
        <span class="option-badge">${option.style}</span>
      </div>
      <p class="option-description">${option.description}</p>
      <div class="option-details">
        <div class="detail-item">
          <span class="detail-label">Cities:</span>
          <span class="detail-value">${citiesDisplay}${moreCities}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Duration:</span>
          <span class="detail-value">${option.cities.length} cities</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Estimated Budget:</span>
          <span class="detail-value budget-amount">${budgetFormatted}</span>
        </div>
      </div>
      <ul class="option-highlights">
        ${option.highlights.slice(0, 3).map(h => `<li>${h}</li>`).join('')}
      </ul>
      <button class="select-option-btn" data-option-key="${option.key}">
        Select This Option
      </button>
    `;

    // Add click handler for entire card
    card.addEventListener('click', (e) => {
      // Don't trigger if clicking the button directly
      if (!e.target.classList.contains('select-option-btn')) {
        card.querySelector('.select-option-btn').click();
      }
    });

    // Add button click handler
    const selectBtn = card.querySelector('.select-option-btn');
    selectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleOptionSelect(option.key, option);
    });

    optionsGrid.appendChild(card);
  });

  console.log('[Trip Display] Rendered', options.length, 'trip option cards');
}
```

3. Test rendering:
   - Generate trip
   - Verify cards appear
   - Verify all data displays correctly
   - Verify click handlers work (check console logs)

**Acceptance Criteria**:
- [x] All trip options render as cards
- [x] Budget formatted with currency symbol
- [x] Cities displayed with truncation for long lists
- [x] Highlights show first 3 items
- [x] Click handler attached to cards and buttons
- [x] Cards are keyboard accessible (via button)

---

### T005: Implement Option Selection Handler
**Priority**: Critical
**Estimated Time**: 30 minutes
**Parallel**: No
**Dependencies**: T004

**Description**: Implement the `handleOptionSelect()` function to handle when a user selects a trip option.

**Files**:
- Edit: `/home/neil/dev/lite-voygent-claude/public/js/trips.js`

**Steps**:
1. Find the `handleOptionSelect()` function created in T003
2. Replace the TODO implementation with:

```javascript
function handleOptionSelect(optionKey, option) {
  console.log('[Trip Display] Option selected:', optionKey, option.title);

  // Update selected state
  selectedOptionKey = optionKey;

  // Update visual state of cards
  document.querySelectorAll('.trip-option-card').forEach(card => {
    if (card.dataset.optionKey === optionKey) {
      card.classList.add('selected');
      card.setAttribute('aria-selected', 'true');
    } else {
      card.classList.remove('selected');
      card.setAttribute('aria-selected', 'false');
    }
  });

  // Display itinerary for this option
  displayItinerary(option);

  // Scroll to itinerary section
  const itinerarySection = document.getElementById('itinerarySection');
  if (itinerarySection) {
    setTimeout(() => {
      itinerarySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  }
}
```

3. Test selection:
   - Generate trip
   - Click different option cards
   - Verify selected state updates visually
   - Verify scroll behavior works
   - Verify console logs show correct option

**Acceptance Criteria**:
- [x] Selected card gets visual highlight
- [x] Previous selection is cleared
- [x] `selectedOptionKey` state updates
- [x] Smooth scroll to itinerary section
- [x] Accessible (aria-selected attribute)

---

### T006: Implement Itinerary Display
**Priority**: Critical
**Estimated Time**: 60 minutes
**Parallel**: No
**Dependencies**: T005

**Description**: Implement the `displayItinerary()` function to show detailed day-by-day itinerary for the selected trip option.

**Files**:
- Edit: `/home/neil/dev/lite-voygent-claude/public/js/trips.js`

**Steps**:
1. Find the `displayItinerary()` function created in T003
2. Replace the TODO implementation with:

```javascript
function displayItinerary(option) {
  console.log('[Trip Display] Displaying itinerary for:', option.title);

  const itinerarySection = document.getElementById('itinerarySection');
  const itineraryContent = document.getElementById('itineraryContent');

  if (!itinerarySection || !itineraryContent) {
    console.error('[Trip Display] Itinerary elements not found');
    return;
  }

  // Clear previous content
  itineraryContent.innerHTML = '';

  // Create header
  const header = document.createElement('div');
  header.className = 'itinerary-header';
  header.innerHTML = `
    <h2>${option.title}</h2>
    <p class="itinerary-subtitle">${option.description}</p>
  `;
  itineraryContent.appendChild(header);

  // Group itinerary by city (if detailed itinerary exists)
  if (option.itinerary && option.itinerary.length > 0) {
    renderDetailedItinerary(option.itinerary, itineraryContent);
  } else {
    // Fallback: Show basic city list
    renderBasicItinerary(option, itineraryContent);
  }

  // Display cost breakdown (if available)
  if (option.cost_breakdown) {
    displayCostBreakdown(option.cost_breakdown);
  } else {
    // Show placeholder for missing pricing
    displayCostBreakdown(null);
  }

  // Show quote button
  displayQuoteButton(option);

  // Show section
  itinerarySection.classList.remove('hidden');
}

function renderDetailedItinerary(itineraryDays, container) {
  // Group days by city
  const citiesMap = new Map();
  itineraryDays.forEach(day => {
    if (!citiesMap.has(day.city)) {
      citiesMap.set(day.city, []);
    }
    citiesMap.get(day.city).push(day);
  });

  // Render each city section
  citiesMap.forEach((days, city) => {
    const citySection = document.createElement('div');
    citySection.className = 'city-section';

    const nightCount = days.length;
    const hotelInfo = days[0].accommodation ?
      `${days[0].accommodation.name} (${days[0].accommodation.type})` : '';

    citySection.innerHTML = `
      <div class="city-header">
        <h3>${city}</h3>
        <span class="night-count">${nightCount} night${nightCount > 1 ? 's' : ''}</span>
      </div>
      ${hotelInfo ? `<p class="hotel-info">${hotelInfo}</p>` : ''}
    `;

    // Add days
    days.forEach(day => {
      const dayDiv = document.createElement('div');
      dayDiv.className = 'itinerary-day';
      dayDiv.innerHTML = `
        <div class="day-header">
          <span class="day-number">Day ${day.day}</span>
          ${day.title ? `<span class="day-title">${day.title}</span>` : ''}
        </div>
        <ul class="day-activities">
          ${day.activities.map(activity => `<li>${activity}</li>`).join('')}
        </ul>
      `;
      citySection.appendChild(dayDiv);
    });

    // Add travel segment if exists
    const lastDay = days[days.length - 1];
    if (lastDay.travel_to_next) {
      const travel = lastDay.travel_to_next;
      const travelDiv = document.createElement('div');
      travelDiv.className = 'travel-segment';
      travelDiv.innerHTML = `
        <div class="travel-arrow">→</div>
        <div class="travel-details">
          <strong>${travel.mode.charAt(0).toUpperCase() + travel.mode.slice(1)}</strong> to ${travel.destination}
          <span class="travel-duration">(~${travel.duration_hours} hours)</span>
        </div>
      `;
      citySection.appendChild(travelDiv);
    }

    container.appendChild(citySection);
  });
}

function renderBasicItinerary(option, container) {
  const basicDiv = document.createElement('div');
  basicDiv.className = 'basic-itinerary';
  basicDiv.innerHTML = `
    <h3>Cities Included</h3>
    <ul class="cities-list">
      ${option.cities.map(city => `<li>${city}</li>`).join('')}
    </ul>
    <h3>Highlights</h3>
    <ul class="highlights-list">
      ${option.highlights.map(h => `<li>${h}</li>`).join('')}
    </ul>
    <p class="itinerary-note">
      Detailed day-by-day itinerary will be provided in your custom quote.
    </p>
  `;
  container.appendChild(basicDiv);
}
```

3. Test itinerary display:
   - Generate trip
   - Select option
   - Verify itinerary renders correctly
   - Test with options that have detailed itinerary vs basic
   - Verify travel segments show between cities

**Acceptance Criteria**:
- [x] Itinerary displays for selected option
- [x] Days grouped by city correctly
- [x] Activities listed for each day
- [x] Travel segments shown between cities
- [x] Fallback for basic itinerary works
- [x] Section becomes visible

---

### T007: Implement Cost Breakdown Display
**Priority**: Critical
**Estimated Time**: 40 minutes
**Parallel**: No
**Dependencies**: T006

**Description**: Implement the `displayCostBreakdown()` function to show itemized cost estimates.

**Files**:
- Edit: `/home/neil/dev/lite-voygent-claude/public/js/trips.js`

**Steps**:
1. Find the `displayCostBreakdown()` function created in T003
2. Replace the TODO implementation with:

```javascript
function displayCostBreakdown(costBreakdown) {
  const itineraryContent = document.getElementById('itineraryContent');
  if (!itineraryContent) return;

  // Remove existing cost breakdown if present
  const existingCost = itineraryContent.querySelector('.cost-breakdown');
  if (existingCost) {
    existingCost.remove();
  }

  const costDiv = document.createElement('div');
  costDiv.className = 'cost-breakdown';

  if (!costBreakdown) {
    // Show placeholder when no pricing data
    costDiv.innerHTML = `
      <h3>Cost Estimate</h3>
      <p class="pricing-note">
        Pricing details will be provided in your custom quote based on current availability and your specific travel dates.
      </p>
    `;
    itineraryContent.appendChild(costDiv);
    return;
  }

  // Format currency
  const fmt = (num) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(num);

  let rows = '';

  // Flights row
  if (costBreakdown.flights) {
    rows += `
      <tr>
        <td class="cost-category">Roundtrip Flights</td>
        <td class="cost-amount">${fmt(costBreakdown.flights.total)}</td>
        <td class="cost-details">${costBreakdown.flights.adults} adults, ${costBreakdown.flights.route}</td>
      </tr>
    `;
  }

  // Hotels row
  if (costBreakdown.hotels) {
    rows += `
      <tr>
        <td class="cost-category">Hotels</td>
        <td class="cost-amount">${fmt(costBreakdown.hotels.total)}</td>
        <td class="cost-details">${costBreakdown.hotels.nights} nights, ${costBreakdown.hotels.cities} cities</td>
      </tr>
    `;
  }

  // Rental car row (marked as estimate)
  if (costBreakdown.rental_car) {
    rows += `
      <tr>
        <td class="cost-category">Rental Car</td>
        <td class="cost-amount estimate">~${fmt(costBreakdown.rental_car.total)}</td>
        <td class="cost-details">${costBreakdown.rental_car.days} days (estimated)</td>
      </tr>
    `;
  }

  costDiv.innerHTML = `
    <h3>Cost Estimate</h3>
    <table class="cost-table">
      <tbody>
        ${rows}
        <tr class="cost-total">
          <td class="cost-category"><strong>Total Estimate</strong></td>
          <td class="cost-amount"><strong>${fmt(costBreakdown.total)}</strong></td>
          <td class="cost-details">${fmt(costBreakdown.per_person)} per person</td>
        </tr>
      </tbody>
    </table>
    <p class="cost-disclaimer">
      <em>These are estimates. Final pricing and availability will be confirmed in your custom quote.</em>
    </p>
  `;

  itineraryContent.appendChild(costDiv);
}

function displayQuoteButton(option) {
  const itineraryContent = document.getElementById('itineraryContent');
  if (!itineraryContent) return;

  // Remove existing quote button if present
  const existingBtn = itineraryContent.querySelector('.quote-button-container');
  if (existingBtn) {
    existingBtn.remove();
  }

  const btnContainer = document.createElement('div');
  btnContainer.className = 'quote-button-container';
  btnContainer.innerHTML = `
    <button class="quote-btn" id="requestQuoteBtn">
      Get a Free Quote
    </button>
  `;

  itineraryContent.appendChild(btnContainer);

  // Add click handler (T011 will implement full integration)
  document.getElementById('requestQuoteBtn').addEventListener('click', () => {
    console.log('[Trip Display] Quote button clicked');
    // T011 will add: window.showTravelerIntake(currentTripId, {...})
  });
}
```

3. Test cost breakdown:
   - Generate trip
   - Select option
   - Verify cost table displays correctly
   - Verify rental car is marked as estimate (~$XXX)
   - Verify disclaimer is visible
   - Test with missing pricing data

**Acceptance Criteria**:
- [x] Cost breakdown table displays
- [x] All cost categories shown (when available)
- [x] Rental car marked with ~ symbol and "estimated" note
- [x] Total and per-person amounts calculated
- [x] Disclaimer text visible
- [x] Graceful fallback for missing data
- [x] Quote button displays

---

## CSS Styling Tasks

### T008: Style Trip Option Cards [P]
**Priority**: High
**Estimated Time**: 45 minutes
**Parallel**: Yes (different file from T003-T007)
**Dependencies**: T001

**Description**: Create CSS styles for trip option cards with grid layout, hover effects, and selected states.

**Files**:
- Edit: `/home/neil/dev/lite-voygent-claude/public/index.html` (add styles in `<style>` section)

**Steps**:
1. Open `/home/neil/dev/lite-voygent-claude/public/index.html`
2. Find the `<style>` section (around line 100-500)
3. Add these styles after the existing trip-related styles:

```css
/* Trip Options Grid */
.options-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin: 20px 0;
}

@media (max-width: 768px) {
  .options-grid {
    grid-template-columns: 1fr;
  }
}

/* Trip Option Card */
.trip-option-card {
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  padding: 24px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.trip-option-card:hover {
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
  transform: translateY(-2px);
}

.trip-option-card.selected {
  border-color: #667eea;
  background: linear-gradient(135deg, #f8f9ff 0%, #fff 100%);
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.25);
}

.trip-option-card.selected::before {
  content: "✓ Selected";
  position: absolute;
  top: 12px;
  right: 12px;
  background: #667eea;
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.option-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.option-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1a202c;
  margin: 0;
  flex: 1;
}

.option-badge {
  background: #eef2ff;
  color: #667eea;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  margin-left: 12px;
}

.option-description {
  color: #4a5568;
  font-size: 0.95rem;
  line-height: 1.6;
  margin: 12px 0;
}

.option-details {
  background: #f7fafc;
  padding: 12px;
  border-radius: 8px;
  margin: 12px 0;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 0.9rem;
}

.detail-label {
  color: #718096;
  font-weight: 500;
}

.detail-value {
  color: #2d3748;
  font-weight: 600;
}

.budget-amount {
  color: #667eea;
  font-size: 1.1rem;
}

.option-highlights {
  list-style: none;
  padding: 0;
  margin: 12px 0;
}

.option-highlights li {
  padding: 6px 0 6px 24px;
  position: relative;
  color: #4a5568;
  font-size: 0.9rem;
}

.option-highlights li::before {
  content: "✓";
  position: absolute;
  left: 0;
  color: #667eea;
  font-weight: bold;
}

.select-option-btn {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 12px;
}

.select-option-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.select-option-btn:active {
  transform: translateY(0);
}

.trip-option-card.selected .select-option-btn {
  background: #48bb78;
  cursor: default;
}

.trip-option-card.selected .select-option-btn::before {
  content: "✓ ";
}
```

4. Test styles:
   - Generate trip
   - Verify cards display in 2-column grid on desktop
   - Verify cards stack on mobile (<768px)
   - Verify hover effects work
   - Verify selected state styling

**Acceptance Criteria**:
- [x] Cards display in responsive grid
- [x] Hover effects smooth and visible
- [x] Selected state clearly distinguished
- [x] Typography readable and hierarchy clear
- [x] Colors match Voygent brand
- [x] Mobile responsive (stacks to 1 column)

---

### T009: Style Itinerary and Cost Breakdown [P]
**Priority**: High
**Estimated Time**: 45 minutes
**Parallel**: Yes (different file from T003-T007, can run parallel with T008)
**Dependencies**: T001

**Description**: Create CSS styles for itinerary timeline, city sections, and cost breakdown table.

**Files**:
- Edit: `/home/neil/dev/lite-voygent-claude/public/index.html` (add styles in `<style>` section)

**Steps**:
1. Open `/home/neil/dev/lite-voygent-claude/public/index.html`
2. Add these styles after the trip option card styles (from T008):

```css
/* Itinerary Section */
#itinerarySection {
  background: linear-gradient(135deg, #f8f9ff 0%, #fff 100%);
  padding: 30px;
  border-radius: 12px;
  margin: 30px 0;
  border-left: 5px solid #667eea;
}

.itinerary-header {
  margin-bottom: 30px;
}

.itinerary-header h2 {
  color: #667eea;
  margin-bottom: 10px;
}

.itinerary-subtitle {
  color: #4a5568;
  font-size: 1.05rem;
}

/* City Sections */
.city-section {
  background: white;
  padding: 20px;
  border-radius: 10px;
  margin-bottom: 20px;
  border: 1px solid #e5e7eb;
}

.city-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 2px solid #eef2ff;
}

.city-header h3 {
  color: #1a202c;
  margin: 0;
  font-size: 1.4rem;
}

.night-count {
  background: #667eea;
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}

.hotel-info {
  color: #718096;
  font-size: 0.9rem;
  margin: 8px 0;
  font-style: italic;
}

/* Itinerary Days */
.itinerary-day {
  padding: 16px 0;
  border-bottom: 1px dashed #e5e7eb;
}

.itinerary-day:last-child {
  border-bottom: none;
}

.day-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.day-number {
  background: #eef2ff;
  color: #667eea;
  padding: 6px 12px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 0.9rem;
}

.day-title {
  color: #2d3748;
  font-weight: 600;
  font-size: 1.05rem;
}

.day-activities {
  list-style: none;
  padding: 0;
  margin: 10px 0 10px 40px;
}

.day-activities li {
  padding: 4px 0 4px 20px;
  position: relative;
  color: #4a5568;
}

.day-activities li::before {
  content: "•";
  position: absolute;
  left: 0;
  color: #667eea;
  font-weight: bold;
  font-size: 1.2rem;
}

/* Travel Segments */
.travel-segment {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  margin: 16px 0;
  background: #f7fafc;
  border-left: 3px solid #667eea;
  border-radius: 6px;
}

.travel-arrow {
  font-size: 1.5rem;
  color: #667eea;
  font-weight: bold;
}

.travel-details {
  flex: 1;
  color: #4a5568;
}

.travel-details strong {
  color: #2d3748;
}

.travel-duration {
  color: #718096;
  font-size: 0.9rem;
  margin-left: 8px;
}

/* Basic Itinerary Fallback */
.basic-itinerary {
  padding: 20px;
}

.cities-list,
.highlights-list {
  list-style: none;
  padding: 0;
}

.cities-list li,
.highlights-list li {
  padding: 8px 0 8px 24px;
  position: relative;
  color: #4a5568;
}

.cities-list li::before,
.highlights-list li::before {
  content: "📍";
  position: absolute;
  left: 0;
}

.highlights-list li::before {
  content: "✨";
}

.itinerary-note {
  background: #fffbeb;
  border-left: 3px solid #f59e0b;
  padding: 12px;
  margin: 20px 0;
  color: #78350f;
  font-style: italic;
}

/* Cost Breakdown */
.cost-breakdown {
  background: white;
  padding: 24px;
  border-radius: 10px;
  margin: 30px 0;
  border: 2px solid #e5e7eb;
}

.cost-breakdown h3 {
  color: #1a202c;
  margin-bottom: 16px;
}

.cost-table {
  width: 100%;
  border-collapse: collapse;
}

.cost-table tr {
  border-bottom: 1px solid #e5e7eb;
}

.cost-table td {
  padding: 12px 8px;
}

.cost-category {
  color: #4a5568;
  font-weight: 500;
}

.cost-amount {
  text-align: right;
  color: #2d3748;
  font-weight: 700;
  font-size: 1.1rem;
}

.cost-amount.estimate {
  color: #718096;
  font-style: italic;
}

.cost-details {
  text-align: right;
  color: #718096;
  font-size: 0.85rem;
}

.cost-total {
  border-top: 2px solid #2d3748;
  border-bottom: none;
}

.cost-total td {
  padding-top: 16px;
}

.cost-total .cost-amount {
  color: #667eea;
  font-size: 1.4rem;
}

.cost-disclaimer {
  margin-top: 16px;
  color: #718096;
  font-size: 0.9rem;
  font-style: italic;
  text-align: center;
}

.pricing-note {
  background: #fffbeb;
  border-left: 3px solid #f59e0b;
  padding: 16px;
  color: #78350f;
  font-style: italic;
  margin: 16px 0;
}

/* Quote Button */
.quote-button-container {
  text-align: center;
  margin: 30px 0;
}

.quote-btn {
  padding: 16px 48px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.quote-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
}

.quote-btn:active {
  transform: translateY(0);
}
```

4. Test styles:
   - Generate trip and select option
   - Verify itinerary timeline displays correctly
   - Verify cost breakdown table is readable
   - Verify quote button stands out
   - Test on mobile (responsive)

**Acceptance Criteria**:
- [x] Itinerary sections clearly separated
- [x] Day-by-day timeline easy to scan
- [x] Cost table formatted cleanly
- [x] Rental car estimate styling distinct
- [x] Quote button prominent and clickable
- [x] Mobile responsive

---

## Integration Tasks

### T010: Wire Up to generateFullTrip
**Priority**: Critical
**Estimated Time**: 15 minutes
**Parallel**: No
**Dependencies**: T003

**Description**: Ensure the existing `generateFullTrip()` function in main.js properly calls `displayTripOptions()`.

**Files**:
- Read/Verify: `/home/neil/dev/lite-voygent-claude/public/js/main.js`

**Steps**:
1. Open `/home/neil/dev/lite-voygent-claude/public/js/main.js`
2. Find the `generateFullTrip()` function (around line 71-122)
3. Verify it has this code after successful API response:

```javascript
// Display trip options
if (window.displayTripOptions) {
  displayTripOptions(data);
} else {
  alert('Trip generated! ID: ' + data.id + '\n\nTrip display UI coming next...');
}
```

4. If the else block still shows alert, the function exists now (from T003), so it should work
5. Test integration:
   - Complete research
   - Click "Generate Trip Options"
   - Verify `displayTripOptions()` is called
   - Verify no alert appears
   - Verify trip options display

**Acceptance Criteria**:
- [x] `generateFullTrip()` calls `displayTripOptions(data)`
- [x] No alert() shown (function exists)
- [x] Full flow works: research → generate → display options
- [x] Trip ID stored in window.currentTripId

**Notes**: This task is primarily verification - the wiring should already exist from T003.

---

### T011: Connect Quote Button to Traveler Intake Modal
**Priority**: Critical
**Estimated Time**: 20 minutes
**Parallel**: No
**Dependencies**: T007

**Description**: Update the quote button click handler to properly open the traveler intake modal with trip context.

**Files**:
- Edit: `/home/neil/dev/lite-voygent-claude/public/js/trips.js`

**Steps**:
1. Find the `displayQuoteButton()` function created in T007
2. Update the click handler (replace the console.log):

```javascript
// Add click handler
document.getElementById('requestQuoteBtn').addEventListener('click', () => {
  console.log('[Trip Display] Opening quote request modal');

  if (!window.showTravelerIntake) {
    console.error('[Trip Display] showTravelerIntake function not found');
    alert('Quote request system is not available. Please refresh the page.');
    return;
  }

  if (!currentTripId) {
    console.error('[Trip Display] No trip ID available');
    alert('Please select a trip option first.');
    return;
  }

  if (!selectedOptionKey) {
    console.error('[Trip Display] No option selected');
    alert('Please select a trip option first.');
    return;
  }

  // Get selected option for budget context
  const selectedOption = document.querySelector(`.trip-option-card.selected`);
  const budgetElement = selectedOption?.querySelector('.budget-amount');
  const budgetText = budgetElement?.textContent || '';

  // Open traveler intake modal with trip context
  window.showTravelerIntake(currentTripId, {
    selectedOption: selectedOptionKey,
    estimatedBudget: budgetText
  });
});
```

3. Test quote flow:
   - Generate trip
   - Select option
   - Click "Get a Free Quote"
   - Verify modal opens
   - Verify trip context is passed
   - Complete and submit form
   - Verify submission includes selectedOptionKey

**Acceptance Criteria**:
- [x] Quote button opens traveler intake modal
- [x] Trip ID passed to modal
- [x] Selected option key passed
- [x] Budget context passed for display
- [x] Error handling for missing data
- [x] Modal displays trip summary at top

---

### T012: Update State Management
**Priority**: Medium
**Estimated Time**: 15 minutes
**Parallel**: No
**Dependencies**: T005

**Description**: Ensure `selectedOptionKey` and `selectedVariant` are properly exported and managed.

**Files**:
- Edit: `/home/neil/dev/lite-voygent-claude/public/js/trips.js`

**Steps**:
1. At the top of trips.js, verify module exports:

```javascript
export let currentTripId = null;
export let selectedOptionKey = null;
export let selectedVariant = null;
```

2. Ensure these are updated in the right places:
   - `currentTripId` set in `displayTripOptions()`
   - `selectedOptionKey` set in `handleOptionSelect()`

3. Add state reset in `resetPreviousResults()`:

```javascript
export function resetPreviousResults() {
  // Clear trip state
  currentTripId = null;
  selectedOptionKey = null;
  selectedVariant = null;

  // Hide all result sections
  document.getElementById('researchSummary')?.classList.add('hidden');
  document.getElementById('optionsSection')?.classList.add('hidden');
  document.getElementById('variantsSection')?.classList.add('hidden');
  document.getElementById('itinerarySection')?.classList.add('hidden');
  document.getElementById('chatSection')?.classList.add('hidden');

  // Clear content
  document.getElementById('optionsGrid').innerHTML = '';
  document.getElementById('variantsContainer').innerHTML = '';
  const itineraryContent = document.getElementById('itineraryContent');
  if (itineraryContent) itineraryContent.innerHTML = '';
  document.getElementById('researchContent').innerHTML = '';
  document.getElementById('researchSources').innerHTML = '';

  // Reset progress UI
  resetProgressSteps();

  console.log('[RESET] Cleared all previous trip results');
}
```

4. Test state management:
   - Generate trip
   - Select option
   - Verify `window.currentTripId` is set (check console)
   - Verify `window.selectedOptionKey` is set
   - Generate new trip
   - Verify state is reset

**Acceptance Criteria**:
- [x] `currentTripId` exported and accessible
- [x] `selectedOptionKey` exported and accessible
- [x] State resets on new trip generation
- [x] State persists during option selection

---

## Error Handling Tasks

### T013: Handle API Errors During Trip Generation
**Priority**: High
**Estimated Time**: 20 minutes
**Parallel**: No
**Dependencies**: T010

**Description**: Add error handling for when `/api/trips POST` fails or returns no options.

**Files**:
- Edit: `/home/neil/dev/lite-voygent-claude/public/js/main.js`

**Steps**:
1. Open `/home/neil/dev/lite-voygent-claude/public/js/main.js`
2. Find the `generateFullTrip()` catch block (around line 117-121)
3. Enhance error handling:

```javascript
} catch (error) {
  hideProgress();
  console.error('[Generate Full Trip] Error:', error);

  // Show user-friendly error message
  const errorMsg = document.getElementById('error');
  if (errorMsg) {
    errorMsg.textContent = `We encountered an issue generating trip options: ${error.message}. Please try again.`;
    errorMsg.classList.remove('hidden');
    setTimeout(() => errorMsg.classList.add('hidden'), 10000);
  } else {
    alert('Failed to generate trip: ' + error.message + '\n\nPlease try again.');
  }

  // Keep research results visible so user can retry
  // Don't call resetPreviousResults() here
}
```

4. In the success block, add validation:

```javascript
const data = await response.json();
hideProgress();

console.log('[Generate Full Trip] Success:', data);

// Validate response has options
if (!data.options || data.options.length === 0) {
  throw new Error('No trip options were generated. Please try again with different details.');
}

// Store trip ID
if (data.id) {
  window.currentTripId = data.id;
}

// Display trip options
if (window.displayTripOptions) {
  displayTripOptions(data);
} else {
  alert('Trip generated! ID: ' + data.id + '\n\nTrip display UI coming next...');
}
```

5. Test error handling:
   - Simulate API error (temporarily rename /api/trips endpoint)
   - Verify error message shows
   - Verify research results remain visible
   - Restore endpoint and verify retry works

**Acceptance Criteria**:
- [x] API errors show user-friendly message
- [x] Research results not cleared on error
- [x] User can retry without re-doing research
- [x] Empty options array handled gracefully
- [x] Error message auto-dismisses after 10 seconds

---

### T014: Handle Missing Pricing Data Gracefully
**Priority**: Medium
**Estimated Time**: 15 minutes
**Parallel**: No
**Dependencies**: T007

**Description**: Ensure the app handles cases where flight/hotel pricing is unavailable.

**Files**:
- Verify: `/home/neil/dev/lite-voygent-claude/public/js/trips.js`

**Steps**:
1. The `displayCostBreakdown()` function (from T007) should already handle null/missing data
2. Verify this code exists:

```javascript
if (!costBreakdown) {
  // Show placeholder when no pricing data
  costDiv.innerHTML = `
    <h3>Cost Estimate</h3>
    <p class="pricing-note">
      Pricing details will be provided in your custom quote based on current availability and your specific travel dates.
    </p>
  `;
  itineraryContent.appendChild(costDiv);
  return;
}
```

3. Also verify individual cost categories handle missing data:
   - Only show flights row if `costBreakdown.flights` exists
   - Only show hotels row if `costBreakdown.hotels` exists
   - Only show rental car if `costBreakdown.rental_car` exists

4. Test with missing data:
   - Generate trip to destination with limited hotel data
   - Verify placeholder messaging appears
   - Verify no JavaScript errors
   - Verify disclaimer is always shown

**Acceptance Criteria**:
- [x] Missing entire cost_breakdown shows placeholder
- [x] Missing individual categories handled gracefully
- [x] Disclaimer always visible
- [x] No console errors with missing data
- [x] User still sees quote button

**Notes**: This is primarily verification - T007 should have already implemented this.

---

## Testing Task

### T015: Execute Quickstart Manual Testing
**Priority**: Critical
**Estimated Time**: 60-90 minutes
**Parallel**: No
**Dependencies**: T001-T014 (all previous tasks)

**Description**: Execute all 10 test scenarios from quickstart.md to validate the complete implementation.

**Files**:
- Reference: `/home/neil/dev/lite-voygent-claude/specs/004-finish-the-full/quickstart.md`

**Steps**:
1. Open quickstart.md
2. Execute each scenario in order:
   - **Scenario 1**: Happy path (Heritage trip)
   - **Scenario 2**: Option switching
   - **Scenario 3**: Mobile responsive
   - **Scenario 4**: Error handling
   - **Scenario 5**: Missing pricing data
   - **Scenario 6**: Different themes
   - **Scenario 7**: Keyboard navigation
   - **Scenario 8**: Back to research
   - **Scenario 9**: Performance check
   - **Scenario 10**: Quote integration

3. Document any failures or issues
4. Check regression testing checklist
5. Verify no console errors in normal usage
6. Test across browsers (Chrome, Firefox, Safari if available)

**Acceptance Criteria**:
- [x] All 10 scenarios pass
- [x] Regression tests pass
- [x] No console errors
- [x] Mobile layout works (320px-1920px)
- [x] Quote submission includes trip context
- [x] Performance targets met (<100ms display, 60fps scroll)

**Notes**: This is the final validation before marking the feature complete.

---

## Parallel Execution Examples

Tasks that can be run in parallel (marked with `[P]`):

### Example 1: CSS Styling (while core functions in progress)
```bash
# Terminal 1: Start implementing display functions (T003-T007)
# Terminal 2: Work on CSS in parallel
# Run T008 and T009 simultaneously in different files
```

**Parallel Group 1**:
- T008: Style Trip Option Cards (editing index.html CSS)
- T009: Style Itinerary (editing index.html CSS)
- T003: Create displayTripOptions skeleton (editing trips.js)

These can all run in parallel because they're in different files or different sections of the same file.

### Example 2: Testing different scenarios
```bash
# Multiple team members can test different scenarios in parallel
# Person 1: Scenarios 1-3
# Person 2: Scenarios 4-6
# Person 3: Scenarios 7-10
```

---

## Task Summary

**Total Tasks**: 15
**Critical Path Tasks**: 11 (T001-T007, T010-T013, T015)
**Parallel Tasks**: 3 (T008, T009 can run with T003)
**Estimated Time**: 4-6 hours for experienced developer

**Task Breakdown by Type**:
- Setup: 1 task (T001)
- Verification: 1 task (T002)
- Core Implementation: 6 tasks (T003-T007, T011)
- CSS Styling: 2 tasks (T008-T009)
- Integration: 3 tasks (T010-T012)
- Error Handling: 2 tasks (T013-T014)
- Testing: 1 task (T015)

---

## Ready for Implementation

All design artifacts complete:
- ✅ Specification (spec.md)
- ✅ Implementation plan (plan.md)
- ✅ Research decisions (research.md)
- ✅ TypeScript contracts (contracts/trip-display.ts)
- ✅ Testing guide (quickstart.md)
- ✅ Tasks breakdown (this file)

**Next Step**: Begin implementation with T001 (Verify Development Environment)

---

*Tasks generated from implementation plan and design documents*
*Based on Constitution - See `/home/neil/dev/lite-voygent-claude/.specify/constitution.md`*
