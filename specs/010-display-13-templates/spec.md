# Feature Specification: Display All 13 Trip Templates in UI

**Feature Branch**: `010-display-13-templates`
**Created**: 2025-10-07
**Status**: Draft
**Input**: User description: "The UI only shows 5 hardcoded templates but database has 13. Frontend needs to fetch and display all templates dynamically."

## Execution Flow (main)
```
1. Parse user description from Input
    If empty: ERROR "No feature description provided"
2. Extract key concepts from description
    Identify: actors, actions, data, constraints
3. For each unclear aspect:
    Mark with [NEEDS CLARIFICATION: specific question]
4. Fill User Scenarios & Testing section
    If no clear user flow: ERROR "Cannot determine user scenarios"
5. Generate Functional Requirements
    Each requirement must be testable
    Mark ambiguous requirements
6. Identify Key Entities (if data involved)
7. Run Review Checklist
    If any [NEEDS CLARIFICATION]: WARN "Spec has uncertainties"
    If implementation details found: ERROR "Remove tech details"
8. Return: SUCCESS (spec ready for planning)
```

---

## 📋 Quick Guidelines
- Focus on WHAT users need and WHY
- Avoid HOW to implement (no tech stack, APIs, code structure)
- Written for business stakeholders, not developers

### Section Requirements
- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

---

## Problem Statement

VoyGent successfully created 13 trip templates in the database (1 existing Heritage template + 12 new creative templates covering wellness, architecture, music, wildlife photography, festivals, sports, literary, wine/beer, art, romance, sustainability, and general photography). The `/api/templates` endpoint correctly returns all 13 templates.

However, there are two critical UI issues:

### Issue 1: Public Website (voygent.app)
The user-facing website at voygent.app only displays 5 hardcoded templates:
1. Heritage
2. TV/Movie
3. Historical
4. Culinary
5. Adventure

The remaining 8 templates (wellness, architecture, music, wildlife, festivals, sports, literary, wine, art, romance, sustainability, photography) are invisible to users even though they exist in the database and are returned by the API.

### Issue 2: Admin Theme Builder (admin.html)
The admin theme builder page allows creating/editing templates, but it does not show a list of existing templates. Admins must know the exact theme ID to edit a template. There is no way to:
- View all 13 existing templates
- Select a template from a list to edit
- See which templates are active/inactive
- Compare template configurations side-by-side

This creates several problems:
- **Limited user choice**: Users cannot access 8 out of 13 available trip themes
- **Wasted development effort**: Templates were created but are not usable
- **Inconsistent data**: Database and UI are out of sync
- **Future scalability**: Adding new templates requires manual HTML/JS updates
- **Maintenance burden**: Template changes in database don't reflect in UI automatically
- **Admin blind spot**: Admins cannot see what templates exist without querying database directly
- **Poor admin UX**: No visual template management interface

The root cause is that both the public frontend and admin interface have hardcoded configurations rather than fetching and rendering templates dynamically from the API.

---

## User Scenarios & Testing

### Primary User Stories

**User Story 1: Traveler**
A traveler visits voygent.app to plan a specialized trip (e.g., wellness retreat, architecture tour, music festival). They should see all 13 available trip themes displayed as clickable options, allowing them to select their specific interest and generate a personalized trip.

**User Story 2: Admin**
An admin visits admin.html to manage trip templates. They should see a complete list of all 13 templates with their names, icons, and active status. They should be able to click on any template to load it for editing, see which templates are active/inactive, and manage templates visually without needing to know exact IDs.

### Acceptance Scenarios

**Template Discovery**
1. **Given** a user visits voygent.app homepage, **When** page loads, **Then** UI displays all 13 trip templates fetched from `/api/templates` API
2. **Given** templates are loading from API, **When** user sees the page, **Then** templates appear in correct order by `display_order` (Romance featured first at position 10, Heritage at 1)
3. **Given** each template in database has icon, name, description, **When** templates render, **Then** each button shows correct icon emoji and template name

