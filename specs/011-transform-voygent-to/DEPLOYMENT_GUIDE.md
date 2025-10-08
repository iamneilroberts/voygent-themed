# Feature 011 Deployment Guide

## Overview

Complete deployment guide for the template-driven trip system transformation.

---

## Pre-Deployment Checklist

### Code Quality
- [x] All phases completed (1-12)
- [x] Integration tests passing
- [x] No critical bugs
- [x] Code reviewed
- [x] Documentation complete

### Database
- [x] All migrations created (020, 021, 022, 023)
- [x] Migrations applied to test database
- [x] Migrations applied to production database
- [x] Backup taken before deployment
- [ ] Migration 023 scheduled (2025-11-08)

### API Endpoints
- [x] 35+ new endpoints implemented
- [x] All endpoints tested
- [x] Error handling verified
- [x] Deprecation warnings in place

### Frontend
- [x] Core components implemented
- [x] Browser compatibility verified
- [x] Mobile responsiveness tested
- [ ] Production build created

### Security
- [x] Input sanitization (TemplateEngine)
- [x] SQL injection prevention (parameterized queries)
- [x] API rate limiting (existing)
- [x] Authentication/authorization (existing)
- [x] CORS configuration (existing)

---

## Deployment Steps

### Step 1: Final Testing

```bash
# Run all tests
npm run test

# Run integration tests
./scripts/run-integration-tests.sh

# Check for lint errors
npm run lint

# Build frontend
npm run build
```

### Step 2: Database Backup

```bash
# Backup production database before deployment
npx wrangler d1 export voygent-themed \
  --output=backups/voygent-themed-$(date +%Y%m%d-%H%M%S).sql

# Verify backup
ls -lh backups/
```

### Step 3: Deploy Migrations

```bash
# Apply migrations to production (if not already applied)
npx wrangler d1 execute voygent-themed --remote --file=migrations/020_extend_trip_templates.sql
npx wrangler d1 execute voygent-themed --remote --file=migrations/021_create_handoff_documents.sql
npx wrangler d1 execute voygent-themed --remote --file=migrations/022_trip_selections_tracking.sql

# Verify migrations
npx wrangler d1 execute voygent-themed --remote --command="
  SELECT name FROM sqlite_master WHERE type='table';
"
```

### Step 4: Deploy Code

```bash
# Push to main branch
git checkout main
git merge 011-transform-voygent-to
git push origin main

# Deploy to Cloudflare Pages
npx wrangler pages deploy public/ \
  --project-name=voygent \
  --branch=main

# Verify deployment
curl https://voygent.app/api/admin/diagnostics/health
```

### Step 5: Verify Deployment

```bash
# Check health
curl https://voygent.app/api/admin/diagnostics/health | jq

# List templates
curl https://voygent.app/api/admin/templates | jq '.templates[] | {id, name, is_active}'

# Check A/B deprecation
curl -X PATCH https://voygent.app/api/trips/test-id/ab
# Should return 410 Gone

# Test new workflow
curl -X POST https://voygent.app/api/trips \
  -F "text=Test deployment" \
  -F "theme=heritage"
```

### Step 6: Monitor

```bash
# Watch logs for errors
npx wrangler tail --project-name=voygent

# Check error rate
./scripts/monitor-ab-usage.sh

# Monitor provider costs
curl https://voygent.app/api/admin/diagnostics/provider-stats | jq '.totals'
```

---

## Rollback Plan

If critical issues are discovered:

### Immediate Rollback (< 1 hour)

```bash
# 1. Revert to previous deployment
git revert HEAD
git push origin main

# 2. Redeploy previous version
npx wrangler pages deploy public/ --project-name=voygent --branch=main

# 3. Verify rollback
curl https://voygent.app/api/admin/diagnostics/health
```

### Database Rollback (if needed)

```bash
# ⚠️ DANGER: Only if database corruption detected

# 1. Stop all traffic (temporarily disable endpoints)

# 2. Restore from backup
npx wrangler d1 restore voygent-themed \
  --from=backups/voygent-themed-YYYYMMDD-HHMMSS.sql

# 3. Verify restore
npx wrangler d1 execute voygent-themed --remote --command="
  SELECT COUNT(*) FROM themed_trips;
"

# 4. Re-enable traffic
```

---

## Post-Deployment Tasks

### Day 1-7

- [ ] Monitor error logs daily
- [ ] Check A/B endpoint usage (should be zero)
- [ ] Verify new trip creations working
- [ ] Monitor provider costs
- [ ] Check handoff document creation
- [ ] Review diagnostic data

### Week 2-4

- [ ] Continue A/B usage monitoring
- [ ] Performance optimization based on real usage
- [ ] Gather user feedback
- [ ] Address any bugs discovered

### Day 30 (2025-11-08)

- [ ] Verify A/B endpoint usage = 0 for 7 consecutive days
- [ ] Delete `/api/trips/[id]/ab.ts` file
- [ ] Run Migration 023 to drop `variants_json` column
- [ ] Update documentation to remove A/B references

---

## Performance Optimization

### Database Indexes

