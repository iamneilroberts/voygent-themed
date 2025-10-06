# Voygent Heritage MVP - Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                                 │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  public/index.html + app.js                                    │  │
│  │  • Quick Tuner Form (surnames, dates, preferences)             │  │
│  │  • Upload Area (files, drag-drop)                              │  │
│  │  • Options Grid (A/B/C/D cards)                                │  │
│  │  • Variants Display (side-by-side A/B)                         │  │
│  └───────────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTP/JSON
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   CLOUDFLARE PAGES + FUNCTIONS                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  functions/_middleware.ts (CORS)                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  API ENDPOINTS (functions/api/trips/)                          │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │  POST /api/trips                                         │  │  │
│  │  │  • Parse multipart (text + files + urls)                │  │  │
│  │  │  • OCR images → extractTextFromImage()                  │  │  │
│  │  │  • Call LLM: INTAKE_NORMALIZER (CHEAP, 1000 tok)        │  │  │
│  │  │  • Validate with intake.v1 schema (Ajv)                 │  │  │
│  │  │  • Call LLM: OPTIONS_GENERATOR (CHEAP, 900 tok)         │  │  │
│  │  │  • Save to D1: intake_json, options_json               │  │  │
│  │  │  • Return: { tripId, intake, options }                  │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │  GET /api/trips/:id                                      │  │  │
│  │  │  • Fetch from D1                                         │  │  │
│  │  │  • Parse JSON fields                                     │  │  │
│  │  │  • Return: { id, intake, options, itinerary, variants } │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │  PATCH /api/trips/:id/select                             │  │  │
│  │  │  • Get trip from D1                                      │  │  │
│  │  │  • Extract selected option (A/B/C/D)                     │  │  │
│  │  │  • Build itinerary draft                                 │  │  │
│  │  │  • Save itinerary_json, status='option_selected'        │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │  PATCH /api/trips/:id/ab                                 │  │  │
│  │  │  • Get trip + itinerary from D1                          │  │  │
│  │  │  • Build preferences object                              │  │  │
│  │  │  • Call LLM: OPTION_SELECTOR_TO_AB (SMART?, 900 tok)    │  │  │
│  │  │  • Parse variantA + variantB                             │  │  │
│  │  │  • Save variants_json, status='ab_ready'                │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  LIBRARY MODULES (functions/api/lib/)                         │  │
│  │  ┌─────────────┬─────────────┬─────────────┬──────────────┐  │  │
│  │  │ provider.ts │ schemas.ts  │ prompts.ts  │  db.ts       │  │  │
│  │  │ • select    │ • validate  │ • INTAKE_   │  • createTrip│  │  │
│  │  │   Provider  │   Intake()  │   NORMALIZER│  • getTrip   │  │  │
│  │  │ • call      │ • validate  │ • OPTIONS_  │  • updateTrip│  │  │
│  │  │   Provider  │   Option()  │   GENERATOR │  • saveMsg   │  │  │
│  │  │ • CHEAP vs  │ • validate  │ • SELECTOR_ │              │  │  │
│  │  │   SMART     │   Itinerary │   TO_AB     │              │  │  │
│  │  │ • token est │             │             │              │  │  │
│  │  └─────────────┴─────────────┴─────────────┴──────────────┘  │  │
│  │  ┌────────────────────────────────────────────────────────┐   │  │
│  │  │ ocr.ts                                                  │   │  │
│  │  │ • extractTextFromImage() via Tesseract.js             │   │  │
│  │  │ • isImageFile() detection                              │   │  │
│  │  └────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────┘  │
└──────────────┬────────────────────────────┬────────────────────────┘
               │                            │
               ▼                            ▼
