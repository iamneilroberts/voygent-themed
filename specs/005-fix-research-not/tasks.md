# Tasks: Fix Research Execution and Database Persistence

**Input**: Design documents from `/home/neil/dev/lite-voygent-claude/specs/005-fix-research-not/`
**Prerequisites**: plan.md (complete), spec.md (complete)

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Extract: research execution flow, data structures, error handling
2. Generate tasks by category:
   → Setup: database verification and migration
   → Infrastructure: research execution functions
   → Integration: trip generation modifications
   → Testing: all 5 themes + error scenarios
   → Verification: frontend display
3. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Database setup before all implementation
4. Number tasks sequentially (T001, T002...)
5. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- Backend API: `functions/api/`
- Database: `migrations/`
- Frontend: `public/js/`
- All paths are absolute from repository root

## Phase 3.1: Database Setup
- [x] T001 Check if themed_trips table has diagnostics column via D1 query
- [x] T002 Create migration `migrations/011_add_diagnostics_column.sql` if diagnostics column is missing (ALTER TABLE themed_trips ADD COLUMN diagnostics TEXT DEFAULT NULL)
- [x] T003 Run migration if created in T002 using wrangler d1 execute

## Phase 3.2: Research Infrastructure
- [x] T004 [P] Create query interpolation function in `functions/api/lib/research-utils.ts` to replace {surname}, {title}, {event}, {cuisine}, {destination}, {activity} placeholders in researchQueryTemplate
- [x] T005 [P] Verify web search function in `functions/api/providers/search.ts` works with Tavily/Serper APIs (test with sample query)
- [x] T006 Create research execution function `executeResearch()` in `functions/api/lib/research-executor.ts` that orchestrates: query interpolation → web search → AI synthesis → format ResearchStep result

## Phase 3.3: Trip Generation Integration
- [x] T007 Modify `functions/api/trips/index.ts` to call executeResearch() after intake normalization (line ~100-150)
- [x] T008 Store research results in memory during trip generation flow in `functions/api/trips/index.ts`
- [x] T009 Modify database INSERT in `functions/api/trips/index.ts` to include diagnostics field with JSON.stringify({research: researchSteps})
- [x] T010 Modify API response in `functions/api/trips/index.ts` to include diagnostics field in returned trip object

## Phase 3.4: Error Handling & Resilience
- [x] T011 Add try/catch around research execution in `functions/api/trips/index.ts` with graceful degradation (empty research array on failure)
- [x] T012 Add console logging for research execution status in `functions/api/lib/research-executor.ts` (started, completed, failed with error details)

## Phase 3.5: Testing & Validation (All 5 Themes)
- [ ] T013 [P] Test heritage theme: Submit "Williams surname Scotland" trip request, verify research in database SELECT diagnostics FROM themed_trips WHERE id='XXX' and API GET /api/trips/XXX
- [ ] T014 [P] Test tvmovie theme: Submit "Game of Thrones filming locations" trip request, verify filming location research in database and API
- [ ] T015 [P] Test historical theme: Submit "D-Day historical sites France" trip request, verify historical research in database and API
- [ ] T016 [P] Test culinary theme: Submit "Italian cuisine Tuscany" trip request, verify restaurant research in database and API
- [ ] T017 [P] Test adventure theme: Submit "Patagonia hiking" trip request, verify activity research in database and API

## Phase 3.6: Frontend Verification
- [ ] T018 Verify displayResearchSummary function in `public/js/trips.js` correctly displays research data from API response (test with heritage trip from T013)

## Phase 3.7: Error Scenarios
- [ ] T019 Test research failure scenario: Temporarily disable web search API key, verify trip generation continues with empty research and error logged

## Dependencies
```
T001 (check schema) → T002 (create migration) → T003 (run migration)
T003 (database ready) blocks T007-T010 (trip integration)
T004, T005 (infrastructure) → T006 (research executor)
T006 (research executor) → T007 (call in trip generation)
T007-T012 (implementation complete) → T013-T019 (testing)
```

## Parallel Execution Examples

### Phase 3.2: Research Infrastructure (T004, T005 can run in parallel)
```bash
# Launch T004 and T005 together (different files):
Task: "Create query interpolation function in functions/api/lib/research-utils.ts"
Task: "Verify web search function in functions/api/providers/search.ts"
```

