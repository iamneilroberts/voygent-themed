# Quickstart: Admin Screen UI Improvement Testing

**Feature**: 003-improve-the-vogent
**Purpose**: Manual test scenarios to validate admin screen redesign
**Prerequisites**:
- Local development environment running (`npm run dev` or `wrangler pages dev`)
- Admin access credentials
- Modern web browser (Chrome, Firefox, Safari, or Edge)

---

## Test Scenario: Admin Screen Visual Redesign

### Setup
1. Navigate to `http://localhost:8788/admin.html` (or production `/admin`)
2. Log in with admin credentials (if authentication required)
3. Ensure browser DevTools console is open for error checking

---

## Part 1: Visual Design Verification

### Test 1.1: Color Palette
**Expected**: New grayscale + blue accent color scheme applied

**Steps**:
1. Load admin page
2. Inspect visual elements

**Validations**:
- [ ] Background color is light gray (#F8F9FA), not purple gradient
- [ ] Card/section backgrounds are white (#FFFFFF)
- [ ] Primary text is near-black (#212529)
- [ ] Buttons use blue accent (#0066CC), not purple gradient
- [ ] No gradient backgrounds visible anywhere on page

**Screenshot Comparison**:
- **Before**: Purple gradient header, purple gradient buttons
- **After**: Clean gray background, flat blue buttons

---

### Test 1.2: Layout & Spacing
**Expected**: Improved layout with better whitespace and readability

**Steps**:
1. Observe overall page layout
2. Measure container width using DevTools

**Validations**:
- [ ] Container max-width is 1000px (inspect element to confirm)
- [ ] Card padding is 24px (inspect `.admin-section` or equivalent)
- [ ] Consistent 20px spacing between cards/sections
- [ ] Shadows are subtle (light gray, not heavy black)
- [ ] Borders are 1px solid light gray, not thick/decorative

---

### Test 1.3: Typography & Hierarchy
**Expected**: Clear visual hierarchy with readable text

**Steps**:
1. Review headings, labels, and body text
2. Check font sizes and weights

**Validations**:
- [ ] H1 headings are prominent but not oversized
- [ ] H2 section headings clearly separate content
- [ ] Labels are distinct from input values
- [ ] Body text is comfortable to read (16px base size)
- [ ] No text is too small (<14px) or too large (>28px)

---

### Test 1.4: WCAG AA Contrast Compliance
**Expected**: All text meets accessibility contrast requirements

**Steps**:
1. Use browser DevTools Accessibility Inspector or online contrast checker
2. Check contrast ratios for:
   - Body text (#212529) on background (#F8F9FA)
   - Secondary text (#6C757D) on white
   - Blue links/buttons (#0066CC) on white

**Validations**:
- [ ] Primary text contrast ≥ 4.5:1 (WCAG AA for normal text)
- [ ] Secondary text contrast ≥ 4.5:1
- [ ] Interactive element contrast ≥ 4.5:1
- [ ] No color-only indicators (icons/text accompany color)

**Tools**:
- Chrome DevTools → Accessibility → Contrast
- WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/

---

## Part 2: Toast Notification System

### Test 2.1: Success Toast
**Expected**: Green toast appears in bottom-right, auto-dismisses after 3 seconds

**Steps**:
1. Perform a save operation (e.g., create a theme, grant agent privilege)
2. Observe toast notification

**Validations**:
- [ ] Toast appears in bottom-right corner (24px from edges)
- [ ] Toast has green background (#10B981)
- [ ] Toast shows checkmark icon
- [ ] Toast message is clear (e.g., "Theme saved successfully")
- [ ] Toast has close button (×)
- [ ] Toast auto-dismisses after 3 seconds
- [ ] Toast slides in from right (smooth animation, ~200ms)
- [ ] Toast fades out when dismissed (smooth animation, ~150ms)

**Manual Actions**:
- Click close button before auto-dismiss → toast disappears immediately
- Wait for auto-dismiss → toast disappears after 3 seconds

---

### Test 2.2: Error Toast
**Expected**: Red toast appears, auto-dismisses after 5 seconds

**Steps**:
1. Trigger an error (e.g., submit invalid data, simulate network failure using DevTools)
2. Observe error toast

**Validations**:
- [ ] Toast appears in bottom-right corner
- [ ] Toast has red background (#EF4444)
- [ ] Toast shows error icon (X or warning symbol)
- [ ] Error message is descriptive (not generic "Error occurred")
- [ ] Toast auto-dismisses after 5 seconds (longer than success)
- [ ] Form data is preserved after error (not cleared)

**Error Simulation**:
- DevTools → Network tab → Offline → trigger save → see error toast
- Re-enable network, retry save → success toast

---

### Test 2.3: Multiple Toasts (Stacking)
**Expected**: Multiple toasts stack vertically, maximum 3 visible

**Steps**:
1. Rapidly trigger multiple save operations (if possible)
2. OR manually call `showToast()` function multiple times in console

**Validations**:
- [ ] Toasts stack vertically with 12px spacing
- [ ] Newer toasts appear above older toasts
- [ ] Maximum 3 toasts visible at once
- [ ] If 4th toast appears, oldest auto-dismissed
- [ ] Each toast auto-dismisses independently (not all at once)

**Console Test**:
```javascript
showToast('success', 'Test 1');
setTimeout(() => showToast('success', 'Test 2'), 500);
setTimeout(() => showToast('error', 'Test 3'), 1000);
setTimeout(() => showToast('success', 'Test 4'), 1500);
// Verify only 3 visible at once
```

---

## Part 3: Button Loading States

### Test 3.1: Save Button Spinner
**Expected**: Button shows spinner during save operation

**Steps**:
1. Click a "Save" button (theme, agent, configuration)
2. Observe button state during API call

**Validations**:
- [ ] Button displays spinner icon (16px circular animation)
- [ ] Button text changes to "Saving..." (or similar)
- [ ] Button is disabled (cursor: not-allowed)
- [ ] Button cannot be clicked again while loading
- [ ] Spinner rotates smoothly (60fps, 1s per rotation)
- [ ] After API response, button returns to normal state
- [ ] Button text returns to "Save"
- [ ] Button re-enabled after completion

**Network Throttling Test**:
- DevTools → Network → Slow 3G
- Click save → observe extended loading state
- Verify spinner remains visible entire duration

---

### Test 3.2: Multiple Buttons
**Expected**: Only clicked button shows loading state, others remain normal

**Steps**:
1. If page has multiple save buttons, click one
2. Observe other buttons remain enabled

**Validations**:
- [ ] Only clicked button shows spinner
- [ ] Other buttons remain in normal state
- [ ] Other buttons remain clickable (if independent operations)
- [ ] No global loading overlay blocks entire page

---

## Part 4: Database Persistence

### Test 4.1: Theme Save to Database
**Expected**: Theme data persists after save, no clipboard involved

**Steps**:
1. Create or modify a theme in admin interface
2. Fill in required fields (name, description, tags, etc.)
3. Click "Save" button
4. Reload page (`Ctrl+R` or `Cmd+R`)
5. Navigate back to theme list/editor

**Validations**:
- [ ] NO "Save to Clipboard" button visible
- [ ] "Save" button triggers database save (not clipboard)
- [ ] Success toast appears after save
- [ ] After reload, saved theme appears in list
- [ ] After reload, theme data is preserved (not lost)
- [ ] Database contains theme record (check via API or DB query)

**Database Verification**:
```bash
# Check D1 database
wrangler d1 execute voygent-prod --local --command="SELECT * FROM themes ORDER BY created_at DESC LIMIT 5;"
```

---

### Test 4.2: Agent Privilege Save
**Expected**: Agent privilege changes persist to database

**Steps**:
1. Grant or revoke travel agent privilege for a user
2. Click "Save" or equivalent button
3. Reload page
4. Check user's agent status

**Validations**:
- [ ] Save operation calls `/api/admin/agents` endpoint (check Network tab)
- [ ] Success toast confirms save
- [ ] After reload, agent privilege status matches saved state
- [ ] Database reflects change (users.is_agent column updated)

---

### Test 4.3: Error Handling with Retry
**Expected**: Failed save preserves form data, allows retry

**Steps**:
1. Fill in a form with valid data
2. Simulate network failure (DevTools → Network → Offline)
3. Click "Save"
4. Observe error toast
5. Re-enable network
6. Click "Save" again

**Validations**:
- [ ] Error toast appears with clear message
- [ ] Form data NOT cleared after error
- [ ] All input fields retain entered values
- [ ] User can edit and retry without re-entering all data
- [ ] After network restored, save succeeds
- [ ] Success toast appears on retry

---

## Part 5: Responsive Design

### Test 5.1: Mobile View (375px width)
**Expected**: Layout adapts to narrow screens

**Steps**:
1. Open DevTools → Responsive Design Mode
2. Set viewport to 375px × 667px (iPhone SE)
3. Navigate through admin interface

**Validations**:
- [ ] No horizontal scrolling required
- [ ] Text remains readable (not too small)
- [ ] Buttons are tappable (minimum 44px touch target)
- [ ] Toast notifications visible and readable
- [ ] Forms stack vertically (not side-by-side)
- [ ] No content cut off or hidden

---

### Test 5.2: Tablet View (768px width)
**Expected**: Layout uses available space efficiently

**Steps**:
1. Set viewport to 768px × 1024px (iPad)
2. Navigate through admin interface

**Validations**:
- [ ] Container uses appropriate width (not too narrow)
- [ ] Cards/sections well-proportioned
- [ ] Two-column layouts work (if applicable)
- [ ] Toast notifications positioned correctly

---

### Test 5.3: Desktop View (1920px width)
**Expected**: Content centered, not stretched

**Steps**:
1. Set viewport to 1920px × 1080px (Full HD)
2. Navigate through admin interface

**Validations**:
- [ ] Container max-width enforced (1000px)
- [ ] Content centered horizontally
- [ ] Wide whitespace on sides (not wasted)
- [ ] No elements stretched to full viewport width

---

## Part 6: Cross-Browser Testing

### Test 6.1: Chrome/Edge (Chromium)
**Expected**: All features work as designed

**Validations**:
- [ ] Colors render correctly
- [ ] Toast animations smooth
- [ ] Button spinners rotate properly
- [ ] No console errors

---

### Test 6.2: Firefox
**Expected**: Consistent behavior with Chrome

**Validations**:
- [ ] Colors match Chrome
- [ ] CSS animations work (toast, spinner)
- [ ] No Firefox-specific rendering issues
- [ ] No console warnings/errors

---

### Test 6.3: Safari
**Expected**: Webkit-specific CSS works

**Validations**:
- [ ] Colors render correctly (no color space issues)
- [ ] Animations perform smoothly
- [ ] Border radius renders correctly
- [ ] No Safari-specific bugs

---

## Part 7: Accessibility Testing

### Test 7.1: Keyboard Navigation
**Expected**: All interactive elements accessible via keyboard

**Steps**:
1. Use Tab key to navigate through admin interface
2. Use Enter/Space to activate buttons
3. Use Escape to dismiss toasts (if supported)

**Validations**:
- [ ] All buttons focusable via Tab key
- [ ] Focus indicator visible (blue outline or equivalent)
- [ ] Enter/Space activates focused button
- [ ] Toast close button keyboard-accessible
- [ ] No keyboard traps (can Tab through entire page)

---

### Test 7.2: Screen Reader
**Expected**: Screen reader announces content clearly

**Tools**: NVDA (Windows), JAWS (Windows), VoiceOver (Mac)

**Validations**:
- [ ] Headings announced with proper hierarchy
- [ ] Form labels associated with inputs
- [ ] Button purposes clear ("Save theme", not just "Save")
- [ ] Toast messages announced when appearing
- [ ] Error messages announced clearly
- [ ] Loading states announced ("Saving...")

---

## Success Criteria

All tests pass (checkboxes marked):

### Visual Design
- [ ] New color palette applied (grayscale + blue)
- [ ] Layout improved (1000px max-width, 24px padding)
- [ ] Typography clear and hierarchical
- [ ] WCAG AA contrast compliance

### Toast Notifications
- [ ] Success toast works (green, 3s auto-dismiss)
- [ ] Error toast works (red, 5s auto-dismiss)
- [ ] Multiple toasts stack correctly (max 3)

### Loading States
- [ ] Button spinners appear during save
- [ ] Buttons disabled during loading
- [ ] Loading state clears after completion

### Database Persistence
- [ ] "Save to clipboard" removed
- [ ] Direct database saves work
- [ ] Data persists after page reload
- [ ] Error handling preserves form data

### Responsive Design
- [ ] Mobile view functional (375px)
- [ ] Tablet view functional (768px)
- [ ] Desktop view functional (1920px)

### Cross-Browser
- [ ] Works in Chrome/Edge
- [ ] Works in Firefox
- [ ] Works in Safari

### Accessibility
- [ ] Keyboard navigation works
- [ ] Screen reader compatible

---

## Rollback

If critical issues found:

```bash
# Revert CSS changes
git checkout HEAD -- public/admin.html

# Restart dev server
npm run dev
```

---

**Next Step**: Run `/tasks` command to generate implementation tasks from this design
