# Quickstart: Test Complete Trip Planning Flow

**Feature**: 004-finish-the-full
**Branch**: `004-finish-the-full`
**Prerequisites**: Local development server running (`wrangler pages dev --local --port 8788 public`)

## Overview
This guide provides manual testing scenarios for the complete trip planning flow from research through to quote request. Test each scenario in order to verify all functionality works correctly.

---

## Setup

### 1. Start Local Server
```bash
cd /home/neil/dev/lite-voygent-claude
wrangler pages dev --local --port 8788 public
```

### 2. Open Application
Navigate to: `http://localhost:8788`

### 3. Verify Database
Ensure D1 database (voygent-themed) has all migrations applied:
```bash
npx wrangler d1 list
```

---

## Test Scenario 1: Happy Path - Heritage Trip

### Objective
Test the complete flow from research to quote request with a heritage theme trip.

### Steps
1. **Select Theme**: Click "Heritage & Ancestry" theme button
2. **Enter Quick Search**: Type "McLeod surname Isle of Skye Scotland"
3. **Start Research**: Click "Start Planning My Trip"
   - ✅ Verify: Progress indicator appears
   - ✅ Verify: Research summary displays with findings
   - ✅ Verify: "Generate Trip Options" button appears

4. **Generate Trip**: Click "Generate Trip Options"
   - ✅ Verify: Progress indicator shows generation status
   - ✅ Verify: Progress messages are theme-specific
   - ✅ Verify: Takes 30-60 seconds (normal for full generation)

5. **View Trip Options**: When generation completes
   - ✅ Verify: 2-4 trip option cards display
   - ✅ Verify: Each card shows title, description, duration, budget
   - ✅ Verify: Cards are clickable with hover effects
   - ✅ Verify: Layout is clean and readable

6. **Select Option**: Click on first trip option card
   - ✅ Verify: Card gets visual highlight (border/background change)
   - ✅ Verify: Page smoothly scrolls to itinerary section
   - ✅ Verify: Detailed itinerary displays below

7. **Review Itinerary**: Check itinerary content
   - ✅ Verify: Shows day-by-day timeline
   - ✅ Verify: Cities grouped with night counts
   - ✅ Verify: Activities listed for each day
   - ✅ Verify: Travel segments show between cities

8. **View Costs**: Scroll to cost breakdown
   - ✅ Verify: Itemized breakdown shows (Flights, Hotels, Rental Car)
   - ✅ Verify: Rental car marked as "estimated" with ~ symbol
   - ✅ Verify: Total shown prominently
   - ✅ Verify: Disclaimer about estimates is visible

9. **Request Quote**: Click "Get a Free Quote" button
   - ✅ Verify: Traveler intake modal opens
   - ✅ Verify: Modal shows trip context at top
   - ✅ Verify: Can complete and submit form

### Expected Result
Complete flow works end-to-end with no errors. Trip data properly flows from research → options → itinerary → quote.

### Console Check
Open browser DevTools console and verify:
- No JavaScript errors
- Logs show trip ID, selected option key
- API responses logged correctly

---

## Test Scenario 2: Option Switching

### Objective
Verify that selecting different trip options updates the itinerary correctly.

### Steps
1. **Complete Scenario 1** up to step 6 (trip options displayed)

2. **Select First Option**: Click option A card
   - ✅ Verify: Itinerary displays for option A
   - Note: Cities, days, activities for option A

3. **Select Second Option**: Click option B card
   - ✅ Verify: Previous itinerary is replaced
   - ✅ Verify: New itinerary shows different content
   - ✅ Verify: Card highlight moves to option B
   - ✅ Verify: Cost breakdown updates

4. **Select Third Option**: Click option C (if exists)
   - ✅ Verify: Itinerary updates again
   - ✅ Verify: Smooth transition (no flicker)

### Expected Result
Selecting different options cleanly replaces the displayed itinerary. No duplicate content or stale data.

---

## Test Scenario 3: Mobile Responsive Layout

### Objective
Verify trip display works correctly on mobile devices.

### Steps
1. **Resize Browser**: Set to 375px width (iPhone size)
   - Chrome DevTools: Toggle device toolbar, select iPhone SE

2. **Complete Scenario 1** (research → generate → select)

3. **Check Trip Options Layout**:
   - ✅ Verify: Cards stack vertically (1 column)
   - ✅ Verify: Text is readable, no horizontal scroll
   - ✅ Verify: Buttons are tappable (44px minimum touch target)