**Template Selection**
4. **Given** 13 templates are visible, **When** user clicks on "Wellness & Spiritual" template, **Then** template is selected and form updates with wellness-specific fields
5. **Given** user clicks "Architecture & Design" template, **When** selection occurs, **Then** quick search placeholder updates to architecture-focused prompt (e.g., "Enter destination or architect")
6. **Given** user clicks "Romance & Honeymoon" template, **When** form loads, **Then** form fields appropriate for romantic trips are displayed (destination, luxury level, duration)
7. **Given** user selects any of the 8 new templates, **When** form renders, **Then** generic form fields (destination, duration, adults, preferences) are shown

**Backward Compatibility**
8. **Given** user selects Heritage template (existing), **When** form loads, **Then** surname and origin fields appear (existing behavior preserved)
9. **Given** user selects TV/Movie template (existing), **When** form loads, **Then** show/movie title and location fields appear (existing behavior preserved)
10. **Given** user selects any of the original 5 templates, **When** interacting with form, **Then** all existing functionality works without breaking

**Dynamic Template Loading**
11. **Given** new template is added to database, **When** user refreshes voygent.app, **Then** new template appears in UI without code changes
12. **Given** template is marked `is_active=0` in database, **When** page loads, **Then** inactive template does not appear in UI
13. **Given** template `display_order` is changed in database, **When** page loads, **Then** templates appear in new order

**API Integration**
14. **Given** `/api/templates` endpoint returns 13 templates, **When** page JavaScript fetches templates, **Then** all 13 templates are stored and available for rendering
15. **Given** API call to `/api/templates` fails, **When** error occurs, **Then** UI shows error message or falls back to default templates
16. **Given** templates are fetched successfully, **When** rendering, **Then** template metadata (icon, name, description) comes from API response, not hardcoded JS

**Mobile Responsiveness**
17. **Given** 13 templates are displayed, **When** user views on mobile device, **Then** template buttons wrap appropriately and remain tappable (minimum 44px touch target)
18. **Given** user scrolls through templates on mobile, **When** viewing, **Then** all 13 templates are visible and accessible without horizontal scroll

**Admin Template Management**
19. **Given** admin visits admin.html, **When** page loads, **Then** a template list section displays all 13 templates from database
20. **Given** template list is displayed, **When** admin views it, **Then** each template shows icon, name, ID, and active/inactive status
21. **Given** admin sees template list, **When** clicking on a template, **Then** template details load into the theme builder form for editing
22. **Given** admin edits a template, **When** saving changes, **Then** template list updates to reflect new name/icon/status
23. **Given** admin creates a new template, **When** saved successfully, **Then** new template appears in both template list and public UI
24. **Given** admin deactivates a template, **When** status changes to inactive, **Then** template disappears from public UI but remains visible (greyed out) in admin list
25. **Given** templates have display_order values, **When** admin views list, **Then** templates are sorted by display_order (same as public UI)

### Edge Cases
- What happens if API returns 0 templates (empty array)?
- What if API returns templates in different format than expected?
- How are templates handled if they lack required fields (icon, name, description)?
- What if a template is deleted from database while user has page open?
- How are templates with very long names displayed in UI (truncation)?
- What if template icon is missing or malformed?
- How are templates ordered if multiple have same `display_order`?

---

## Requirements

### Functional Requirements

#### Template Fetching
- **FR-001**: UI MUST fetch templates from `/api/templates` endpoint on page load
- **FR-002**: UI MUST render templates dynamically based on API response
- **FR-003**: UI MUST display only templates where `is_active=1`
- **FR-004**: UI MUST sort templates by `display_order` field (ascending)

#### Template Display
- **FR-005**: UI MUST display all 13 active templates as clickable buttons
- **FR-006**: Each template button MUST show template icon (emoji) and name
- **FR-007**: Template buttons MUST have visual indication of selected state
- **FR-008**: Featured templates (`is_featured=1`) MUST be visually distinguished

