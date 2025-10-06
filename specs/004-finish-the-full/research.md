# Research: Complete Full Trip Planning Flow

**Feature**: 004-finish-the-full
**Date**: 2025-10-06
**Status**: Complete

## Overview
This document contains research findings and design decisions for implementing the missing trip options display and itinerary view in the Voygent trip planning flow.

## Current State Analysis

### What's Working
1. **Research Phase** (`/api/research POST`):
   - Intake normalization with theme-specific prompts
   - Web search via Serper/Tavily
   - AI synthesis of findings
   - Research summary display with sources
   - "Generate Trip Options" button appears after research

2. **Quote Request System**:
   - Traveler intake modal (traveler-intake.js)
   - Quote API endpoint (`/api/trips/:id/request-quote`)
   - Handoff JSON storage
   - Agency routing support

3. **Infrastructure**:
   - Progress indicators (progress.js, progress-steps.js)
   - Theme-specific messaging
   - HTML sections already exist (#optionsSection, #itinerarySection)
   - State management in trips.js

### What's Missing
1. **Trip Options Display**: After `/api/trips POST` completes, no function displays the generated options
2. **Option Selection**: No UI for selecting between 2-4 trip options
3. **Itinerary View**: No display of day-by-day itinerary after selection
4. **Cost Breakdown**: No pricing display (flights, hotels, rental car)
5. **Quote Integration**: No connection passing selected trip to quote modal

## Research Question 1: API Response Format

### Investigation
Examined `/home/neil/dev/lite-voygent-claude/functions/api/trips/index.ts` (688 lines)

### Findings
The `/api/trips POST` endpoint returns:
```typescript
{
  id: string,                    // Trip ID (nanoid)
  theme: string,                 // e.g., "heritage"
  intake: IntakeJSON,            // Normalized intake data
  options: TripOption[],         // Array of 2-4 trip options
  research: ResearchStep[],      // Research findings
  diagnostics: {
    intake: {...},
    options: {...}
  }
}
```

Each `TripOption` has:
```typescript
{
  key: string,                   // "A", "B", "C", or "D"
  title: string,                 // e.g., "Heritage Highlights - 7 Days"
  description: string,           // Brief overview
  style: string,                 // "Guided Experience" | "Self-Guided Adventure"
  cities: string[],              // ["Edinburgh", "Inverness", "Isle of Skye"]
  estimated_budget: number,      // Total in USD
  highlights: string[]           // Key activities
}
```

### Decision
Use existing API response format. No backend changes needed - just display the data properly.

---

## Research Question 2: Visual Design for Trip Options

### Investigation
Reviewed existing Voygent UI patterns:
- Research summary uses gradient background with border
- Theme selector uses card-based layout with hover effects
- Progress indicators use theme-specific colors

### Design Considerations
1. **Layout**: Grid vs List vs Carousel
2. **Information density**: How much to show on each card
3. **Selection indication**: How to show which option is selected
4. **Mobile responsiveness**: Stack vs horizontal scroll

### Decision: Card-Based Grid Layout

**Desktop (2 columns)**:
```
┌─────────────────┐  ┌─────────────────┐
│ Trip Option A   │  │ Trip Option B   │
│                 │  │                 │
│ 7 Days          │  │ 10 Days         │
│ $3,500 est.     │  │ $4,800 est.     │
│ [Select]        │  │ [Select]        │
└─────────────────┘  └─────────────────┘
```

**Mobile (1 column stack)**:
```
┌─────────────────┐
│ Trip Option A   │
│ 7 Days          │
│ $3,500 est.     │
│ [Select]        │
└─────────────────┘
┌─────────────────┐
│ Trip Option B   │
│ 10 Days         │
│ $4,800 est.     │
│ [Select]        │
└─────────────────┘
```

**Card Content**:
- Title (e.g., "Heritage Highlights")
- Duration badge (e.g., "7 Days")
- City list preview (first 3 cities)
- Estimated budget (prominent)
- Description (2-3 sentences)
- Select button or clickable card

**Interaction States**:
- Hover: Slight elevation, border color change
- Selected: Primary color border, checkmark icon, different background
- Click: Scroll to itinerary section smoothly

---

## Research Question 3: Itinerary Display Format

### Investigation
Reviewed travel itinerary patterns from:
- Booking.com (simple timeline)
- TripAdvisor (detailed day-by-day)
- Tour operator websites (chronological with images)

### Design Considerations
1. **Granularity**: Show every activity vs high-level overview?
2. **Grouping**: By day, by city, or hybrid?
3. **Travel segments**: How to show transportation between cities?
4. **Expandability**: Collapsible sections for long trips?

### Decision: Hybrid Timeline Format

**Structure**: Group by city, show days within each city

```
Edinburgh (3 nights) - $450/night
  Day 1: Arrival & Old Town
    - Check into hotel
    - Walking tour of Royal Mile
    - Edinburgh Castle visit
  Day 2: Museums & Culture
    - National Museum of Scotland
    - Scottish Parliament tour
  Day 3: Arthur's Seat hike

→ Travel to Inverness (3 hours drive)

Inverness (2 nights) - $320/night
  Day 4: Highland Discovery
    - Loch Ness tour
    - Urquhart Castle
  Day 5: Culloden Battlefield
    - Historical site visit
    - Return preparation
```

**Visual Elements**:
- City headers with night count and hotel info
- Day numbers with activity bullets
- Travel segments between cities (arrow + mode + duration)
- Subtle borders separating cities
- Responsive: Stack vertically on mobile

**Collapsible Option**: Use `<details>` elements for days on mobile to reduce scroll length

---

## Research Question 4: Cost Breakdown Display

### Investigation
Analyzed Amadeus API integration in codebase:
- `functions/api/lib/amadeus.ts` - Flight and hotel search
- Rental car is estimated (no live API)
- Prices returned in various currencies (need USD conversion)

### Cost Categories
1. **Flights**: Roundtrip from departure airport, per person
2. **Hotels**: Total across all cities/nights
3. **Rental Car**: Estimated daily rate × duration (if applicable)
4. **Total**: Sum of above

### Design Considerations
1. **Transparency**: Show itemized breakdown vs total only?
2. **Estimates**: How to indicate these are not final prices?
3. **Missing data**: What if flight/hotel pricing unavailable?
4. **Currency**: Always display in USD?

### Decision: Transparent Itemized Breakdown

**Format**:
```
Cost Estimate

Roundtrip Flights      $1,200  (2 adults, JFK → EDI)
Hotels (10 nights)     $3,800  (3 cities, comfort level)
Rental Car (7 days)    ~$420   (estimated)
                       ------
Total Estimate         $5,420  ($2,710 per person)

Note: These are estimates. Final pricing and availability
will be confirmed in your custom quote.
```

**CSS Styling**:
- Clean table layout
- Right-aligned numbers
- Subtle borders
- Rental car marked with ~ symbol and lighter text
- Disclaimer in smaller, italicized text below

**Missing Data Handling**:
- If no flight data: "Flight pricing to be determined"
- If no hotel data: "Hotel pricing to be determined"
- If rental car not applicable: Omit row entirely
- Always show disclaimer about estimates

---

## Research Question 5: Quote Integration

### Investigation
Examined existing quote flow:
- `public/js/traveler-intake.js` - Modal controller
- `/api/trips/:id/request-quote` - Quote submission endpoint
- `handoff_json` column in `themed_trips` table stores complete trip data

### Integration Points
1. **Trigger**: "Get a Free Quote" button after itinerary
2. **Data passing**: Need to pass tripId + selectedOptionKey
3. **Pre-filling**: Can pre-fill modal with trip details
4. **State management**: Store selection for submission

### Decision: Pass Trip Context to Modal

**Button Placement**: Bottom of itinerary section, after cost breakdown

**Data Flow**:
```javascript
// In displayTripOptions()
window.currentTripId = data.id;
window.selectedOptionKey = 'A'; // or whichever user selected

// Quote button click
const quoteBtn = document.createElement('button');
quoteBtn.onclick = () => {
  window.showTravelerIntake(window.currentTripId, {
    selectedOption: window.selectedOptionKey,
    estimatedBudget: selectedOption.estimated_budget
  });
};
```

**Modal Updates** (if needed):
- Pre-fill trip ID in hidden field
- Show trip summary at top of modal
- Include selected option key in submission payload

---

## Technology Stack Decisions

### Frontend
- **Language**: JavaScript ES2022+ (no TypeScript for client-side for now)
- **Styling**: Vanilla CSS (no frameworks)
- **Module system**: ES6 imports/exports (already in use)
- **State**: Module-level variables in trips.js

### Integration
- **API client**: Fetch API (already in use)
- **Progress indicators**: Existing progress.js system
- **Error handling**: Existing alert() + console.error() pattern
- **Scroll behavior**: `element.scrollIntoView({behavior: 'smooth'})`

### No New Dependencies
All functionality achievable with existing tech stack.

---

## Performance Considerations

### Rendering Performance
- **Target**: <100ms to display trip options (data already fetched)
- **Strategy**: Use document fragments for batch DOM insertion
- **Optimization**: Minimize reflows by building complete HTML strings

### Scroll Performance
- **Smooth scrolling**: Use `scrollIntoView({behavior: 'smooth', block: 'start'})`
- **Debouncing**: Not needed for single-click events
- **Mobile**: Test on iOS/Android for smooth scroll support

### Data Loading
- **No additional API calls**: All data from single `/api/trips POST`
- **Progress feedback**: Use existing showProgress()/hideProgress()
- **Caching**: Not applicable (single-use display)

---

## Accessibility Considerations

### Keyboard Navigation
- Trip option cards: Make fully keyboard-accessible (tabindex, Enter key)
- Quote button: Ensure tab order is logical
- Collapsible sections: Native `<details>` elements are keyboard-accessible

### Screen Readers
- Use semantic HTML (`<article>` for trip options, `<section>` for itinerary)
- ARIA labels for buttons ("Select Heritage Highlights trip")
- Announce selection changes (aria-live regions if needed)

### Visual
- Maintain WCAG AA contrast ratios
- Don't rely solely on color for selection state (use icons + borders)
- Ensure text is readable at 200% zoom

---

## Edge Cases & Error Handling

### API Errors
1. **Trip generation fails**:
   - Display: "We encountered an issue generating trip options. Please try again."
   - Action: Hide progress, show error, preserve research results
   - Recovery: Allow user to click "Generate Trip Options" again

2. **Timeout**:
   - Display: "Trip generation is taking longer than expected..."
   - Action: Extend timeout or show option to wait/retry
   - Recovery: Same as above

### Data Issues
1. **No options returned**:
   - Fallback: Show message, allow retry
   - Log: Console error for debugging

2. **Missing pricing**:
   - Fallback: Show "Pricing to be determined" for missing categories
   - Always show disclaimer

3. **Empty itinerary**:
   - Fallback: Show trip option without detailed breakdown
   - Note in quote request for agent review

### User Flow Edge Cases
1. **User goes back to research**: Clear selected option, allow re-generation
2. **Multiple generations**: Clear previous options before showing new ones
3. **Page refresh**: Trip data lost (expected - no persistence needed)

---

## Testing Strategy

### Manual Testing Scenarios
1. **Happy path**: Research → Generate → Select option → View itinerary → Request quote
2. **Multiple options**: Generate trip with 4 options, select each one, verify display updates
3. **Error handling**: Simulate API failure, verify error message and recovery
4. **Mobile**: Test on iOS/Android, verify layout and interactions
5. **Themes**: Test with heritage, tvmovie, historical, culinary, adventure themes
6. **Missing data**: Test with trips that have no pricing data

### Success Criteria
- All 6 acceptance scenarios pass
- All 4 edge cases handled gracefully
- Mobile layout works on screens 320px-1920px wide
- Keyboard navigation works completely
- No console errors in normal usage

---

## Design Decisions Summary

| Question | Decision |
|----------|----------|
| Trip options layout | Card-based grid (2 cols desktop, 1 col mobile) |
| Option selection | Click card or button, visual highlight on selected |
| Itinerary format | Hybrid timeline (group by city, show days within) |
| Cost breakdown | Itemized table with disclaimer |
| Quote integration | Pass tripId + selectedOptionKey to modal |
| Error handling | Graceful fallbacks, preserve research, allow retry |
| Tech stack | Vanilla JS/CSS, no new dependencies |
| Accessibility | Semantic HTML, keyboard nav, WCAG AA |

---

## Next Steps (Phase 1)

1. Create TypeScript interfaces for API response types (contracts/trip-display.ts)
2. Write quickstart.md with manual testing scenarios
3. Proceed to task generation (/tasks command)

---

*Research complete. Ready for Phase 1: Design & Deliverables.*
