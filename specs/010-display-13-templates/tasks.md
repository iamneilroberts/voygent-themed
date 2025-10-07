# Implementation Tasks: Display All 13 Trip Templates

**Feature**: 010-display-13-templates
**Date**: 2025-10-07
**Status**: Ready for Implementation

---

## Task Organization

Tasks are organized by component and dependency order. Complete tasks sequentially within each phase.

---

## Phase 1: Template API Module (Foundation)

### T001: Create Template API Module
**File**: `public/js/template-api.js` (new)
**Estimated Time**: 30 minutes
**Dependencies**: None

**Subtasks**:
- [ ] Create new file `public/js/template-api.js`
- [ ] Implement `fetchTemplates()` function:
  ```javascript
  export async function fetchTemplates() {
    const response = await fetch('/api/templates');
    if (!response.ok) throw new Error('Failed to fetch templates');
    const data = await response.json();
    return data.templates || [];
  }
  ```
- [ ] Add in-memory caching:
  ```javascript
  let cachedTemplates = null;
  export function getCachedTemplates() {
    return cachedTemplates;
  }
  export function setCachedTemplates(templates) {
    cachedTemplates = templates;
  }
  ```
- [ ] Add error handling and logging
- [ ] Export all functions

**Verification**:
- Open browser console
- Import and call `fetchTemplates()`
- Verify returns array of 13 templates
- Verify each template has: id, name, icon, description, displayOrder

---

## Phase 2: Public UI Updates

### T002: Update index.html - Replace Hardcoded Theme Buttons
**File**: `public/index.html`
**Estimated Time**: 15 minutes
**Dependencies**: None

**Subtasks**:
- [ ] Find hardcoded theme buttons (lines 959-978)
- [ ] Replace entire `.theme-selector-compact` div with:
  ```html
  <div id="themeLoading" style="text-align: center; padding: 20px; color: #666;">
    Loading templates...
  </div>
  <div id="themeButtonsContainer" class="theme-selector-compact" style="display: none;">
    <!-- Buttons will be dynamically inserted here -->
  </div>
  ```
- [ ] Keep existing CSS classes unchanged

**Verification**:
- View page source
- Confirm hardcoded buttons removed
- Confirm container divs present

---

### T003: Update compact-theme-selector.js - Add Dynamic Rendering
**File**: `public/js/compact-theme-selector.js`
**Estimated Time**: 45 minutes
**Dependencies**: T001

**Subtasks**:
- [ ] Import `fetchTemplates` from `template-api.js`
- [ ] Add `renderThemeButtons(templates)` function:
  ```javascript
  function renderThemeButtons(templates) {
    const container = document.getElementById('themeButtonsContainer');
    const loading = document.getElementById('themeLoading');

    // Sort by displayOrder
    const sorted = templates.sort((a, b) => a.displayOrder - b.displayOrder);

    // Generate HTML
    container.innerHTML = sorted.map(t => `
      <button type="button" class="theme-btn ${t.id === 'heritage' ? 'active' : ''}" data-theme="${t.id}">
        <span class="icon">${t.icon}</span>
        <span class="label">${t.name.replace(' & ', '/')}</span>
      </button>
    `).join('');

    // Show buttons, hide loading
    container.style.display = 'flex';
    loading.style.display = 'none';
  }
  ```
- [ ] Extend `THEME_DATA` with fetched templates:
  ```javascript
  function buildThemeData(templates) {
    const themeData = { ...THEME_DATA }; // Keep existing 5
    templates.forEach(t => {
      if (!themeData[t.id]) {
        themeData[t.id] = {
          title: `${t.name} Trip`,
          subtitle: t.description,
          placeholder: `Enter destination or ${t.name.toLowerCase()} interest`
        };
      }
    });
    return themeData;
  }
  ```
- [ ] Update `initCompactThemeSelector()` to:
  ```javascript
  export async function initCompactThemeSelector() {
    try {
      const templates = await fetchTemplates();
      THEME_DATA = buildThemeData(templates);
      renderThemeButtons(templates);

      // Existing event handler logic here
      const themeButtons = document.querySelectorAll('.theme-btn');
      // ... rest of code
    } catch (error) {
      console.error('Failed to load templates:', error);
      document.getElementById('themeLoading').textContent = 'Failed to load templates. Please refresh.';
    }
  }
  ```

**Verification**:
- Load voygent.app
- Confirm "Loading templates..." appears briefly
- Confirm 13 theme buttons render
- Confirm buttons sorted by displayOrder
- Click each button → Verify selection works

---

