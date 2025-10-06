# Voygent • Heritage Trip MVP (Chat-first)

## Problem
Travelers with heritage interests arrive with messy inputs (links to Ancestry/FamilySearch, PDFs, photos of documents, pasted notes). They want credible trip **options** fast, not a long interview. Travel pros need a clean **handoff** with structured data, and a path to monetize via quotes.

## Goals (MVP)
1) **Intake anything**: pasted text, URLs, files (PDF/images), short notes.
2) **Generate up to 4 options** + “why we chose this” for a Heritage trip anywhere.
3) **User selects one** → system proposes **A/B variants** tuned by prefs:
   - Transportation (rail-first / car-ok / driver-guide)
   - Luxury level (Backpack / Savvy / Comfort / Boutique / Occasional Luxe)
   - Activity level (gentle / moderate / ambitious)
   - Accessibility notes
4) **Store** every trip with a stable **Trip ID** → retrievable & modifiable later.
5) **Light research**: operating patterns, distance sanity, high-signal sources (non-binding).
6) **Share** copy (summary + link) and **handoff** list (booking items) for a travel pro.

## Non-Goals (MVP)
- No live inventory or exact hotel/flight SKUs.
- No payment/quotes; only produce a clean handoff payload for pros.
- No full genealogy research; only light enrichment.

## User Journeys
- **DIY traveler**: lands on Heritage template → uploads/link/paste → sees up to 4 options → picks one → chooses A/B variant based on prefs → saves & shares.
- **Travel pro**: receives a structured **Quote Handoff** payload; can contact traveler outside MVP.

## Top Risks
- Hallucinations; mitigation via validation step + cautious language.
- Token costs; mitigate via cheap model for intake parsing & validation, short outputs, and content caching.
- Messy inputs; normalize to `schemas/intake.v1.json`.

## Acceptance Criteria
- POST `/api/trips` with intake → returns `{ tripId, options[<=4] }`.
- PATCH `/api/trips/:id/select` with `{ optionKey }` → returns `{ itineraryDraft }`.
- PATCH `/api/trips/:id/ab` with `{ preferences }` → returns `{ variantA, variantB }`.
- GET `/api/trips/:id` returns latest `{ intake, options, itinerary, variants }`.
- All JSON conform to `schemas/*.json`. No hard failures on missing fields (assume & label).