4. **Check Itinerary Layout**:
   - ✅ Verify: Timeline stacks vertically
   - ✅ Verify: City headers are clear
   - ✅ Verify: Activities list is readable
   - ✅ Verify: No text overflow or truncation

5. **Check Cost Breakdown**:
   - ✅ Verify: Table adapts to mobile (no horizontal scroll)
   - ✅ Verify: Numbers remain right-aligned
   - ✅ Verify: Disclaimer text is readable

### Expected Result
All content is fully accessible and readable on mobile devices. No horizontal scrolling required.

---

## Test Scenario 4: Error Handling - API Failure

### Objective
Verify graceful error handling when trip generation fails.

### Steps
1. **Simulate API Error**: Temporarily break API (rename `/api/trips/index.ts`)
   ```bash
   mv functions/api/trips/index.ts functions/api/trips/index.ts.bak
   ```

2. **Complete Research Phase**: Enter details, generate research
   - ✅ Verify: Research completes successfully

3. **Attempt Trip Generation**: Click "Generate Trip Options"
   - ✅ Verify: Progress indicator appears
   - ✅ Verify: After timeout, error message displays
   - ✅ Verify: Error message is user-friendly (not technical)
   - ✅ Verify: Research results are still visible

4. **Restore API**: Rename file back
   ```bash
   mv functions/api/trips/index.ts.bak functions/api/trips/index.ts
   ```

5. **Retry**: Click "Generate Trip Options" again
   - ✅ Verify: Works correctly now
   - ✅ Verify: Previous error is cleared

### Expected Result
Errors are handled gracefully with clear messages. Users can retry without restarting from scratch.

---

## Test Scenario 5: Missing Pricing Data

### Objective
Verify fallback behavior when pricing data is unavailable.

### Steps
1. **Check Server Logs**: Monitor console for pricing lookup errors
   - Common: Small towns with no hotels in Amadeus
   - Common: Regional airports with no flights

2. **Generate Trip**: Use a destination likely to have missing data
   - Example: "Harrison surname Northumberland National Park"

3. **View Cost Breakdown**:
   - ✅ Verify: Missing categories show "to be determined" message
   - ✅ Verify: Available data still displays
   - ✅ Verify: Disclaimer emphasizes custom quote
   - ✅ Verify: Total still calculates from available data

### Expected Result
Missing pricing doesn't break the display. Clear messaging guides user to request quote for exact pricing.

---

## Test Scenario 6: Different Themes

### Objective
Verify trip display works correctly across all theme types.

### Steps
Test each theme in order:

**Heritage & Ancestry**:
- Input: "Roberts surname Wales England"
- ✅ Verify: Theme-specific research summary
- ✅ Verify: Trip options relevant to heritage sites
- ✅ Verify: Itinerary includes castles, historical locations

**TV & Movie Locations**:
- Input: "Game of Thrones filming locations"
- ✅ Verify: Trip options focused on filming sites
- ✅ Verify: Itinerary mentions specific scenes/locations

**Historical Events**:
- Input: "World War II D-Day Normandy"
- ✅ Verify: Trip options include battlefields, museums
- ✅ Verify: Itinerary has historical education focus

**Culinary Journeys**:
- Input: "Italian cuisine Tuscany Florence"
- ✅ Verify: Trip options feature food experiences
- ✅ Verify: Itinerary includes restaurants, markets, cooking

**Adventure & Outdoor**:
- Input: "Hiking Scottish Highlands"
- ✅ Verify: Trip options feature outdoor activities
- ✅ Verify: Itinerary includes trails, national parks

### Expected Result
Trip display adapts correctly to each theme's content type. No theme-specific display bugs.

---

## Test Scenario 7: Keyboard Navigation

### Objective
Verify trip options are fully accessible via keyboard.

### Steps
1. **Complete Research Phase**
2. **Generate Trip Options**

3. **Keyboard-Only Navigation**:
   - Press `Tab` repeatedly
   - ✅ Verify: Focus moves between trip option cards
   - ✅ Verify: Focused card has visible outline/border
   - ✅ Verify: Can select with `Enter` key
   - ✅ Verify: Tab order is logical (left-to-right, top-to-bottom)

4. **Itinerary Navigation**:
   - Continue tabbing through itinerary
   - ✅ Verify: Can tab to "Get a Free Quote" button
   - ✅ Verify: Can activate with `Enter` key

### Expected Result
All interactive elements are keyboard accessible. Tab order is logical and focus is always visible.

