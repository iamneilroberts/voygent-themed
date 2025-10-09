# VoyGent V3 - Template-Driven Conversational Trip Planner

**Status**: Fresh start, ready for `/specify` and `/plan`

## What This Is

A complete rewrite of VoyGent optimized for:
- ✅ **Template-driven architecture** (zero hardcoded trip logic)
- ✅ **Two-phase conversational workflow** (Research destinations → User confirms → Build trip)
- ✅ **Chat interface** (not form-based)
- ✅ **User-facing progress** vs. **Admin telemetry** (clear separation)
- ✅ **Expanded preferences panel** (visible by default)
- ✅ **API efficiency** (Amadeus only after user confirms destinations)

## Quick Start

1. **Read the prompt**: `PROMPT.md` contains the complete specification
2. **Use Specify workflow**: In a new Claude Code session, run:
   ```
   /specify
   ```
   Paste the contents of `PROMPT.md` when prompted
   
3. **Generate implementation plan**:
   ```
   /plan
   ```

## Key Differences from V1 (`lite-voygent-claude`)

| Aspect | V1 (lite-voygent-claude) | V3 (this project) |
|--------|-------------------------|-------------------|
| Architecture | Hardcoded heritage logic | Template-driven (all themes) |
| Interaction | Form-based | Chat-based conversational |
| Research | Build trip immediately | Research → Confirm → Build |
| Preferences | Hidden in form | Expanded panel by default |
| Progress | Technical logs visible | User-friendly vs. Admin telemetry |
| API Calls | Immediate | Only after destination confirmation |

## Reference V1 Components

Useful patterns to copy from `/home/neil/dev/lite-voygent-claude`:
- `functions/api/lib/providers/` - AI provider selection
- `functions/api/lib/logger.ts` - Logging system
- `wrangler.toml` - Configuration structure

**Don't copy**:
- `functions/api/trips/index.ts` - Hardcoded heritage logic (we're fixing this)
- `public/index.html` - Old UI with A/B variants
- `public/js/main.js` - Form-based, not chat

## Tech Stack

- **Platform**: Cloudflare Pages + Functions
- **Database**: D1 (SQLite)
- **Frontend**: Vanilla HTML/CSS/JS (no React)
- **Backend**: TypeScript
- **APIs**: Amadeus (flights, hotels), Viator (tours), Serper/Tavily (web search)

## Database

**Development**: Create new D1 database `voygent-v3-dev`
**Production**: Will use `voygent-themed` once stable

## Deployment Strategy

1. **Phase 1**: Deploy to `voygent-v3.pages.dev` (new Cloudflare Pages project)
2. **Phase 2**: Test with separate D1 database
3. **Phase 3**: Point `voygent.app` to V3 deployment
4. **Phase 4**: Archive V1 (`lite-voygent-claude`)

## Next Steps

1. Open new Claude Code session
2. Navigate to this directory: `cd /home/neil/dev/voygent-v3-template-driven`
3. Run `/specify` with contents of `PROMPT.md`
4. Run `/plan` to generate implementation tasks
5. Start building!

---

**V1 Location**: `/home/neil/dev/lite-voygent-claude` (reference only, don't modify)
**Created**: 2025-10-09
