# TripPlanner — Architecture Reference

## Tech Stack
- **Client:** Vue 3 + Vite + Tailwind CSS v4 (port 5173)
- **Server:** Node.js + Express, ES modules (port 3000)
- **Database:** SQLite via sql.js (WASM, in-memory with auto-save to disk)
- **Auth:** Google OAuth 2.0 + JWT + Passport (or `AUTH_BYPASS=true` for dev)
- **Maps:** Google Maps JavaScript API + Places API
- **AI:** Anthropic Claude API (Sonnet for chat, Haiku for background tasks)

## Dev Commands
```
npm run dev          # AUTH_BYPASS=true, auto-login as Alex (admin)
npm run dev:auth     # Full Google OAuth flow
npm run db:reset     # Drop all → migrate → seed
npm run db:migrate   # Run pending migrations only
npm run db:seed      # Seed test data only
```

## Key Decisions & Pitfalls
- **sql.js** (not better-sqlite3): No native compilation needed. Must use `new Uint8Array(buffer)` when loading DB files. Helpers: `getDb()`, `saveDb()`, `all()`, `get()`, `run()` in `server/src/db/connection.js`
- **No `@` alias**: Vite config does NOT set up `@` path alias. All imports use **relative paths** (e.g. `../../stores/agent`)
- **Bedrooms table**: Column is `name` (NOT `bedroom_name`), no `bedroom_type` column
- **Accommodations**: No `latitude`/`longitude` columns — only activities have geo coords
- **DB auto-save**: Middleware in `index.js` calls `saveDb()` after every POST/PUT/PATCH/DELETE response

## Seed Data
- **User:** Alex Slocum (a.alex.slocum@gmail.com, admin)
- **Trip:** "Weekend Getaway" (2026-04-10 to 2026-04-12)

---

## Data Model

```
users
  user_id, first_name, last_name, email, role (admin|user),
  google_id, avatar_url, ai_notes, encrypted_budget, budget_iv, budget_salt

trips
  trip_id, trip_name, start_date, end_date

trip_members
  trip_id → trips, user_id → users (composite PK)

accommodations
  accommodation_id, trip_id → trips, description, address,
  airbnb_id, airbnb_url, check_in_datetime, check_out_datetime, total_cost

bedrooms
  bedroom_id, accommodation_id → accommodations, name, price_share_adjustment

beds
  bed_id, bedroom_id → bedrooms, bed_type, assigned_user_id → users

bedroom_claims
  claim_id, bedroom_id → bedrooms, user_id → users, status (requested|confirmed)

accommodation_images
  image_id, accommodation_id → accommodations, bedroom_id → bedrooms (nullable),
  image_url, sort_order

activities
  activity_id, trip_id → trips, title, description, address,
  google_place_id, image_url, latitude, longitude, rating,
  start_datetime, end_datetime, estimated_cost, duration, source_url,
  is_suggested, created_at

proposals
  proposal_id, trip_id → trips, proposal_name, proposal_text, estimated_cost

ai_settings
  key (PK), value, updated_at
  Keys: agent_voice_prompt, behavior_rules,
        global_chat_accommodations_prompt, global_chat_activities_prompt,
        global_chat_itinerary_prompt, global_chat_map_prompt
  Template vars: {{TRIP_CONTEXT}}, {{PAGE_CONTEXT}} (replaced at runtime)
```

---

## API Routes

### Auth (`/api/auth`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /google | — | Start Google OAuth |
| GET | /google/callback | — | OAuth callback → JWT |
| GET | /me | auth | Get current user |

### Trips (`/api/trips`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | / | auth | List user's trips |
| GET | /:tripId | auth | Get trip |
| POST | / | admin | Create trip |
| PUT | /:tripId | admin | Update trip |
| DELETE | /:tripId | admin | Delete trip |
| GET | /:tripId/members | auth | List members |
| POST | /:tripId/members | admin | Add member |
| POST | /:tripId/members/bulk | admin | Bulk add members |
| DELETE | /:tripId/members/:userId | admin | Remove member |
| GET | /:tripId/itinerary | auth | Merged timeline |

### Accommodations (`/api/accommodations`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /trip/:tripId | auth | List for trip |
| GET | /:id | auth | Get with bedrooms/beds/images/claims |
| POST | / | admin | Create |
| PUT | /:id | admin | Update |
| DELETE | /:id | admin | Delete |

### Bedrooms (`/api/bedrooms`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | / | admin | Create bedroom |
| POST | /upsert | admin | Create or find by name |
| PUT | /:id | admin | Update (price_share_adjustment) |
| DELETE | /:id | admin | Delete |