### T004: Update theme.js - Add Generic Form Fields
**File**: `public/js/theme.js`
**Estimated Time**: 30 minutes
**Dependencies**: None

**Subtasks**:
- [ ] Add generic form field configuration:
  ```javascript
  const GENERIC_FORM_FIELDS = {
    field1: { label: 'Destination or Location *', placeholder: 'e.g., Bali, Barcelona, Iceland' },
    field2: { label: 'Specific Interests or Preferences', placeholder: 'e.g., beginner-friendly, luxury, budget' }
  };
  ```
- [ ] Update `updateFormFieldsForTheme(theme)` function:
  ```javascript
  export function updateFormFieldsForTheme(theme) {
    const fields = THEME_FORM_FIELDS[theme] || GENERIC_FORM_FIELDS;

    // Update field 1
    document.getElementById('field1Label').textContent = fields.field1.label;
    document.getElementById('surnames').placeholder = fields.field1.placeholder;
    document.getElementById('surnames').value = '';

    // Update field 2
    document.getElementById('field2Label').textContent = fields.field2.label;
    document.getElementById('origins').placeholder = fields.field2.placeholder;
    document.getElementById('origins').value = '';
  }
  ```
- [ ] Add generic validation messages:
  ```javascript
  if (!VALIDATION_MESSAGES[theme]) {
    VALIDATION_MESSAGES[theme] = 'Please enter a destination or your travel interests';
  }
  ```

**Verification**:
- Select Heritage → Verify "Family Surnames *" label
- Select Wellness → Verify "Destination or Location *" label
- Select Architecture → Verify generic placeholder text
- Submit form without input → Verify validation message shows

---

### T005: Update main.js - Initialize Template Loading
**File**: `public/js/main.js`
**Estimated Time**: 10 minutes
**Dependencies**: T003

**Subtasks**:
- [ ] Find where `initCompactThemeSelector()` is called
- [ ] Update to handle async:
  ```javascript
  document.addEventListener('DOMContentLoaded', async () => {
    await initCompactThemeSelector();
    // ... other initialization
  });
  ```
- [ ] Add error boundary if not present

**Verification**:
- Reload page multiple times
- Confirm no race conditions
- Confirm templates load before user can interact

---

## Phase 3: Admin UI Updates

### T006: Add Template List Section to admin.html
**File**: `public/admin.html`
**Estimated Time**: 30 minutes
**Dependencies**: None

**Subtasks**:
- [ ] Find line 312 (before "Theme Builder Form")
- [ ] Insert new section:
  ```html
  <!-- Existing Templates List -->
  <div class="admin-section">
    <h2>📋 Existing Templates</h2>
    <p style="color: #666; margin-bottom: 15px;">Click a template to edit it</p>
    <div id="templateLoading" style="text-align: center; padding: 20px; color: #666;">
      Loading templates...
    </div>
    <div id="templateList" class="template-list" style="display: none;">
      <!-- Dynamically populated -->
    </div>
  </div>
  ```
- [ ] Add CSS before `</style>` tag:
  ```css
  .template-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 15px;
    margin-top: 15px;
  }
  .template-card {
    border: 2px solid #ddd;
    border-radius: 8px;
    padding: 15px;
    cursor: pointer;
    transition: all 0.2s;
    background: white;
  }
  .template-card:hover {
    border-color: #667eea;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
  }
  .template-card.selected {
    border-color: #667eea;
    background: #f0f4ff;
  }
  .template-card.inactive {
    opacity: 0.5;
    background: #f5f5f5;
  }
  .template-card .icon {
    font-size: 2.5rem;
    display: block;
    text-align: center;
    margin-bottom: 10px;
  }
  .template-card .name {
    font-weight: 600;
    font-size: 1rem;
    margin-bottom: 5px;
    text-align: center;
  }
  .template-card .id {
    font-size: 0.85rem;
    color: #666;
    text-align: center;
  }
  .template-card .status {
    font-size: 0.75rem;
    color: #999;
    text-align: center;
    margin-top: 5px;
  }
  ```

**Verification**:
- View admin.html
- Confirm "Existing Templates" section appears above theme builder form
- Confirm loading message displays
- Confirm CSS classes exist

---

### T007: Add fetchTemplates() Function to admin.html
**File**: `public/admin.html`
**Estimated Time**: 15 minutes
**Dependencies**: T006

**Subtasks**:
- [ ] Add function in `<script>` section:
  ```javascript
  async function fetchTemplates() {
    try {
      const response = await fetch('/api/templates');
      if (!response.ok) throw new Error('Failed to fetch templates');
      const data = await response.json();
      return data.templates || [];
    } catch (error) {
      console.error('Error fetching templates:', error);
      showToast('error', 'Failed to load templates');
      return [];
    }
  }
  ```

