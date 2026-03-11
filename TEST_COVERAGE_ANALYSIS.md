# Test Coverage Analysis

**Date:** 2026-03-11
**Current state:** Zero test coverage. No test framework or linter is configured (no eslint, prettier, jest, or vitest).

---

## Recommended Test Framework Setup

- **Server:** Vitest (fast, ESM-native, compatible with the existing ES module setup)
- **Client:** Vitest + Vue Test Utils (for component/store testing)
- **E2E (future):** Playwright or Cypress

---

## Priority Areas for Testing

### Tier 1 — Critical (Security & Data Integrity)

#### 1. Encryption Service (`server/src/services/encryption.js`)
**Risk: HIGH** — Security-critical code with zero validation.

| What to test | Why |
|---|---|
| `encrypt()` / `decrypt()` round-trip | Prove data survives the cycle |
| Incorrect master key rejection | Ensure tampering/wrong-key throws |
| Auth tag validation (GCM integrity) | Detect ciphertext modification |
| Salt & IV randomness | Two encryptions of the same plaintext must differ |
| Edge cases: empty string, unicode, very long input | Boundary conditions |

#### 2. Auth Middleware (`server/src/middleware/auth.js`)
**Risk: HIGH** — Guards every protected endpoint.

| What to test | Why |
|---|---|
| Valid JWT → user attached to `req.user` | Happy path |
| Expired/invalid/malformed JWT → 401 | Reject bad tokens |
| Missing `Authorization` header → 401 | No token at all |
| `AUTH_BYPASS=true` → auto-login as dev user | Dev mode works |
| `adminMiddleware` rejects non-admin users | Role enforcement |
| `tripMemberMiddleware` with admin bypass | Admin can access any trip |
| `tripMemberMiddleware` with non-member → 403 | Access control |
| `selfOnlyMiddleware` blocks other users | User isolation |

#### 3. Bed Request Workflow (`server/src/routes/bedRequests.js`)
**Risk: HIGH** — Financial implications (who pays for which bed).

| What to test | Why |
|---|---|
| Create request → status is `requested` | Initial state |
| Confirm request → status is `confirmed` | State transition |
| Duplicate `(bed_id, user_id)` → rejected | UNIQUE constraint |
| Withdraw own request → deleted | Self-service |
| Non-member cannot create request | Access control |
| Confirm sets `assigned_user_id` on the bed | Side effect correctness |

---

### Tier 2 — High Value (Complex Business Logic)

#### 4. JSON Extraction (`extractJSON()` in `server/src/routes/agent.js`)
**Risk: MEDIUM** — 4-stage parsing pipeline; silent failures break the agent.

| What to test | Why |
|---|---|
| Valid JSON string → parsed object | Direct parse path |
| JSON wrapped in markdown fences → parsed | Fence stripping path |
| JSON embedded in prose → extracted via regex | Regex `{}` path |
| JSON array in prose → extracted | Regex `[]` path |
| Deeply nested objects | Brace-matching edge cases |
| Invalid JSON → `null` returned | Graceful failure |
| Empty string / whitespace | Boundary |

#### 5. Agent Tool Query Functions (`server/src/services/agentTools.js`)
**Risk: MEDIUM** — 30+ SQL query functions; incorrect data breaks AI responses.

Top functions to test first (by complexity and usage):

| Function | Complexity | Why |
|---|---|---|
| `getBedAvailability()` | Multi-JOIN with nested requests | Incorrect availability = bad recommendations |
| `getCostBreakdown()` | Per-person cost math | Financial accuracy |
| `getScheduleGaps()` | Time arithmetic, gap detection | Off-by-one errors in datetime math |
| `getItinerary()` | UNION query, datetime sorting | Mixed activity+eats ordering |
| `getCarpoolOpportunities()` | Filtering + aggregation | Wrong capacity math |
| `getUserBed()` | Fuzzy name matching | "Alex" vs "Alexander" edge cases |
| `getTripOverview()` | Count + cost aggregation | Dashboard accuracy |

#### 6. LLM Client (`server/src/services/llmClient.js`)
**Risk: MEDIUM** — Orchestrates the tool-use loop with Claude.

| What to test | Why |
|---|---|
| Single-turn response (no tool use) | Happy path |
| Multi-turn tool loop (2+ rounds) | Core agent functionality |
| Tool execution errors → graceful handling | Resilience |
| Ollama path: message format conversion | Multi-provider support |
| API errors (rate limit, auth failure) → thrown | Error propagation |
| Max iterations guard | Prevent infinite loops |

#### 7. Web Scraper (`server/src/services/scraper.js`)
**Risk: MEDIUM** — 20+ regex patterns, brittle HTML parsing.