┌──────────────────────────┐  ┌─────────────────────────────────────┐
│  CLOUDFLARE D1           │  │  LLM PROVIDERS                      │
│  (SQLite at edge)        │  │  ┌───────────────────────────────┐ │
│  ┌────────────────────┐  │  │  │  OpenAI                       │ │
│  │  trips             │  │  │  │  • gpt-4o-mini (CHEAP)        │ │
│  │  • id (PK)         │  │  │  │  • gpt-4o (SMART)             │ │
│  │  • user_id         │  │  │  │  Input: <600 tok → CHEAP      │ │
│  │  • intake_json     │  │  │  │  Input: ≥600 tok → SMART      │ │
│  │  • options_json    │  │  │  └───────────────────────────────┘ │
│  │  • itinerary_json  │  │  │  ┌───────────────────────────────┐ │
│  │  • variants_json   │  │  │  │  Anthropic (fallback)         │ │
│  │  • status          │  │  │  │  • claude-3-haiku (CHEAP)     │ │
│  │  • created_at      │  │  │  │  • claude-3-5-sonnet (SMART)  │ │
│  │  • updated_at      │  │  │  └───────────────────────────────┘ │
│  └────────────────────┘  │  └─────────────────────────────────────┘
│  ┌────────────────────┐  │
│  │  messages          │  │
│  │  • id (PK)         │  │
│  │  • trip_id (FK)    │  │
│  │  • role            │  │
│  │  • content         │  │
│  │  • tokens_in       │  │
│  │  • tokens_out      │  │
│  │  • cost_usd        │  │
│  └────────────────────┘  │
└──────────────────────────┘
```

---

## Data Flow: Full Trip Creation

```
┌──────────┐
│  USER    │
│ SUBMITS  │
│  FORM    │
└────┬─────┘
     │ FormData: { text, files[], urls }
     ▼
┌─────────────────────────────────────────────────────────┐
│  POST /api/trips                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │  1. Parse multipart form                           │ │
│  │     • text: "McLeod, Roberts, 2 adults, 7 days..." │ │
│  │     • files: [family-tree.pdf, old-photo.jpg]      │ │
│  │     • urls: "https://familysearch.org/..."         │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  2. Process files                                  │ │
│  │     • PDF → read text                              │ │
│  │     • Image → OCR via Tesseract.js                 │ │
│  │     Combined input: text + file_texts + urls       │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  3. LLM Call #1: Intake Normalization              │ │
│  │     ┌──────────────────────────────────────────┐   │ │
│  │     │ selectProvider(contextSize, env, 'cheap')│   │ │
│  │     │ → gpt-4o-mini or claude-3-haiku          │   │ │
│  │     └──────────────────────────────────────────┘   │ │
│  │     ┌──────────────────────────────────────────┐   │ │
│  │     │ callProvider({                           │   │ │
│  │     │   system: INTAKE_NORMALIZER,             │   │ │
│  │     │   user: combinedInput,                   │   │ │
│  │     │   maxTokens: 1000                        │   │ │
│  │     │ })                                       │   │ │
│  │     └──────────────────────────────────────────┘   │ │
│  │     Returns: intake JSON                           │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  4. Validate intake.v1 schema (Ajv)                │ │
│  │     ✓ surnames: string[]                           │ │
│  │     ✓ party.adults: integer                        │ │
│  │     ✓ All required fields present                  │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  5. LLM Call #2: Options Generation                │ │
│  │     ┌──────────────────────────────────────────┐   │ │
│  │     │ selectProvider(intakeSize, env, 'cheap') │   │ │
│  │     └──────────────────────────────────────────┘   │ │
│  │     ┌──────────────────────────────────────────┐   │ │
│  │     │ callProvider({                           │   │ │
│  │     │   system: OPTIONS_GENERATOR,             │   │ │
│  │     │   user: JSON.stringify(intake),          │   │ │
│  │     │   maxTokens: 900  // HARD CAP           │   │ │
│  │     │ })                                       │   │ │
│  │     └──────────────────────────────────────────┘   │ │
│  │     Returns: { options: [A, B, C, D] }             │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  6. Save to D1                                     │ │
│  │     • createTrip() → tripId                        │ │
│  │     • updateTrip(tripId, {                         │ │
│  │         intake_json: JSON.stringify(intake),       │ │
│  │         options_json: JSON.stringify(options),     │ │
│  │         status: 'options_ready'                    │ │
│  │       })                                           │ │
│  │     • saveMessage() × 3 (user, intake, options)    │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  7. Return to user                                 │ │
│  │     { tripId, intake, options, status }            │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────┐
│  USER    │
│  SEES    │
│ OPTIONS  │
│  A B C D │
└──────────┘
```

---

## Provider Routing Logic

```
┌──────────────────────────────────────────────────┐
│  selectProvider(contextTokens, env, forceMode?)  │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼
        ┌─────────────────┐
        │ forceMode set?  │
        └────────┬────────┘
                 │
          ┌──────┴──────┐
          │ YES         │ NO
          ▼             ▼
    Use forceMode   contextTokens >= 600?
                          │
                    ┌─────┴─────┐
                    │ YES       │ NO
                    ▼           ▼
                  SMART       CHEAP