### Beds (`/api/beds`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | / | admin | Create bed |
| PUT | /:id | admin | Update bed_type |
| PUT | /:id/assign | admin | Assign user to bed |
| POST | /:id/claim | auth+member | Self-claim an available bed |
| DELETE | /:id | admin | Delete bed |

### Activities (`/api/activities`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /trip/:tripId | auth | List for trip |
| GET | /:id | auth | Get single |
| POST | / | auth | Create (non-admin → is_suggested=1) |
| PUT | /:id | admin | Update |
| DELETE | /:id | admin | Delete |

### Agent (`/api/agent`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /preview-context | admin | View formatted trip context |
| POST | /chat | auth+member | Global agent chat (page-aware) |
| POST | /questions | admin | Generate screening questions |
| POST | /proposal | admin | Generate trip proposal |

### Other
| Route | Auth | Purpose |
|-------|------|---------|
| `/api/images` | admin | CRUD for accommodation images |
| `/api/scrape` | admin | Scrape Airbnb listing |
| `/api/bedroom-claims` | auth | Request/confirm/remove room claims |
| `/api/proposals` | admin | CRUD for saved proposals |
| `/api/ai-settings` | admin | CRUD for AI prompt settings |
| `/api/users` | varies | User management |

---

## Client Architecture

### Pages (Views)
| Route | View | Description |
|-------|------|-------------|
| `/login` | LoginView | Google OAuth login |
| `/auth/callback` | AuthCallbackView | OAuth callback handler |
| `/accommodations` | AccommodationsView | Tabbed accommodation manager |
| `/activities` | ActivitiesView | Activity cards grouped by date |
| `/itinerary` | ItineraryView | Merged timeline view |
| `/map` | MapView | Google Map with pins |
| `/users` | UsersView | Admin: manage users |
| `/travel-agent` | TravelAgentView | Admin: Q&A → proposal flow |
| `/ai-settings` | AiSettingsView | Admin: edit AI prompts |

### Component Hierarchy
```
App.vue
├── AppHeader.vue (top bar, TripSelector)
├── AppSidebar.vue (desktop sidebar + mobile tab bar + drawer)
├── GlobalAgentPanel.vue (floating chat panel, all pages)
└── <router-view>
    ├── AccommodationsView
    │   ├── OverviewTab (image carousel, stay info, cost)
    │   ├── BedroomsTab (rooms, beds, claims, pricing)
    │   ├── AmenitiesTab
    │   ├── LocationTab (embedded map)
    │   └── AttendeesTab (trip members)
    ├── ActivitiesView (cards + add/edit form + Google Places)
    ├── ItineraryView (grouped timeline)
    └── MapView (Google Map + geocoded pins)
```

### Stores (Pinia)
| Store | Key State | Purpose |
|-------|-----------|---------|
| `auth` | user, isAuthenticated, isAdmin | Auth state, JWT token |
| `trip` | trips, selectedTripId (persisted) | Trip selection |
| `agent` | pendingAction, lastActionResult | Agent ↔ page action bus |

### Agent Action Flow
```
GlobalAgentPanel → POST /agent/chat → Claude response with action JSON
                 → agentStore.dispatch(action)
                 → Page view watches pendingAction
                 → Executes API call (claim bed, open form, center map)
                 → agentStore.setResult({ success, message })
                 → Panel displays result
```

Action types: `claim-bed`, `add-activity`, `center-map`

---

## AI/Agent System

### Prompt Pipeline
1. **Behavior rules** (from `ai_settings.behavior_rules`): NO FABRICATION, NO SYCOPHANCY, GEOGRAPHIC ACCURACY, KEEP IT TIGHT
2. **Voice/tone** (from `ai_settings.agent_voice_prompt`): Prepended to all prompts
3. **Page-specific prompt** (from `ai_settings.global_chat_*_prompt` → falls back to `PROMPT_DEFAULTS` in code): Instructions + action JSON format + `{{TRIP_CONTEXT}}` / `{{PAGE_CONTEXT}}` placeholders replaced at runtime
4. **Escalation suffix**: Tone shifts after 6 turns (impatient → blunt → dismissive)

### Models Used
- `claude-sonnet-4-20250514` — All chat endpoints, questions, proposals
- `claude-haiku-235-20250414` — `generateUserNote()` (fire-and-forget background task)

### Key Functions in `agent.js`
- `buildTripContext(tripId)` → fetches trip, members, accommodations, activities
- `formatContextForClaude(ctx)` → formats as readable text for system prompt
- `buildPageContext(page, tripId)` → page-specific data (beds for accommodations, etc.)
- `formatPageContext(page, pageData)` → formats page data
- `buildSystemPrompt(page, tripContext, pageContext)` → assembles full system prompt from ai_settings (voice + rules + page prompt with template vars replaced)
- `extractJSON(text)` → robust JSON extraction (direct parse → strip fences → regex)
- `generateUserNote(userId, messages, formData)` → background user interest note update
- `getEscalationSuffix(turnCount)` → tone escalation after 6 turns

