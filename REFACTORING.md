# Code Refactoring Plan

## Current State
- `public/app.js` - 597 lines (OVER 500 LINE LIMIT!)
- `public/index.html` - 432 lines (approaching limit)

## Refactoring Strategy for app.js

Split into these modules (all files <150 lines each):

### 1. `/public/js/state.js` (~20 lines)
- Export global state variables:
  - `selectedFiles`, `currentTripId`, `selectedOptionKey`, `selectedVariant`

### 2. `/public/js/diagnostics.js` (~40 lines) ✅ DONE
- `toggleDiagnostics()`
- `logDiagnostic()`
- `updateDiagnosticsDisplay()`

### 3. `/public/js/file-upload.js` (~50 lines) ✅ DONE
- `initFileUpload()`
- `handleFiles()`
- `updateFileList()`
- `removeFile()`

### 4. `/public/js/trip-generator.js` (~120 lines)
- `generateTrip()` - Main trip generation logic
- `buildTextInput()` - Form data collection
- `displayOptions()` - Show trip options
- `selectOption()` - Option selection handler
- `confirmSelection()` - Submit selected option

### 5. `/public/js/hotel-selector.js` (~150 lines)
- `displayHotels()` - Main hotel display orchestrator
- `createHotelsContainer()` - DOM container setup
- `renderCityHotels()` - City section rendering
- `renderHotelCard()` - Individual hotel cards
- `selectHotel()` - Hotel selection handler
- `confirmHotelSelection()` - Submit hotel choices

### 6. `/public/js/variant-display.js` (~100 lines)
- `displayVariants()` - Show A/B variants
- `renderVariant()` - Individual variant rendering
- `selectVariant()` - Variant selection handler

### 7. `/public/js/chat.js` (~60 lines)
- `sendChatMessage()` - Chat message sending
- `addChatMessage()` - Add message to UI
- Event listeners for Enter key

### 8. `/public/js/ui-helpers.js` (~20 lines) ✅ DONE
- `showError()`, `hideError()`
- `showSuccess()`, `hideSuccess()`

### 9. `/public/js/app.js` (NEW - ~50 lines)
- Import all modules
- Initialize on DOMContentLoaded
- Wire up global functions for onclick handlers

## Implementation Steps

1. Create each module file with proper ES6 exports
2. Update `index.html` to load app.js as module:
   ```html
   <script type="module" src="js/app.js"></script>
   ```
3. Move global onclick handlers to window object where needed
4. Test thoroughly after each module migration
5. Delete old app.js once all functionality works

## Benefits
- Each file under 150 lines (well below 500 limit)
- Better separation of concerns
- Easier to test individual features
- Faster to find and modify code
- Can be code-split for performance

## Priority
- **High** - app.js is already 97 lines over limit
- Should complete before adding more features