---

## Test Scenario 8: Back to Research

### Objective
Verify user can return to research results after viewing trip options.

### Steps
1. **Complete Full Flow**: Research → Generate → Select Option
2. **Scroll Up**: Return to research summary section
   - ✅ Verify: Research findings still visible
   - ✅ Verify: "Generate Trip Options" button still works

3. **Re-generate**: Click "Generate Trip Options" again
   - ✅ Verify: Previous trip options are cleared
   - ✅ Verify: New options display
   - ✅ Verify: No duplicate content

### Expected Result
Users can re-generate trips without page refresh. Previous results are properly cleared.

---

## Test Scenario 9: Performance Check

### Objective
Verify trip display renders quickly and smoothly.

### Steps
1. **Open Browser DevTools**: Performance tab
2. **Record Performance**: Start recording
3. **Generate Trip and Select Option**: Complete flow
4. **Stop Recording**: Analyze timeline

### Performance Targets
- ✅ Trip options display: <100ms after data received
- ✅ Itinerary render: <150ms after option selected
- ✅ Smooth scroll: 60fps, no jank
- ✅ No memory leaks: Check for event listener cleanup

### DevTools Console Check
```javascript
// Check for memory leaks
console.log(performance.memory); // Note heap size before/after
```

### Expected Result
All renders complete within target times. No performance regressions.

---

## Test Scenario 10: Quote Request Integration

### Objective
Verify selected trip data flows correctly to quote request.

### Steps
1. **Generate and Select Trip Option**: Complete up to itinerary view
2. **Note Trip Details**: Remember option key, budget, cities
3. **Click "Get a Free Quote"**

4. **Verify Modal Context**:
   - ✅ Verify: Modal shows trip title
   - ✅ Verify: Option key is passed (check form data)
   - ✅ Verify: Trip ID is included

5. **Submit Quote Request**:
   - Fill in: Name, email
   - Submit form
   - ✅ Verify: Submission includes trip context
   - ✅ Verify: Success confirmation displays

6. **Check Database**: Query themed_trips table
   ```bash
   npx wrangler d1 execute voygent-themed --local --command="SELECT id, status, handoff_json FROM themed_trips ORDER BY created_at DESC LIMIT 1"
   ```
   - ✅ Verify: handoff_json includes selected_option_key
   - ✅ Verify: status is 'quote_requested'

### Expected Result
Complete trip context (option, itinerary, costs) is included in quote request payload.

---

## Regression Testing Checklist

After implementation, verify these existing features still work:

- [ ] Research phase completes successfully
- [ ] Progress indicators show/hide correctly
- [ ] Theme selection updates quick search placeholder
- [ ] File upload works (image OCR)
- [ ] Error messages display correctly
- [ ] No console errors in normal usage
- [ ] Page is responsive across breakpoints
- [ ] White-label branding still applies (if agency configured)

---

## Known Limitations

Document any known issues or limitations:

1. **Trip regeneration**: Requires page refresh to fully clear state (acceptable)
2. **Browser support**: Requires modern browser with ES2022 support
3. **Rental car pricing**: Always estimated (no live API)
4. **Currency**: Only USD supported currently

---

## Debugging Tips

### Issue: Trip options not displaying
**Check**:
- Console for API errors
- Network tab for `/api/trips` response
- Verify `displayTripOptions` function exists in trips.js

### Issue: Itinerary not updating on selection
**Check**:
- Click event listeners attached correctly
- `selectedOptionKey` variable updates
- Itinerary HTML is being replaced, not appended

### Issue: Cost breakdown missing
**Check**:
- API response includes `cost_breakdown` field
- Pricing data exists in response
- Fallback messages display for missing data

### Issue: Quote request fails
**Check**:
- Trip ID is set in `window.currentTripId`
- Selected option key is set
- Modal receives correct parameters

---

## Success Criteria

All 10 test scenarios pass:
- [x] Scenario 1: Happy path - Heritage trip
- [x] Scenario 2: Option switching
- [x] Scenario 3: Mobile responsive
- [x] Scenario 4: Error handling
- [x] Scenario 5: Missing pricing
- [x] Scenario 6: Different themes
- [x] Scenario 7: Keyboard navigation
- [x] Scenario 8: Back to research
- [x] Scenario 9: Performance check
- [x] Scenario 10: Quote integration

No console errors. All regression tests pass. Ready for production.

---

*Manual testing guide complete. Execute scenarios in order for thorough validation.*