┌────────────────────────────────────────────────────┐
│  CHEAP Models (intake, options)                    │
│  • OpenAI: gpt-4o-mini                             │
│    - Input: $0.15 / 1M tokens                      │
│    - Output: $0.60 / 1M tokens                     │
│  • Anthropic: claude-3-haiku-20240307              │
│    - Input: $0.25 / 1M tokens                      │
│    - Output: $1.25 / 1M tokens                     │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│  SMART Models (complex expansion, A/B variants)    │
│  • OpenAI: gpt-4o                                  │
│    - Input: $2.50 / 1M tokens                      │
│    - Output: $10.00 / 1M tokens                    │
│  • Anthropic: claude-3-5-sonnet-20241022           │
│    - Input: $3.00 / 1M tokens                      │
│    - Output: $15.00 / 1M tokens                    │
└────────────────────────────────────────────────────┘
```

---

## Token Budget Enforcement

```
┌─────────────────────────────────────────────────────┐
│  Endpoint                │  Max Tokens  │  Model    │
├─────────────────────────────────────────────────────┤
│  Intake Normalization    │    1000      │  CHEAP    │
│  Options Generation      │     900      │  CHEAP    │
│  A/B Variants            │     900      │  SMART*   │
│  Itinerary Expansion     │  600-900     │  SMART*   │
└─────────────────────────────────────────────────────┘

* Uses CHEAP if context < 600 tokens, otherwise SMART
```

---

## Schema Validation Flow

```
┌──────────────────────┐
│  LLM Response        │
│  (raw text)          │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Extract JSON        │
│  regex: /\{[...]\}/  │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  JSON.parse()        │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  Ajv Schema Validation               │
│  ┌────────────────────────────────┐  │
│  │  validateIntake(json)          │  │
│  │  • Check required fields       │  │
│  │  • Validate types              │  │
│  │  • Enforce enums               │  │
│  └────────────────────────────────┘  │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────┐       ┌────────────────────┐
│  Valid?              │──NO──>│  Return 400 error  │
└──────┬───────────────┘       └────────────────────┘
       │ YES
       ▼
┌──────────────────────┐
│  Save to D1          │
└──────────────────────┘
```

---

## File Upload → OCR Pipeline

```
┌──────────────────────┐
│  User uploads file   │
│  (multipart form)    │
└──────┬───────────────┘
       │
       ▼
┌────────────────────────────┐
│  isImageFile(filename)?    │
└──────┬─────────────────────┘
       │
  ┌────┴────┐
  │ YES     │ NO
  ▼         ▼
┌───────────────────┐  ┌──────────────────┐
│  OCR Processing   │  │  Read as text    │
│  Tesseract.js     │  │  file.text()     │
│  extractText...() │  │                  │
└────┬──────────────┘  └────┬─────────────┘
     │                      │
     ▼                      ▼