### Phase 3.5: Testing All Themes (T013-T017 can run in parallel after implementation)
```bash
# Launch T013-T017 together (independent test scenarios):
Task: "Test heritage theme: Williams surname Scotland"
Task: "Test tvmovie theme: Game of Thrones filming locations"
Task: "Test historical theme: D-Day historical sites France"
Task: "Test culinary theme: Italian cuisine Tuscany"
Task: "Test adventure theme: Patagonia hiking"
```

## Notes
- Database schema check (T001) MUST complete first to determine if migration is needed
- Research executor (T006) depends on query interpolation (T004) being complete
- All trip generation modifications (T007-T010) edit the same file (functions/api/trips/index.ts) so MUST run sequentially
- Testing tasks (T013-T017) can run in parallel since they test different scenarios with independent data
- Frontend verification (T018) should use real data from one of the theme tests (T013)

## Task Details

### T001: Check Database Schema
**File**: Database query (no file modification)
**Action**: Run `wrangler d1 execute voygent-themed --command "PRAGMA table_info(themed_trips);"` and check if "diagnostics" column exists in output
**Success Criteria**: Confirm presence or absence of diagnostics column

### T002: Create Migration (Conditional)
**File**: `migrations/011_add_diagnostics_column.sql` (create new)
**Action**: IF diagnostics column missing from T001, create migration file with:
```sql
-- Add diagnostics column to store research data as JSON
ALTER TABLE themed_trips ADD COLUMN diagnostics TEXT DEFAULT NULL;
```
**Success Criteria**: Migration file created with correct SQL

### T003: Run Migration (Conditional)
**File**: Database execution (no file modification)
**Action**: IF migration created in T002, run `wrangler d1 execute voygent-themed --file migrations/011_add_diagnostics_column.sql`
**Success Criteria**: Migration executes successfully, diagnostics column now exists

### T004: Query Interpolation Function
**File**: `functions/api/lib/research-utils.ts` (create new)
**Action**: Create function `interpolateResearchQuery(template: string, intakeJson: any): string` that:
1. Takes researchQueryTemplate string with placeholders: {surname}, {title}, {event}, {cuisine}, {destination}, {activity}, {region}
2. Replaces placeholders with values from intakeJson (e.g., {surname} → intakeJson.surnames[0])
3. Returns interpolated query string
**Success Criteria**: Function handles all 5 theme types correctly

### T005: Verify Web Search Function
**File**: `functions/api/providers/search.ts` (verify existing)
**Action**: Test existing web search function with sample query "Williams family heritage Scotland" and verify it returns results array with title, url, snippet fields
**Success Criteria**: Search function returns valid results structure

### T006: Research Execution Function
**File**: `functions/api/lib/research-executor.ts` (create new)
**Action**: Create async function `executeResearch(template: TripTemplate, intakeJson: any, env: any): Promise<ResearchStep[]>` that:
1. Checks if template.researchQueryTemplate exists (return [] if not)
2. Calls interpolateResearchQuery() to build search query
3. Calls web search function from providers/search.ts with query
4. Extracts top 3-5 results
5. Calls callProvider() with template.researchSynthesisPrompt + formatted results
6. Returns ResearchStep object: { step: string, query: string, results: [], analysis: string, timestamp: number }
7. Handles errors gracefully (return empty array on failure, log errors)
**Success Criteria**: Function successfully executes research flow end-to-end

### T007: Call Research in Trip Generation
**File**: `functions/api/trips/index.ts` (modify existing)
**Action**: After intake normalization (around line 100-150), add:
```typescript
// Execute research if template defines it
let researchSteps: ResearchStep[] = [];
if (template.researchQueryTemplate) {
  try {
    researchSteps = await executeResearch(template, intakeJson, env);
    console.log(`[Research] Completed ${researchSteps.length} steps`);
  } catch (error) {
    console.error('[Research] Failed:', error);
    // Continue with empty research
  }
}
```
**Success Criteria**: Research execution called at correct point in flow

### T008: Store Research Results
**File**: `functions/api/trips/index.ts` (modify existing)
**Action**: Keep researchSteps variable in scope through trip generation, to be used in T009 for database save
**Success Criteria**: Research data available for database save

### T009: Save Research to Database
**File**: `functions/api/trips/index.ts` (modify existing)
**Action**: Modify INSERT INTO themed_trips statement to include:
```typescript
const diagnostics = JSON.stringify({ research: researchSteps });
// Add diagnostics to INSERT columns and values
```
**Success Criteria**: Diagnostics field saved to database with research data

### T010: Return Research in API Response
**File**: `functions/api/trips/index.ts` (modify existing)
**Action**: Ensure API response includes diagnostics field when returning trip object (may need to parse JSON from database)
**Success Criteria**: GET /api/trips/{id} returns diagnostics.research in response