**Verification**:
- Open browser console on admin.html
- Call `fetchTemplates()`
- Confirm returns array of 13 templates

---

### T008: Add renderTemplateList() Function to admin.html
**File**: `public/admin.html`
**Estimated Time**: 30 minutes
**Dependencies**: T007

**Subtasks**:
- [ ] Add function:
  ```javascript
  function renderTemplateList(templates) {
    const container = document.getElementById('templateList');
    const loading = document.getElementById('templateLoading');

    // Sort by displayOrder
    const sorted = templates.sort((a, b) => a.displayOrder - b.displayOrder);

    // Generate HTML
    container.innerHTML = sorted.map(t => `
      <div class="template-card ${t.isActive ? '' : 'inactive'} ${selectedThemeId === t.id ? 'selected' : ''}"
           data-template-id="${t.id}"
           onclick="loadTemplateForEditing('${t.id}')">
        <div class="icon">${t.icon}</div>
        <div class="name">${t.name}</div>
        <div class="id">ID: ${t.id}</div>
        <div class="status">${t.isActive ? '✅ Active' : '❌ Inactive'}</div>
      </div>
    `).join('');

    // Show list, hide loading
    container.style.display = 'grid';
    loading.style.display = 'none';
  }
  ```

**Verification**:
- Reload admin.html
- Confirm 13 template cards display
- Confirm cards show icon, name, ID, status
- Confirm inactive templates greyed out

---

### T009: Add loadTemplateForEditing() Function to admin.html
**File**: `public/admin.html`
**Estimated Time**: 45 minutes
**Dependencies**: T008

**Subtasks**:
- [ ] Store templates globally:
  ```javascript
  let allTemplates = [];
  ```
- [ ] Update page load to cache templates:
  ```javascript
  document.addEventListener('DOMContentLoaded', async () => {
    allTemplates = await fetchTemplates();
    renderTemplateList(allTemplates);
  });
  ```
- [ ] Add `loadTemplateForEditing(templateId)` function:
  ```javascript
  async function loadTemplateForEditing(templateId) {
    const template = allTemplates.find(t => t.id === templateId);
    if (!template) {
      showToast('error', 'Template not found');
      return;
    }

    // Update selected state
    selectedThemeId = templateId;
    document.querySelectorAll('.template-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.templateId === templateId);
    });

    // Populate form
    document.getElementById('themeId').value = template.id;
    document.getElementById('themeName').value = template.name;
    document.getElementById('themeDescription').value = template.description;
    document.getElementById('themeIcon').value = template.icon;

    // Populate required fields
    requiredFields = JSON.parse(template.requiredFields || '[]');
    renderRequiredFields();

    // Populate optional fields
    optionalFields = JSON.parse(template.optionalFields || '[]');
    renderOptionalFields();

    // Populate example inputs
    const examples = JSON.parse(template.exampleInputs || '[]');
    document.getElementById('exampleInputs').value = examples.join('\n');

    // Populate prompts
    document.getElementById('intakePrompt').value = template.intakePrompt || '';
    document.getElementById('optionsPrompt').value = template.optionsPrompt || '';

    // Scroll to form
    document.querySelector('.admin-section h2').scrollIntoView({ behavior: 'smooth', block: 'start' });

    showToast('success', `Loaded template: ${template.name}`);
  }
  ```

**Verification**:
- Click on "Wellness & Spiritual" card
- Confirm form populates with wellness template data
- Confirm card highlights as selected
- Confirm page scrolls to form
- Click on "Heritage & Ancestry" card
- Confirm form updates to heritage data

---

### T010: Update saveTheme() to Refresh Template List
**File**: `public/admin.html`
**Estimated Time**: 15 minutes
**Dependencies**: T009

**Subtasks**:
- [ ] Find `saveTheme()` function
- [ ] After successful save, add:
  ```javascript
  // Refresh template list
  allTemplates = await fetchTemplates();
  renderTemplateList(allTemplates);
  ```
- [ ] Update success toast message to include template name

**Verification**:
- Load template, edit name, save
- Confirm template list updates immediately
- Confirm new name appears in card
- Create new template
- Confirm appears in list after save

---

## Phase 4: Testing & Verification

### T011: Manual Testing - Public UI
**Estimated Time**: 30 minutes
**Dependencies**: All Phase 2 tasks