┌──────────────────────────────────────┐
│  Combine with form text + URLs       │
│  "text + [File: name]\nOCR text..."  │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────┐
│  Feed to LLM         │
│  INTAKE_NORMALIZER   │
└──────────────────────┘
```

---

## Database Schema

```sql
┌─────────────────────────────────────────────────────────────┐
│  trips                                                       │
├──────────────┬──────────────────────────────────────────────┤
│  id          │  TEXT PRIMARY KEY (nanoid)                   │
│  user_id     │  TEXT (nullable)                             │
│  template    │  TEXT DEFAULT 'heritage'                     │
│  title       │  TEXT (e.g., "Heritage trip: McLeod, Roberts")│
│  intake_json │  TEXT (JSON.stringify(intake.v1))            │
│  options_json│  TEXT (JSON.stringify({options:[A,B,C,D]}))  │
│  itinerary_  │  TEXT (JSON.stringify(itinerary.v1))         │
│  json        │                                              │
│  variants_   │  TEXT (JSON.stringify({variantA,variantB}))  │
│  json        │                                              │
│  status      │  TEXT ('intake'|'options_ready'|             │
│              │        'option_selected'|'ab_ready')         │
│  created_at  │  INTEGER (unixepoch())                       │
│  updated_at  │  INTEGER (unixepoch())                       │
└──────────────┴──────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  messages (for cost tracking + audit)                        │
├──────────────┬──────────────────────────────────────────────┤
│  id          │  TEXT PRIMARY KEY                            │
│  trip_id     │  TEXT FOREIGN KEY → trips.id                 │
│  role        │  TEXT ('user'|'assistant'|'system')          │
│  content     │  TEXT (raw LLM input/output)                 │
│  tokens_in   │  INTEGER                                     │
│  tokens_out  │  INTEGER                                     │
│  cost_usd    │  REAL (calculated from model pricing)        │
│  created_at  │  INTEGER                                     │
└──────────────┴──────────────────────────────────────────────┘
```

---

## UI Component Hierarchy

```
public/index.html
├── <header>
│   └── Title + Subtitle
├── <div class="container">
    ├── <div class="quick-tuner">
    │   └── <form id="quickTunerForm">
    │       ├── surnames (text, required)
    │       ├── origins (text)
    │       ├── adults (number, required)
    │       ├── children (text)
    │       ├── duration (number)
    │       ├── month (select)
    │       ├── luxury (select)
    │       ├── activity (select)
    │       └── notes (textarea)
    │
    ├── <div class="upload-section">
    │   ├── <div class="upload-area" id="uploadArea">
    │   │   └── Drag-drop zone
    │   ├── <input type="file" id="fileInput" multiple>
    │   └── <div id="fileList"> (dynamic)
    │
    ├── <button id="generateBtn" onclick="generateTrip()">
    │
    ├── <div id="loading" class="hidden">
    │   └── Spinner + "Analyzing..."
    │
    ├── <div id="optionsSection" class="hidden">
    │   ├── <div id="optionsGrid" class="options-grid">
    │   │   ├── <div class="option-card" data-key="A">
    │   │   ├── <div class="option-card" data-key="B">
    │   │   ├── <div class="option-card" data-key="C">
    │   │   └── <div class="option-card" data-key="D">
    │   └── <button id="confirmBtn" onclick="confirmSelection()">
    │
    └── <div id="variantsSection" class="hidden">
        └── <div id="variantsContainer">
            ├── <div class="variant-card"> (Variant A)
            └── <div class="variant-card"> (Variant B)
```

---

## Error Handling Strategy

```
┌────────────────────────────────────────────────────┐
│  Error Type               │  HTTP Code  │  Action  │
├────────────────────────────────────────────────────┤
│  Missing required field   │     400     │  Return  │
│  Invalid schema           │     400     │  Return  │
│  Trip not found           │     404     │  Return  │
│  LLM API error            │     500     │  Log +   │
│  (rate limit, quota)      │             │  Return  │
│  JSON parse failure       │     500     │  Return  │
│  Database error           │     500     │  Log +   │
│                           │             │  Return  │
└────────────────────────────────────────────────────┘

All errors return JSON:
{ "error": "Human-readable message" }

Frontend (app.js) displays in <div id="error"> (red banner)
```

---

## Security Considerations

```
┌─────────────────────────────────────────────────────┐
│  Implemented                                         │
├─────────────────────────────────────────────────────┤
│  ✅ CORS middleware (development-friendly)          │
│  ✅ Input validation (JSON Schema)                  │
│  ✅ Token budget limits (cost protection)           │
│  ✅ No raw SQL (parameterized D1 queries)           │
│  ✅ File type validation (isImageFile)              │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  NOT Implemented (recommend for production)          │
├─────────────────────────────────────────────────────┤
│  ⚠️  Rate limiting (IP-based, Cloudflare KV)        │
│  ⚠️  Authentication/Authorization                   │
│  ⚠️  File size limits (multipart)                   │
│  ⚠️  EXIF stripping from images                     │
│  ⚠️  PII detection/redaction                        │
│  ⚠️  Turnstile (bot protection)                     │
└─────────────────────────────────────────────────────┘
```

---

## Deployment Checklist

```
Local Development:
 ✅ npm install
 ✅ npm run db:migrate
 ✅ Copy .dev.vars.example → .dev.vars
 ✅ Add OPENAI_API_KEY or ANTHROPIC_API_KEY
 ✅ npm run dev
 ✅ ./test-smoke.sh

Production Deploy:
 ☐ wrangler d1 create voygent-heritage-db
 ☐ Update wrangler.toml with database_id
 ☐ npm run db:migrate:prod
 ☐ wrangler secret put OPENAI_API_KEY (or ANTHROPIC_API_KEY)
 ☐ npm run deploy
 ☐ Test via curl against production URL
 ☐ Configure custom domain (optional)
 ☐ Set up monitoring/alerts (optional)
```