Already created:
```sql
-- trip_templates
CREATE INDEX idx_templates_active ON trip_templates(is_active, created_at DESC);
CREATE INDEX idx_templates_name ON trip_templates(name);

-- handoff_documents
CREATE INDEX idx_handoff_trip ON handoff_documents(trip_id);
CREATE INDEX idx_handoff_agent ON handoff_documents(agent_id, quote_status);
CREATE INDEX idx_handoff_status ON handoff_documents(quote_status, created_at DESC);
CREATE INDEX idx_handoff_expires ON handoff_documents(expires_at) WHERE quote_status = 'pending';

-- trip_option_tracking
CREATE INDEX idx_option_tracking_trip ON trip_option_tracking(trip_id, shown_at DESC);
CREATE INDEX idx_option_tracking_type ON trip_option_tracking(trip_id, option_type);

-- trip_selections
CREATE INDEX idx_selections_trip ON trip_selections(trip_id, selected_at DESC);
CREATE INDEX idx_selections_type ON trip_selections(trip_id, selection_type);

-- logs
CREATE INDEX idx_logs_correlation ON logs(correlation_id, timestamp DESC);
CREATE INDEX idx_logs_category ON logs(category, timestamp DESC);
CREATE INDEX idx_logs_level ON logs(level, timestamp DESC);
```

### Caching Strategy

```javascript
// Add caching headers to template endpoint
export async function onRequestGet(context) {
  const response = await getTemplates(context.env.DB);

  return new Response(JSON.stringify(response), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300' // 5 minutes
    }
  });
}
```

### Provider Cost Optimization

Current provider cascade (already implemented):
1. Z.AI (cheapest)
2. OpenAI (fallback)
3. Anthropic (final fallback)

Monitor usage:
```bash
curl https://voygent.app/api/admin/diagnostics/provider-stats | jq '.stats'
```

### Log Retention

Implement log archival:
```bash
# Cron job: Daily at 2am
0 2 * * * /path/to/scripts/archive-old-logs.sh
```

```bash
#!/bin/bash
# Archive logs older than 30 days to R2
# (Script to be implemented)

THIRTY_DAYS_AGO=$(date -d '30 days ago' --iso-8601)

# Export old logs
npx wrangler d1 execute voygent-themed --remote --command="
  SELECT * FROM logs WHERE timestamp < '$THIRTY_DAYS_AGO';
" > logs-archive-$(date +%Y%m%d).json

# Upload to R2
npx wrangler r2 object put voygent-logs/archive-$(date +%Y%m%d).json \
  --file=logs-archive-$(date +%Y%m%d).json

# Delete old logs
npx wrangler d1 execute voygent-themed --remote --command="
  DELETE FROM logs WHERE timestamp < '$THIRTY_DAYS_AGO';
"
```

---

## Monitoring & Alerts

### Health Checks

```bash
# Add to monitoring service (e.g., UptimeRobot, Pingdom)
https://voygent.app/api/admin/diagnostics/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": { "connected": true },
  "errors": { "lastHour": 0 }
}
```

### Error Thresholds

Set up alerts for:
- Health status = "degraded" or "unhealthy"
- Error count > 10 in last hour
- Database connection failures
- Provider API failures > 20%
- Handoff creation failures

### Cost Alerts

```bash
# Daily cost report
curl https://voygent.app/api/admin/diagnostics/provider-stats | \
  jq '.totals.totalCost' | \
  mail -s "Daily Provider Cost Report" admin@voygent.app
```

Alert if:
- Daily cost > $50
- Single trip cost > $2
- Z.AI fallback rate > 50%

---

## Security Hardening

### Rate Limiting

```typescript
// Already implemented in existing system
// Verify configuration:
export const rateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
}
```

### API Key Rotation

```bash
# Rotate provider API keys quarterly
# Update Cloudflare Workers secrets

npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put ZAI_API_KEY
npx wrangler secret put AMADEUS_CLIENT_ID
npx wrangler secret put AMADEUS_CLIENT_SECRET
```

### Input Validation

Already implemented:
- TemplateValidator: JSON arrays, text length, business logic
- HandoffValidator: Chat history, options, itinerary
- TemplateEngine: Input sanitization

### Database Security

- Parameterized queries (already used)
- No eval() or dynamic SQL
- Foreign key constraints
- Check constraints on critical fields

---

## Documentation Updates

After deployment:

1. Update README.md with new features
2. Update API documentation
3. Create user guide for template management
4. Document A/B deprecation for users
5. Update agent dashboard documentation
6. Create video tutorials (optional)

---

## Feature Flags

Consider implementing feature flags for gradual rollout:

```typescript
// Example feature flag system
const features = {
  templateSystem: true,
  researchGate: true,
  handoffDocuments: true,
  diagnosticsV2: true
};

if (features.templateSystem) {
  // Use new template-driven workflow
} else {
  // Use legacy workflow
}
```

This allows:
- A/B testing of new features
- Gradual rollout to users
- Quick rollback without code deployment

---

## Support & Maintenance

### Support Channels

- GitHub Issues: Technical bugs
- Email: support@voygent.app
- Discord: Community support
- Slack: Internal team

### Maintenance Schedule

- **Weekly**: Review error logs, check costs
- **Monthly**: Security updates, dependency updates
- **Quarterly**: Performance review, cost optimization
- **Annually**: Major feature review, roadmap planning

### On-Call Rotation

Define on-call schedule for critical issues:
- Response time: < 1 hour for P0
- Resolution time: < 4 hours for P0, < 24 hours for P1

---

## Success Metrics

Track these KPIs post-deployment:

### Technical Metrics
- API response times (P50, P95, P99)
- Error rate (< 0.1%)
- Uptime (> 99.9%)
- Provider costs per trip

### Business Metrics
- Trip creation success rate
- Research-to-options conversion rate
- Handoff document creation rate
- Agent quote submission rate
- Template usage distribution

### User Experience
- Time to complete workflow
- User satisfaction (surveys)
- Feature adoption rate
- Support ticket volume

---

## Conclusion

Feature 011 deployment checklist:
- [x] Code complete
- [x] Tests passing
- [x] Documentation ready
- [ ] Deployment executed
- [ ] Monitoring active
- [ ] A/B deprecation tracked
- [ ] 30-day cleanup scheduled

**Ready for production deployment! 🚀**