---

## File Tree

```
TripPlanner/
├── package.json                          # Root: concurrently + cross-env
├── CLAUDE.md                             # This file
├── CONSULTANT_REPORT.md                  # Improvement recommendations
│
├── server/
│   ├── package.json
│   └── src/
│       ├── index.js                      # Express app, route registration, DB auto-save
│       ├── config/
│       │   ├── env.js                    # Environment config
│       │   └── passport.js              # Google OAuth strategy
│       ├── db/
│       │   ├── connection.js            # sql.js wrapper (getDb, saveDb, all, get, run)
│       │   ├── seed.js                  # Test data seeder
│       │   └── migrations/
│       │       ├── runner.js            # Migration runner
│       │       └── 001-018_*.sql        # Schema migrations
│       ├── middleware/
│       │   ├── auth.js                  # authMiddleware, adminMiddleware, selfOnlyMiddleware, tripMemberMiddleware
│       │   └── errorHandler.js          # Global error handler
│       ├── routes/
│       │   ├── auth.js                  # Google OAuth + JWT
│       │   ├── trips.js                 # Trips CRUD + members + itinerary
│       │   ├── users.js                 # User management
│       │   ├── accommodations.js        # Accommodations CRUD (with nested bedrooms/beds/images)
│       │   ├── bedrooms.js             # Bedrooms CRUD + upsert
│       │   ├── beds.js                 # Beds CRUD + assign + claim
│       │   ├── bedroomClaims.js        # Room claim request/confirm/remove
│       │   ├── activities.js           # Activities CRUD
│       │   ├── images.js              # Accommodation image management
│       │   ├── scrape.js              # Airbnb URL scraper
│       │   ├── proposals.js           # AI proposal CRUD
│       │   ├── agent.js               # AI chat endpoints + context building
│       │   └── ai-settings.js         # AI prompt settings CRUD
│       └── services/
│           ├── encryption.js           # AES-256-GCM budget encryption
│           └── scraper.js             # Airbnb page scraper
│
├── client/
│   ├── package.json
│   ├── vite.config.js                   # No @ alias configured
│   ├── index.html
│   └── src/
│       ├── main.js                      # App bootstrap
│       ├── App.vue                      # Root: header + sidebar + router-view + agent panel
│       ├── api/
│       │   └── client.js               # Axios with JWT interceptor
│       ├── assets/
│       │   └── main.css                # Tailwind import + scrollbar-hide utility
│       ├── composables/
│       │   └── useDarkMode.js          # Dark mode toggle
│       ├── stores/
│       │   ├── auth.js                 # Auth state + JWT + initialize()
│       │   ├── trip.js                 # Trip list + selectedTripId (persisted)
│       │   └── agent.js               # Action bus: pendingAction + lastActionResult
│       ├── router/
│       │   └── index.js                # Routes + auth guard
│       ├── components/
│       │   ├── layout/
│       │   │   ├── AppHeader.vue       # Top bar with trip selector + dark mode
│       │   │   ├── AppSidebar.vue      # Desktop sidebar + mobile tab bar + drawer
│       │   │   └── TripSelector.vue    # Trip dropdown
│       │   ├── accommodations/
│       │   │   ├── OverviewTab.vue     # Image carousel + stay info + costs + per-person breakdown
│       │   │   ├── BedroomsTab.vue     # Rooms, individual beds with claim buttons, claims, pricing
│       │   │   ├── AmenitiesTab.vue    # Amenity list
│       │   │   ├── LocationTab.vue     # Embedded Google Map
│       │   │   └── AttendeesTab.vue    # Trip member list
│       │   └── agent/
│       │       └── GlobalAgentPanel.vue # Floating chat panel (page-aware, action result feedback)
│       └── views/
│           ├── LoginView.vue
│           ├── AuthCallbackView.vue
│           ├── AccommodationsView.vue  # Tabbed accommodation page
│           ├── ActivitiesView.vue      # Activity cards grouped by date + form + Google Places
│           ├── ItineraryView.vue       # Merged timeline
│           ├── MapView.vue             # Google Map with geocoded pins (place_id → address → lat/lng fallback)
│           ├── UsersView.vue           # Admin: user management
│           ├── TravelAgentView.vue     # Admin: Q&A → proposal
│           └── AiSettingsView.vue      # Admin: edit prompts
```
