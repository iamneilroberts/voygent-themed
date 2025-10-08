# A/B Comparison Deprecation Guide

## Overview

The A/B comparison feature (`PATCH /api/trips/:id/ab`) has been deprecated as of **2025-10-08** and will be completely removed on **2025-11-08**.

This feature is being replaced by the more flexible template-driven options workflow.

---

## Why Deprecate?

1. **Limited Flexibility**: A/B comparison only generated 2 variants, limiting user choice
2. **Hard-Coded Logic**: Variant generation was hard-coded, not configurable
3. **No Research Integration**: A/B didn't support the research-first workflow
4. **Template System**: New template system provides unlimited options (1-10), configurable prompts
5. **Better UX**: Research-first approach provides more context before options

---

## Migration Path

### Old Workflow (Deprecated)
```
1. POST /api/trips (create trip)
2. Wait for options_ready
3. PATCH /api/trips/:id/ab (generate A/B variants)
4. Present variantA and variantB to user
```

### New Workflow (Template-Driven)
```
1. POST /api/trips (create trip with research)
2. GET /api/trips/:id/research (show research to user)
3. PATCH /api/trips/:id/research (mark research viewed)
4. POST /api/trips/:id/options (generate N options based on template)
5. Present all options to user
```

---

## Code Changes Required

### Backend API Calls

**Before** (Deprecated):
```javascript
// Generate A/B variants
const response = await fetch(`/api/trips/${tripId}/ab`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    transport: 'flights',
    luxury: 'comfort',
    activity: 'moderate'
  })
});

const { variantA, variantB } = await response.json();
```

**After** (Template-Driven):
```javascript
// 1. Show research to user
const researchResponse = await fetch(`/api/trips/${tripId}/research`);
const { researchSummary } = await researchResponse.json();

// Display researchSummary to user...

// 2. Mark research as viewed (required gate)
await fetch(`/api/trips/${tripId}/research`, {
  method: 'PATCH'
});

// 3. Generate options
const optionsResponse = await fetch(`/api/trips/${tripId}/options`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    preferences: {
      luxuryLevel: 'comfort',
      activityLevel: 'moderate',
      transport: 'flights',
      days: 7
    }
  })
});

const { options } = await optionsResponse.json();
// options is an array of 1-10 trip options (configurable per template)
```

### Frontend UI Changes

**Before** (A/B Comparison):
```html
<div class="variant-selector">
  <button onclick="selectVariant('A')">
    <h3>Option A: {variantA.title}</h3>
    <p>{variantA.description}</p>
    <span>${variantA.total_estimate}</span>
  </button>
  <button onclick="selectVariant('B')">
    <h3>Option B: {variantB.title}</h3>
    <p>{variantB.description}</p>
    <span>${variantB.total_estimate}</span>
  </button>
</div>
```

**After** (Template Options):
```html
<!-- 1. Research Summary Section -->
<div class="research-section">
  <h2>Research Summary</h2>
  <div id="research-content">{researchSummary}</div>
  <button onclick="acknowledgeResearch()">
    I've reviewed the research, show me options
  </button>
</div>

<!-- 2. Options Grid (shown after research acknowledged) -->
<div class="options-grid" style="display: none;">
  {options.map(option => `
    <div class="option-card" onclick="selectOption('${option.id}')">
      <h3>${option.title}</h3>
      <p>${option.description}</p>
      <ul>
        ${option.highlights.map(h => `<li>${h}</li>`).join('')}
      </ul>
      <div class="pricing">
        <span class="estimate">Est. $${option.estimatedPrice}</span>
        <small>Final quote by agent</small>
      </div>
    </div>
  `).join('')}
</div>
```

---

## Database Changes

### Deprecated Column

The `variants_json` column in `themed_trips` table will be removed after 30 days:

```sql
-- Currently exists but deprecated
variants_json TEXT DEFAULT NULL

-- Will be removed in Migration 023 after 2025-11-08
```

**Action Required**: If you have any external systems reading `variants_json`, update them to use the new options workflow.

---

## Monitoring Usage

### Check if A/B endpoint is still being called:

```bash
# Run the monitoring script
./scripts/monitor-ab-usage.sh
```

This script checks logs for deprecated A/B endpoint calls and reports:
- Daily call count
- Unique trips using A/B
- Last call timestamp

### Manual Query

```sql
SELECT
  DATE(timestamp) as date,
  COUNT(*) as calls,
  COUNT(DISTINCT correlation_id) as unique_trips
FROM logs
WHERE message LIKE '%DEPRECATED: A/B endpoint%'
GROUP BY DATE(timestamp)
ORDER BY date DESC;
```

---

## Timeline

| Date | Action |
|------|--------|
| **2025-10-08** | A/B endpoint deprecated, returns 410 Gone |
| **2025-10-08 - 2025-11-08** | 30-day grace period, monitor usage |
| **2025-11-08** | If usage = 0, delete `/api/trips/[id]/ab.ts` |
| **2025-11-08** | Run Migration 023 to drop `variants_json` column |

---

## Benefits of New System

1. **Configurable Options**: Templates can generate 1-10 options (not just 2)
2. **Research-First**: Users see research context before options
3. **Template-Driven**: Admins can customize prompts, verbiage, workflow
4. **Better Tracking**: All options tracked for handoff documents
5. **Margin Control**: Template-configurable margins (10-25%)
6. **Diagnostics**: Full logging and monitoring integration

---

## Support

If you encounter issues migrating from A/B comparison:

1. Review the template-driven workflow in `specs/011-transform-voygent-to/spec.md`
2. Check API contract in `specs/011-transform-voygent-to/contracts/research-workflow.openapi.yml`
3. See implementation examples in `specs/011-transform-voygent-to/quickstart.md`
4. For questions, create an issue with tag `migration-ab-to-templates`

---

## Testing the New Workflow

```bash
# 1. Create trip
TRIP_ID=$(curl -X POST http://localhost:8788/api/trips \
  -F "text=I want to explore Scottish heritage" \
  -F "theme=heritage" | jq -r '.tripId')

# 2. Get research
curl http://localhost:8788/api/trips/$TRIP_ID/research

# 3. Mark research viewed
curl -X PATCH http://localhost:8788/api/trips/$TRIP_ID/research

# 4. Generate options
curl -X POST http://localhost:8788/api/trips/$TRIP_ID/options \
  -H "Content-Type: application/json" \
  -d '{"preferences": {"luxuryLevel": "comfort", "days": 7}}'
```

---

## Rollback Plan

If critical issues arise during the deprecation period:

1. Revert `functions/api/trips/[id]/ab.ts` to original implementation
2. Remove deprecation warnings
3. Update timeline
4. Communicate extension to stakeholders

However, this is **not recommended** as the new system is more robust and flexible.