### T011: Add Error Handling
**File**: `functions/api/trips/index.ts` (modify existing - covered in T007)
**Action**: Verify try/catch block from T007 properly handles research failures without blocking trip generation
**Success Criteria**: Trip generation continues even if research fails

### T012: Add Logging
**File**: `functions/api/lib/research-executor.ts` (modify from T006)
**Action**: Add console.log statements for:
- Research started: `[Research] Starting for theme: ${template.id}, query: ${query}`
- Research completed: `[Research] Completed successfully, analysis length: ${analysis.length}`
- Research failed: `[Research] Failed: ${error.message}`
**Success Criteria**: Research execution status visible in logs

### T013-T017: Theme Testing Tasks
**Action**: For each theme:
1. Start dev server: `wrangler pages dev --local --port 8788 public`
2. Navigate to voygent interface, submit trip request with theme-specific input
3. Wait for trip generation to complete
4. Check database: `wrangler d1 execute voygent-themed --command "SELECT id, theme, diagnostics FROM themed_trips WHERE id='XXX';"`
5. Verify diagnostics field contains research data with query, results, analysis
6. Check API: `curl http://localhost:8788/api/trips/XXX | jq '.diagnostics.research'`
7. Verify API response includes research array with expected data
**Success Criteria**: Research data present in both database and API for each theme

### T018: Frontend Verification
**File**: `public/js/trips.js` (verify existing)
**Action**:
1. Open trip from T013 (heritage theme) in browser
2. Verify displayResearchSummary function renders research findings
3. Check that surname origins and heritage sites appear in UI
**Success Criteria**: Research summary visible in trip details page

### T019: Error Scenario Testing
**Action**:
1. Temporarily comment out TAVILY_API_KEY and SERPER_API_KEY in env
2. Submit new trip request
3. Verify trip generation completes without research data
4. Check logs for error message: `[Research] Failed: ...`
5. Verify diagnostics field is empty array: `{research: []}`
6. Restore API keys
**Success Criteria**: Graceful degradation confirmed, no crashes

## Implementation Summary

**Implementation Status**: Core implementation complete (T001-T012). Testing ready (T013-T019).

**What Was Changed**:
1. Added `diagnostics` column to `themed_trips` table via migration
2. Created `research-utils.ts` for template query interpolation
3. Created `research-executor.ts` for template-driven research execution
4. Replaced hard-coded theme-specific research with template-driven approach
5. Modified `functions/api/trips/index.ts` to call `executeResearch()` after intake normalization
6. Added diagnostics field to database INSERT and API response
7. Updated Trip interface in `db.ts` to include diagnostics field

**Files Modified**:
- `migrations/011_add_diagnostics_column.sql` (NEW)
- `functions/api/lib/research-utils.ts` (NEW)
- `functions/api/lib/research-executor.ts` (NEW)
- `functions/api/lib/db.ts` (updated Trip interface)
- `functions/api/trips/index.ts` (replaced ~260 lines of hardcoded research with 12 lines calling executeResearch)

**Key Improvements**:
- Research now driven by template configuration (`researchQueryTemplate` and `researchSynthesisPrompt`)
- Web search + AI synthesis consolidated into reusable executor function
- Research data properly saved to database `diagnostics` column
- Research data returned in API response `diagnostics.research` field
- Graceful error handling - research failures don't block trip generation

## Validation Checklist
*GATE: Checked before marking tasks complete*

- [x] Database schema verified/updated (T001-T003)
- [x] Research infrastructure complete (T004-T006)
- [x] Trip generation integration complete (T007-T010)
- [x] Error handling robust (T011-T012)
- [ ] All 5 themes tested (T013-T017) - Ready for manual testing
- [ ] Frontend verification complete (T018) - Ready for manual testing
- [ ] Error scenarios tested (T019) - Ready for manual testing
- [ ] Research data appears in database diagnostics column - TO VERIFY
- [ ] Research data returned in API responses - TO VERIFY
- [x] Research failures don't block trip generation - Code verified

## Constitution Compliance
- ✅ Critical path maintained: Intake → Options(<=4) → Select → A/B → Save Trip ID
- ✅ Cheap-first: Uses existing provider selection (gpt-4o-mini for synthesis)
- ✅ No inventory claims: Research findings are exploratory
- ✅ Reproducibility: Works identically in local dev and production

---
*Based on plan.md from `/home/neil/dev/lite-voygent-claude/specs/005-fix-research-not/plan.md`*
