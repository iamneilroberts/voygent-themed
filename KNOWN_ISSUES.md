# Known Issues - Heritage Travel MVP

## Issue 1: LLM JSON Truncation During Trip Creation

### Problem
When creating trips via `POST /api/trips`, the LLM sometimes generates truncated JSON for the options, causing parsing errors and trip creation failures.

### Root Cause
**Location**: `functions/api/trips/index.ts` (lines 182-221)

```typescript
// Step 2: Generate options (<=4) with CHEAP model, hard cap 900 tokens
const optionsProvider = selectProvider(JSON.stringify(intakeJson).length / 4, env, 'cheap');
const optionsResponse = await callProvider(optionsProvider, {
  systemPrompt: OPTIONS_GENERATOR,
  userPrompt: JSON.stringify(intakeJson, null, 2),
  maxTokens: 900,  // ⚠️ HARD CAP - may truncate mid-JSON
  temperature: 0.7
});
```

**The Issue**:
1. **Token limit of 900** is set to control costs with "cheap" models (GPT-4o-mini, Claude Haiku)
2. When generating **4 detailed options** with 10 days each, the JSON often exceeds 900 tokens
3. The response gets **cut off mid-generation**, resulting in invalid JSON like:
   ```json
   {
     "options": [
       {
         "key": "A",
         "title": "Isle of Skye Heritage",
         "days": [
           { "d": 1, "city": "Edinburgh", "am": "Arrive", "pm": "Castle", "drive": "0h0"
   ```
   (Notice the missing closing braces and truncated string)

4. The parsing logic tries to extract JSON between first `{` and last `}`, but **there is no last `}`**
5. `JSON.parse()` throws: `Expected ',' or ']' after array element`

### Evidence from Test
```
Response: {
  "error":"Failed to parse options JSON",
  "details":"Expected ',' or ']' after array element in JSON at position 2714 (line 28 column 178)",
  "raw":"{\n  \"options\": [\n    {\n      \"key\": \"A\",\n      \"title\": \"Isle of Skye Heritage and Nature\",
       ...
       \"drive\": \"0h0"  <-- TRUNCATED HERE
}
```

### Why This Happens
- **10-day itineraries** × **4 options** × **detailed descriptions** = **~3000-4000 tokens**
- **900 token limit** is **insufficient** for comprehensive options
- The LLM doesn't know to stop early and wrap up the JSON cleanly

### Impact
- **High**: Trips cannot be created via the API
- **Affects**: All trip creation flows
- **Does NOT affect**: T034-T041 features (hotel selection, flight pricing, etc.)

### Potential Solutions

#### Option 1: Increase Token Limit (Quick Fix)
```typescript
maxTokens: 2500,  // Increased from 900
```
**Pros**: Simple, likely fixes most cases
**Cons**: Higher API costs, may still truncate for very complex trips

#### Option 2: Generate Fewer Options
```typescript
// Modify OPTIONS_GENERATOR prompt to request 2-3 options instead of 4
maxTokens: 1500,
```
**Pros**: Reduces token usage, faster generation
**Cons**: Less choice for users

#### Option 3: Streaming with Early Stop Detection
```typescript
// Use streaming API to detect when JSON is about to be truncated
// Stop generation when approaching token limit and close JSON properly
```
**Pros**: Prevents truncation completely
**Cons**: More complex implementation

#### Option 4: JSON Repair Library
```typescript
import { jsonrepair } from 'jsonrepair';

try {
  jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
  optionsJson = JSON.parse(jsonStr);
} catch (e) {
  // Attempt to repair truncated JSON
  const repaired = jsonrepair(jsonStr);
  optionsJson = JSON.parse(repaired);
}
```
**Pros**: Handles truncation gracefully
**Cons**: May produce incorrect/incomplete data

#### Option 5: Retry with Reduced Scope
```typescript
try {
  // First attempt with 4 options
} catch (parseError) {
  // Retry with prompt requesting only 2 options
  // Increase maxTokens to 1500
}
```
**Pros**: Balances quality and reliability
**Cons**: Slower on failures, uses more tokens

### Recommended Fix
**Combination of Options 1 + 5**:
1. Increase default `maxTokens` to **1800** (sufficient for most trips)
2. Add retry logic that requests **2 options** with `maxTokens: 2500` on failure
3. Add JSON repair as last resort fallback

