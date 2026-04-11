# thuvienso.top Project Roadmap

**Project**: Vietnamese music resources site  
**Stack**: Payload CMS v3.80, Next.js 15.4.11, Neon Postgres (Vercel)  
**Status**: Production (active)  
**Last Updated**: 2026-04-11

---

## Recently Shipped

### Product Cache Poisoning Fix (2026-04-11)
- **Issue**: Products disappearing intermittently for customers
- **Root Cause**: Unstable cache returning stale/empty data at unpredictable intervals
- **Solution**:
  - Force-dynamic rendering on all product-listing pages
  - Reduced `unstable_cache` TTL: 15s for products, 30s for others
  - Throw-retry fallback pattern in `src/lib/payload.ts`
- **Impact**: Critical stability fix—eliminates customer visibility issues

---

## Known Issues & Technical Debt

### Payload Schema Drift (Priority: Medium)
- **Issue**: `activity_logs` table and `_status` column prompts on dev environment
- **Status**: Under investigation—do NOT auto-accept schema migrations
- **Risk**: Potential data consistency issues across environments
- **Action Required**: Schema analysis and validation before applying

---

## Suggested Next Steps

1. **Monitoring & Alerting** (Priority: High)
   - Implement cache-empty state detection
   - Alert on product visibility gaps

2. **Testing** (Priority: High)
   - Add integration tests for product visibility edge cases
   - Validate cache behavior under load

3. **Schema Validation** (Priority: Medium)
   - Investigate schema drift root cause
   - Document Payload migration strategy

---

## Development Notes

- Always restart dev server after fixes/builds
- Use absolute file paths in logs/documentation
- Monitor cache metrics post-deployment
