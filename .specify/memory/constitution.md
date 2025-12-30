<!--
Sync Impact Report:
- Version: none → 1.0.0 (MINOR - initial constitution)
- Modified principles: N/A (initial version)
- Added sections: All sections (initial creation)
- Removed sections: N/A
- Templates requiring updates:
  ✅ .specify/templates/spec-template.md - reviewed, no updates needed
  ✅ .specify/templates/plan-template.md - reviewed, constitution check section aligns
  ✅ .specify/templates/tasks-template.md - reviewed, no updates needed
  ✅ .specify/templates/checklist-template.md - no review needed
  ✅ .specify/templates/agent-file-template.md - no review needed
  ✅ .claude/commands/*.md - reviewed, agent-neutral references maintained
- Follow-up TODOs: None
-->

# VoyGent V3 Constitution

## Core Principles

### I. Template-Driven Architecture (NON-NEGOTIABLE)

ALL trip logic, prompts, UI text, and behavioral rules MUST come from database templates stored in the `trip_templates` table. NO hardcoded theme-specific logic is permitted in JavaScript or TypeScript code.

**Rationale**: VoyGent V1 suffered from hardcoded heritage-specific logic that made it impossible to support multiple trip themes without code changes. V3 eliminates this technical debt by making all behavior data-driven, enabling infinite trip themes without touching code.

**Enforcement**:
- Code reviews MUST reject any hardcoded trip logic (e.g., "if heritage then...")
- All theme-specific strings, prompts, criteria MUST be in `trip_templates` table
- Generic code reads from templates and executes template-defined behavior
- New themes can be added via database inserts only

### II. Two-Phase Conversational Workflow

Trip planning MUST follow a strict two-phase workflow:

**Phase 1 - Destination Research**: AI researches potential destinations using web search only, presents 2-4 recommendations to user in chat, and awaits user confirmation/refinement. NO booking API calls during this phase.

**Phase 2 - Trip Building**: ONLY after user confirms destinations, AI calls booking APIs (Amadeus flights/hotels, Viator tours) to build detailed itinerary options with accurate pricing.

**Rationale**: VoyGent V1 wasted expensive API calls by immediately searching flights/hotels before knowing if users liked the destinations. This separation reduces costs and improves user experience by letting users validate the plan before committing resources.

**Enforcement**:
- API integration layer MUST enforce phase gates (reject Amadeus calls if `destinations_confirmed = false`)
- Status tracking in `themed_trips.status` field required ('researching'|'awaiting_confirmation'|'building_trip')
- Progress messages MUST reflect current phase to user

### III. Chat-Based Conversational Interface

User interaction MUST be conversational chat, NOT form-based. Users describe their needs in natural language; AI responds with questions, recommendations, and options in chat format.

**Rationale**: Forms constrain user expression and force the system to predict all possible inputs. Chat allows flexibility, handles edge cases naturally, and creates engaging user experience aligned with modern AI interaction patterns.

**Requirements**:
- Full-page chat interface (user messages right, AI left)
- AI can display rich content: bullet lists, destination cards, pricing tables, suggested actions
- "Customize My Trip" preferences panel MUST be expanded by default (not collapsed)
- Mobile-responsive design

### IV. Two-Tier Progress Feedback

Progress feedback MUST be separated into two distinct tiers:

**User-Facing Progress**: Friendly, non-technical chat messages (e.g., "🔍 Researching destinations...", "✈️ Finding flights..."). MUST NOT include model names, token counts, costs, provider names, technical errors, or stack traces.

**Admin Diagnostic Telemetry**: Full technical logs with API call details, costs, tokens, timing, errors. ONLY visible when `user.role = 'admin'` AND `config.diagnostics_enabled = true`.

**Rationale**: End users don't care about technical details and are confused/concerned by seeing costs and errors. Admins need full transparency for debugging and cost optimization. Separation serves both audiences appropriately.

**Enforcement**:
- Logging layer MUST route messages to correct tier based on role check
- User-facing code MUST NOT log technical details to visible channels
- Admin telemetry MUST be behind authentication + feature flag

### V. API Cost Optimization

AI provider selection MUST prioritize cost efficiency while maintaining quality. Use cheapest viable models (Z.AI, OpenRouter) for trip generation to maximize margin.

**Target**: <$0.50 AI cost per trip on average

**Rationale**: Business model depends on travel agent commission split. High AI costs erode margins. Using cost-efficient providers (Z.AI llama-3.3-70b vs OpenAI GPT-4) can reduce costs 10-20x without quality loss for structured trip planning tasks.

**Requirements**:
- Provider selection logic with fallback chain (cheapest first)
- Cost tracking per trip in database
- Admin dashboard showing cost metrics per template/phase
- Prefer smaller models for simple tasks (destination extraction), larger models for creative synthesis

### VI. Mobile-First Responsive Design

All UI MUST be mobile-responsive and tested on mobile devices. Chat interface, preferences panel, itinerary display, and all interactive elements MUST work on phones.

**Rationale**: Travel planning often happens on mobile devices while users are commuting, browsing during downtime, or discussing with travel companions. Desktop-only design excludes a major usage context.

## Technical Constraints

### Technology Stack (NON-NEGOTIABLE)

**Platform**: Cloudflare Pages + Functions (serverless TypeScript)
**Database**: D1 (SQLite)
**Frontend**: Vanilla HTML/CSS/JavaScript (NO React, Vue, or other frameworks)
**Backend**: TypeScript in Cloudflare Functions
**APIs**: Amadeus (flights, hotels), Viator (tours), Serper/Tavily (web search)

**Rationale**: Cloudflare provides global edge deployment, D1 is cost-effective serverless SQLite, vanilla JS avoids framework complexity/bloat for a chat-heavy interface. Existing infrastructure is already on Cloudflare.

### Database Schema Rules

**Templates Table**: `trip_templates` defines all theme behavior
**Trips Table**: `themed_trips` stores conversation state, research results, confirmed destinations, and trip data
**Required Fields**:
- `chat_history` (JSON): Full conversation log
- `research_destinations` (JSON): Phase 1 research results
- `destinations_confirmed` (boolean): Phase gate
- `confirmed_destinations` (JSON): User-confirmed destination list
- `status`: Current state ('chat'|'researching'|'awaiting_confirmation'|'building_trip'|'options_ready')

**Rationale**: These fields enforce the two-phase workflow and enable conversation state tracking for resumption and debugging.

## Development Workflow

### Specification-First Development

1. ALL features MUST start with `/specify` to create a feature specification
2. Use `/plan` to generate implementation plan from spec
3. Use `/tasks` to generate actionable task list from plan
4. Implementation follows task list

**Rationale**: VoyGent V3 is a fresh rewrite. Specification workflow ensures design decisions are documented and reviewed before coding begins, preventing architectural drift.

### Backend Endpoints (Standard Structure)

**Required Endpoints**:
- `POST /api/trips` - Start conversation (create trip, store initial message)
- `POST /api/trips/:id/chat` - Send user message, get AI response
- `GET /api/trips/:id` - Get trip state (for progress polling)
- `GET /api/trips/:id/logs` - Stream logs (admin-only)
- `POST /api/trips/:id/confirm-destinations` - User confirms destinations → triggers Phase 2
- `POST /api/trips/:id/select` - User selects trip option
- `POST /api/trips/:id/handoff` - Generate handoff document for travel agent

**Rationale**: Standard endpoint structure ensures consistency and makes integration patterns clear. These endpoints map directly to the two-phase workflow requirements.

### No V1 Copy-Paste

DO NOT copy hardcoded trip logic from V1 (`/home/neil/dev/lite-voygent-claude`).

**Reference patterns only**:
- AI provider selection and fallback logic (`functions/api/lib/providers/`)
- Logging patterns (`functions/api/lib/logger.ts`)
- Cloudflare configuration structure (`wrangler.toml`)

**DO NOT copy**:
- `functions/api/trips/index.ts` - Contains hardcoded heritage logic V3 is designed to eliminate
- Form-based UI components
- Immediate API call patterns (V3 uses two-phase approach)

**Rationale**: V3 is a complete rewrite to fix V1's architectural problems. Copying V1 trip logic would reintroduce the exact technical debt this project eliminates.

## Governance

### Amendment Process

Constitution amendments MUST be:
1. Proposed with rationale and impact analysis
2. Version bumped semantically (MAJOR for breaking principle changes, MINOR for additions, PATCH for clarifications)
3. Synced across all dependent templates (spec-template.md, plan-template.md, tasks-template.md)
4. Committed with clear version history

### Compliance Review

All specifications, plans, and pull requests MUST verify compliance with:
- Template-driven architecture (no hardcoded theme logic)
- Two-phase workflow enforcement (phase gates)
- Progress feedback separation (user vs admin)
- Mobile responsiveness
- Cost optimization (provider selection, API usage)

### Exception Process

If a principle violation is required:
1. Document in "Complexity Tracking" section of plan.md
2. Provide specific justification (why needed)
3. Explain why compliant alternatives were rejected
4. Get explicit approval before implementation

**Version**: 1.0.0 | **Ratified**: 2025-10-09 | **Last Amended**: 2025-10-09