### Code Changes Needed
```typescript
// functions/api/trips/index.ts

async function generateOptions(intakeJson: any, env: Env, attempt: number = 1) {
  const maxOptions = attempt === 1 ? 4 : 2;
  const maxTokens = attempt === 1 ? 1800 : 2500;

  const prompt = `${OPTIONS_GENERATOR}\n\nGenerate ${maxOptions} options.`;

  const optionsResponse = await callProvider(optionsProvider, {
    systemPrompt: prompt,
    userPrompt: JSON.stringify(intakeJson, null, 2),
    maxTokens,
    temperature: 0.7
  });

  try {
    // Existing parsing logic
    return JSON.parse(jsonStr);
  } catch (e) {
    if (attempt < 2) {
      // Retry with fewer options
      return generateOptions(intakeJson, env, 2);
    }

    // Last resort: try JSON repair
    try {
      const { jsonrepair } = await import('jsonrepair');
      const repaired = jsonrepair(jsonStr);
      return JSON.parse(repaired);
    } catch (repairError) {
      throw e; // Original error
    }
  }
}
```

---

## Issue 2: Trip Listing Endpoint Routing Mismatch

### Problem
Calling `GET /api/trips?userId=XXX` returns the HTML homepage instead of JSON trip data.

### Root Cause
**Cloudflare Pages routing** doesn't work the way expected for this endpoint structure.

**Current Structure**:
```
/functions/api/trips/
  index.ts          ← POST /api/trips (create trip)
  [id]/
    index.ts        ← GET /api/trips/:id (get single trip)
```

**What Happens**:
1. Request: `GET /api/trips?userId=test-user`
2. Cloudflare Pages routing sees no `[id]` parameter
3. Falls through to static file serving
4. Returns `/public/index.html` (the homepage)

**Why `/api/trips/[id]/index.ts` Doesn't Help**:
The code at line 17 tries to handle this:
```typescript
if (!params.id && userId) {
  // List trips for user
  const trips = await listTrips(env.DB, userId);
  return new Response(JSON.stringify({ trips }), ...
}
```

But `params.id` is **always populated** when the route matches `[id]` - even if it's empty, the route doesn't match. So this code **never executes**.

### Impact
- **Medium**: Cannot list trips via API
- **Workaround**: Access trips directly by ID if known
- **Does NOT affect**: Trip creation or T034-T041 features

### Solutions

#### Option 1: Add GET Handler to `/api/trips/index.ts` (Recommended)
```typescript
// functions/api/trips/index.ts

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');

  if (!userId) {
    return new Response(JSON.stringify({ error: 'userId parameter required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const trips = await listTrips(env.DB, userId);
  return new Response(JSON.stringify({ trips }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  // Existing POST handler
}
```

**Pros**: Clean, follows REST conventions
**Cons**: None

#### Option 2: Use Query String in Dynamic Route
Create `/functions/api/trips/list.ts`:
```typescript
export async function onRequestGet(context: { request: Request; env: Env }) {
  // GET /api/trips/list?userId=XXX
}
```

**Pros**: Works around routing limitation
**Cons**: Non-RESTful URL

#### Option 3: Use Different Base Path
```
GET /api/users/:userId/trips  ← List trips
GET /api/trips/:id            ← Get trip
```

**Pros**: More RESTful, avoids routing ambiguity
**Cons**: Requires restructuring endpoints

### Recommended Fix
**Option 1** - Add GET handler to `/api/trips/index.ts`:

```typescript
import { createTrip, updateTrip, saveMessage, listTrips } from '../lib/db';

// ... existing imports ...

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');

  if (!userId) {
    return new Response(JSON.stringify({
      error: 'Missing required parameter',
      details: 'userId query parameter is required'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const trips = await listTrips(env.DB, userId);
    return new Response(JSON.stringify({ trips }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      error: 'Failed to list trips',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  // ... existing POST handler unchanged ...
}
```

---

## Issue Summary

| Issue | Severity | Affects T034-T041? | Fix Complexity | Recommended Action |
|-------|----------|-------------------|----------------|-------------------|
| LLM JSON Truncation | High | No | Medium | Increase maxTokens + retry logic |
| Trip Listing Route | Medium | No | Low | Add GET handler to index.ts |

Both issues are **separate from the T034-T041 implementation** and do not affect the hotel selection, flight pricing, or cost estimate features that were just implemented.

---

## Testing After Fixes

### Test LLM Fix
```bash
./test-mcleod-trip.sh
# Should now successfully create trip with 4 options
```

### Test Listing Fix
```bash
curl "http://localhost:8788/api/trips?userId=test-user-mcleod" | jq
# Should return JSON with trips array
```

---

## Notes

- Both issues existed **before** the T034-T041 implementation
- The new features (hotel selection, flight pricing) are **working correctly**
- Provider endpoints tested and verified functional
- These issues should be fixed in a **separate PR/commit** from the T034-T041 work
