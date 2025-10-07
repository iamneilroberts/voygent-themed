# Feature Specification: Fix Research Execution and Database Persistence

**Feature Branch**: `005-fix-research-not`
**Created**: 2025-10-07
**Status**: Draft
**Input**: User description: "fix research not being executed and saved to trips table."

## Execution Flow (main)
```
1. Parse user description from Input
   ’ If empty: ERROR "No feature description provided"
2. Extract key concepts from description
   ’ Identify: actors, actions, data, constraints
3. For each unclear aspect:
   ’ Mark with [NEEDS CLARIFICATION: specific question]
4. Fill User Scenarios & Testing section
   ’ If no clear user flow: ERROR "Cannot determine user scenarios"
5. Generate Functional Requirements
   ’ Each requirement must be testable
   ’ Mark ambiguous requirements
6. Identify Key Entities (if data involved)
7. Run Review Checklist
   ’ If any [NEEDS CLARIFICATION]: WARN "Spec has uncertainties"
   ’ If implementation details found: ERROR "Remove tech details"
8. Return: SUCCESS (spec ready for planning)
```

---

## ¡ Quick Guidelines
-  Focus on WHAT users need and WHY
- L Avoid HOW to implement (no tech stack, APIs, code structure)
- =e Written for business stakeholders, not developers

### Section Requirements
- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

---

## Problem Statement

Currently, when users generate trip options, research data is not being executed and/or persisted to the database. The diagnostics field in API responses returns `null`, meaning:
- Research steps are not visible to users
- Trip context and reasoning cannot be reviewed
- Historical research data is lost
- AI synthesis of surname origins, filming locations, or other theme-specific research is not accessible

This prevents users from understanding how the trip was personalized and limits transparency in the trip generation process.

---

## User Scenarios & Testing

### Primary User Story
A traveler submits a heritage trip request with the surname "Williams" and destination "Scotland". After trip generation completes, they want to review the research findings that explain where the Williams surname originated, what heritage sites were identified, and why specific destinations were recommended. This research context should be visible in the UI and preserved in the database for future reference.

### Acceptance Scenarios
1. **Given** a user submits a heritage trip request with a surname, **When** trip generation runs, **Then** web search research is executed to find surname origins and heritage sites
2. **Given** research is executed during trip generation, **When** the trip is saved to the database, **Then** research steps and findings are stored in the `diagnostics` field
3. **Given** a trip with research data exists, **When** retrieving the trip via API (`GET /api/trips/{id}`), **Then** the response includes `diagnostics.research` with all research steps
4. **Given** research findings are available, **When** displayed in the UI, **Then** users see a summary of heritage origins, recommended sites, and AI reasoning
5. **Given** trip generation fails during research, **When** the error occurs, **Then** partial research results are still saved and error details are logged
6. **Given** a TV/Movie theme trip, **When** research executes, **Then** filming locations and visitor information are researched and saved
7. **Given** a historical theme trip, **When** research executes, **Then** historical sites, museums, and monuments are researched and saved

### Edge Cases
- What happens if web search returns no results for a surname?
- How should the system handle research timeouts?
- What if AI synthesis fails to extract meaningful insights?
- Should research be re-executed if a user regenerates trip options?
- How much research data should be stored (full results vs. summary)?
- What happens if the database save fails but trip generation succeeds?

---

## Requirements

### Functional Requirements
- **FR-001**: System MUST execute theme-specific research during trip generation for all trip themes (heritage, tvmovie, historical, culinary, adventure)
- **FR-002**: System MUST use template-specific `researchQueryTemplate` and `researchSynthesisPrompt` when performing research
- **FR-003**: System MUST persist research results to the database `diagnostics` field when saving trips
- **FR-004**: System MUST return research data in the `diagnostics.research` field when retrieving trips via API
- **FR-005**: Users MUST be able to view research findings in the trip details UI
- **FR-006**: System MUST handle research failures gracefully without blocking trip generation
- **FR-007**: System MUST log research execution status (started, completed, failed) for debugging
- **FR-008**: Research data MUST include: search query, web results, AI synthesis, and timestamp

### Data Requirements
- **DR-001**: `themed_trips` table MUST have a `diagnostics` field capable of storing JSON research data
- **DR-002**: Research data structure MUST include: `step` (research type), `query` (search terms), `results` (findings), `analysis` (AI synthesis), `timestamp`
- **DR-003**: Diagnostics data MUST be retrievable via GET requests without performance degradation

### Non-Functional Requirements
- **NFR-001**: Research execution MUST complete within reasonable time limits (e.g., 30 seconds max)
- **NFR-002**: Research failures MUST NOT prevent trip options from being generated
- **NFR-003**: System MUST handle concurrent research requests for multiple trips

---

## Key Entities

- **Trip**: Represents a generated trip with options, itinerary, and metadata
  - Attributes: id, theme, intake data, options, selected option, diagnostics (research data)
  - Relationships: Created by user research input, contains multiple options

- **Research Step**: Represents a single research operation during trip generation
  - Attributes: step type (surname research, location research, etc.), query used, results found, AI analysis, timestamp
  - Relationships: Part of trip diagnostics, references specific template research configuration

- **Trip Template**: Defines research behavior for each theme
  - Attributes: researchQueryTemplate (how to construct search queries), researchSynthesisPrompt (how to analyze results)
  - Relationships: Used during research execution for theme-specific behavior

---

## Review & Acceptance Checklist

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

### Identified Clarifications Needed
- [NEEDS CLARIFICATION: Should research be cached to avoid redundant searches for similar requests?]
- [NEEDS CLARIFICATION: What level of detail should be shown in the UI - full research or summarized?]
- [NEEDS CLARIFICATION: Should users be able to manually trigger research re-execution?]
- [NEEDS CLARIFICATION: Should research data be exported/downloadable for user records?]

---

## Execution Status

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [ ] Review checklist passed (pending clarifications)

---

## Dependencies and Assumptions

### Dependencies
- Trip templates database must be populated with `researchQueryTemplate` and `researchSynthesisPrompt` for all themes (completed in previous feature)
- `themed_trips` table schema must support storing JSON diagnostics data
- Web search API integration must be functional
- AI synthesis (OpenAI/Anthropic) must be available for analyzing research results

### Assumptions
- Current trip generation code has placeholder for research but is not executing it
- Database schema already has a `diagnostics` column or it can be added
- Research execution is intended to be synchronous during trip generation
- Template-driven research configuration is the desired approach