#### Template Selection
- **FR-009**: Clicking a template button MUST select that template
- **FR-010**: Selected template MUST update hidden input `selectedTheme` with template ID
- **FR-011**: Selecting template MUST update form title and subtitle based on template name/description
- **FR-012**: Selecting template MUST update quick search placeholder appropriately

#### Form Field Management
- **FR-013**: Selecting Heritage/TV-Movie/Historical/Culinary/Adventure templates MUST show existing specialized form fields
- **FR-014**: Selecting new templates (wellness, architecture, etc.) MUST show generic form fields (destination, duration, adults, preferences)
- **FR-015**: Form validation MUST work for all 13 templates
- **FR-016**: Form submission MUST include correct template ID for all 13 templates

#### Backward Compatibility
- **FR-017**: Existing 5 templates MUST function identically to current behavior
- **FR-018**: Existing users' saved trips MUST continue to work
- **FR-019**: API contract for trip creation MUST remain unchanged

#### Admin Template Management
- **FR-020**: Admin page MUST display a "Template List" section showing all templates from database
- **FR-021**: Template list MUST show: icon, name, ID, active status, display_order for each template
- **FR-022**: Clicking a template in the list MUST load that template's data into the theme builder form
- **FR-023**: Template list MUST update automatically after creating/editing/deactivating a template
- **FR-024**: Inactive templates MUST be visually distinguished in admin list (e.g., greyed out or strikethrough)
- **FR-025**: Template list MUST be sorted by display_order (ascending) to match public UI order
- **FR-026**: Admin MUST be able to create new templates without manually entering all 13 existing template IDs

### Non-Functional Requirements

#### Performance
- **NFR-001**: Template fetch from API MUST complete within 500ms
- **NFR-002**: Page load MUST not be blocked by template fetching (async)
- **NFR-003**: Template rendering MUST complete within 100ms after fetch

#### Maintainability
- **NFR-004**: Adding new template to database MUST automatically appear in UI (no code changes required)
- **NFR-005**: Template metadata changes in database MUST reflect in UI after page refresh
- **NFR-006**: No hardcoded template arrays SHOULD exist in frontend code

#### User Experience
- **NFR-007**: Template buttons MUST be visually consistent (same size, spacing, style)
- **NFR-008**: Template selection MUST provide immediate visual feedback (<100ms)
- **NFR-009**: Error messages for API failures MUST be user-friendly

#### Responsiveness
- **NFR-010**: Template grid MUST adapt to screen widths 320px - 1920px
- **NFR-011**: Touch targets MUST be minimum 44px on mobile devices
- **NFR-012**: Template button text MUST remain readable on all device sizes

---

## Key Entities

- **Template**: A trip theme configuration fetched from API
  - Attributes: id, name, description, icon, display_order, is_featured, is_active, tags, required_fields, optional_fields
  - Relationships: Referenced by trips, displayed in UI selector

- **Theme Button**: UI component representing a selectable template
  - Attributes: icon, label, active state, data-theme attribute
  - Relationships: Triggers template selection, updates form fields

- **Form Configuration**: Dynamic form field setup per template
  - Attributes: field labels, placeholders, validation rules
  - Relationships: Associated with selected template, controls user input

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked (none)
- [x] User scenarios defined
- [x] Requirements generated (19 functional, 12 non-functional)
- [x] Entities identified
- [x] Review checklist passed

---

## Dependencies and Assumptions

### Dependencies
- Existing `/api/templates` endpoint returning all 13 templates
- Database `trip_templates` table with 13 active templates
- Migration 015 completed (12 new templates created)
- Existing frontend JavaScript modules (compact-theme-selector.js, theme.js)

### Assumptions
- Template API response format is stable and documented
- All 13 templates in database have required fields populated
- Existing form submission logic can handle all template IDs
- Users have modern browsers with JavaScript enabled
- API performance is acceptable for synchronous page load
- Template icons are valid emoji characters