**Test Cases**:
- [ ] **TC-001**: Load voygent.app → Verify 13 templates display
- [ ] **TC-002**: Click Heritage → Verify surname fields
- [ ] **TC-003**: Click Wellness → Verify generic destination field
- [ ] **TC-004**: Click all 13 templates → Verify each selects
- [ ] **TC-005**: Select Romance → Fill form → Generate trip → Verify template ID in request
- [ ] **TC-006**: Test on mobile (iPhone viewport) → Verify buttons wrap
- [ ] **TC-007**: Test on desktop (1920px) → Verify layout
- [ ] **TC-008**: Simulate API failure → Verify error message
- [ ] **TC-009**: Check browser console → Verify no errors

**Pass Criteria**: All test cases pass

---

### T012: Manual Testing - Admin UI
**Estimated Time**: 30 minutes
**Dependencies**: All Phase 3 tasks

**Test Cases**:
- [ ] **TC-010**: Load admin.html → Verify template list displays
- [ ] **TC-011**: Verify 13 templates shown in correct order
- [ ] **TC-012**: Click Wellness card → Verify form loads data
- [ ] **TC-013**: Click Heritage card → Verify form updates
- [ ] **TC-014**: Edit Architecture template → Change icon → Save → Verify list updates
- [ ] **TC-015**: Create new template → Verify appears in list
- [ ] **TC-016**: Deactivate template → Verify greyed out in list
- [ ] **TC-017**: Deactivated template → Verify hidden from public UI
- [ ] **TC-018**: Re-activate template → Verify visible in public UI

**Pass Criteria**: All test cases pass

---

### T013: Cross-Browser Testing
**Estimated Time**: 20 minutes
**Dependencies**: T011, T012

**Browsers**:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

**Test Actions**:
- Load public UI
- Select 3 different templates
- Load admin UI
- Click 3 different template cards

**Pass Criteria**: Consistent behavior across all browsers

---

### T014: Performance Testing
**Estimated Time**: 15 minutes
**Dependencies**: T011, T012

**Metrics**:
- [ ] Measure: Time to first template display (should be < 500ms)
- [ ] Measure: Template button click response (should be < 100ms)
- [ ] Measure: Page load time increase (should be < 100ms vs before)
- [ ] Check: Network tab → Verify API called once per page load
- [ ] Check: Console → Verify no memory leaks after multiple template selections

**Pass Criteria**: All metrics within acceptable ranges

---

## Phase 5: Documentation & Cleanup

### T015: Update Documentation
**Estimated Time**: 20 minutes
**Dependencies**: All previous tasks

**Files to Update**:
- [ ] Update `DATABASE_SCHEMA.md` if any schema changes
- [ ] Update `README.md` if API contract changed
- [ ] Add comment in `template-api.js` explaining caching strategy
- [ ] Add JSDoc comments to new functions

**Verification**:
- Documentation matches implementation
- API contracts documented
- Function signatures documented

---

### T016: Code Cleanup
**Estimated Time**: 15 minutes
**Dependencies**: T015

**Actions**:
- [ ] Remove any debug `console.log()` statements
- [ ] Remove commented-out code
- [ ] Verify consistent code style
- [ ] Check for unused variables
- [ ] Verify all error cases handled

**Verification**:
- No console warnings in browser
- Code passes ESLint (if configured)
- No unused imports

---

### T017: Create Deployment Checklist
**Estimated Time**: 10 minutes
**Dependencies**: All tasks

**Checklist Items**:
- [ ] All 13 templates in production database
- [ ] `/api/templates` endpoint tested in production
- [ ] All files committed to git
- [ ] Branch pushed to remote
- [ ] Cloudflare Pages deployment triggered
- [ ] Post-deployment smoke test completed

**Deliverable**: `DEPLOYMENT_CHECKLIST_010.md` file

---

## Summary

**Total Tasks**: 17
**Estimated Total Time**: 6-7 hours
**Critical Path**: T001 → T003 → T005 (Public UI) + T006 → T009 (Admin UI)

**Task Dependencies**:
```
T001 (Template API)
  ↓
T003 (Dynamic Buttons) → T005 (Init) → T011 (Test Public)
  ↓
T002 (HTML Update)
  ↓
T004 (Form Fields)

T006 (Admin HTML) → T007 (Fetch) → T008 (Render) → T009 (Load) → T010 (Save) → T012 (Test Admin)

T011 + T012 → T013 (Cross-browser) → T014 (Performance) → T015 (Docs) → T016 (Cleanup) → T017 (Deploy)
```

**Recommended Execution Order**:
1. Complete all Phase 1 tasks first (foundation)
2. Complete Phase 2 OR Phase 3 (either order works)
3. Complete Phase 4 (testing both)
4. Complete Phase 5 (documentation and deployment)