| What to test | Why |
|---|---|
| `detectPlatform()` with Airbnb/Google/unknown URLs | Platform routing |
| `parseBedDescription("1 king bed, 2 single beds")` | Bed type extraction |
| `extractBedrooms()` from sample HTML | Bracket-matching JSON parse |
| `decodeHtmlEntities()` edge cases | `&amp;`, `&#39;`, unicode |
| Airbnb OG meta tag extraction | Title/image/description |
| Google Maps coordinate extraction | lat/lng parsing |
| Network failure handling (fetch errors) | Resilience |

**Recommendation:** Create HTML fixture files with representative Airbnb and Google Maps pages.

---

### Tier 3 — Medium Value (Client-Side Logic)

#### 8. Router Guards (`client/src/router/index.js`)
| What to test | Why |
|---|---|
| Unauthenticated user → `/login` redirect | Auth gate |
| Non-admin → redirect from admin routes | Role gate |
| Authenticated user → cannot access `/login` | Guest-only gate |
| `authStore.initialize()` called before guard | Race condition prevention |

#### 9. Auth Store (`client/src/stores/auth.js`)
| What to test | Why |
|---|---|
| `initialize()` with valid token → fetches user | Startup flow |
| `initialize()` with no token → stays unauthenticated | Clean state |
| `fetchCurrentUser()` 401 → clears token | Session expiry |
| `isAdmin` getter with impersonation active | Impersonation logic |
| `logout()` clears token + user + localStorage | Cleanup completeness |

#### 10. Trip Store (`client/src/stores/trip.js`)
| What to test | Why |
|---|---|
| `fetchTrips()` sets loading state correctly | UI loading indicators |
| `selectTrip()` persists to localStorage | Cross-session persistence |
| Auto-select first trip when none selected | First-visit UX |
| CRUD operations update local array | Optimistic updates |

#### 11. API Client Interceptors (`client/src/api/client.js`)
| What to test | Why |
|---|---|
| Request interceptor adds `Authorization` header | Token injection |
| 401 on `/auth/me` → silent (no redirect) | Startup check |
| 401 on other endpoints → redirect to `/login` | Session expiry |

---

### Tier 4 — Lower Priority (Simple Logic)

#### 12. Database Helpers (`server/src/db/connection.js`)
| What to test | Why |
|---|---|
| `all()` returns array of row objects | Query interface |
| `get()` returns single object or undefined | Single-row interface |
| `run()` returns `{ lastId, changes }` | Write interface |
| `getDb()` initializes from file if exists | Persistence |
| `getDb()` creates fresh DB if no file | First run |

#### 13. Agent Store (`client/src/stores/agent.js`)
| What to test | Why |
|---|---|
| `dispatch()` → `pendingAction` is set | Action bus |
| `setResult()` → `lastActionResult` is set | Feedback loop |
| `clearAction()` / `clearResult()` | Cleanup |

#### 14. Composables (`useDarkMode`, `useTripColor`)
| What to test | Why |
|---|---|
| Dark mode toggle sets CSS class on `<html>` | DOM side effect |
| Trip color sets correct CSS variables | Theming |

---

## Suggested Test File Structure

```
server/
  src/
    services/
      __tests__/
        encryption.test.js
        agentTools.test.js
        llmClient.test.js
        scraper.test.js
        fixtures/
          airbnb-sample.html
          google-maps-sample.html
    middleware/
      __tests__/
        auth.test.js
    routes/
      __tests__/
        agent.test.js
        bedRequests.test.js
    db/
      __tests__/
        connection.test.js

client/
  src/
    stores/
      __tests__/
        auth.test.js
        trip.test.js
        agent.test.js
    router/
      __tests__/
        index.test.js
    api/
      __tests__/
        client.test.js
```

---

## Estimated Effort

| Tier | Files | Estimated test cases | Effort |
|---|---|---|---|
| Tier 1 (Critical) | 3 | ~40 | Small — start here |
| Tier 2 (High value) | 4 | ~60 | Medium |
| Tier 3 (Client logic) | 4 | ~30 | Medium |
| Tier 4 (Foundations) | 3 | ~15 | Small |
| **Total** | **14** | **~145** | |

---

## Quick Start

```bash
# Install vitest in both server and client
cd server && npm install -D vitest
cd ../client && npm install -D vitest @vue/test-utils jsdom

# Add to server/package.json scripts:
#   "test": "vitest run",
#   "test:watch": "vitest"

# Add to client/package.json scripts:
#   "test": "vitest run",
#   "test:watch": "vitest"

# Start with encryption (highest risk-to-effort ratio):
# Create server/src/services/__tests__/encryption.test.js
```

---

## Summary

The codebase has **zero test coverage** across all layers. The highest-priority gaps are:

1. **Encryption** — security-critical, easily testable, no external dependencies
2. **Auth middleware** — guards every endpoint, mockable with minimal setup
3. **Bed request workflow** — financial implications, UNIQUE constraint enforcement
4. **`extractJSON()`** — agent reliability depends on this 4-stage parser
5. **Agent tool queries** — 30+ SQL functions that power all AI responses

Starting with Tier 1 (encryption + auth + bed requests) gives the best risk reduction per test written.
