# TripPlanner — Architecture Reference

## Tech Stack
- **Client:** Vue 3 + Vite + Tailwind CSS v4 (port 5173)
- **Server:** Node.js + Express, ES modules (port 3000)
- **Database:** SQLite via sql.js (WASM, in-memory with auto-save to disk)
- **Auth:** Google OAuth 2.0 + JWT + Passport (or `AUTH_BYPASS=true` for dev)
- **Maps:** Google Maps JavaScript API + Places API
- **AI:** Anthropic Claude API with tool_use (Sonnet for chat, Haiku for background tasks); optional Ollama support

## Dev Commands
```
npm run dev          # AUTH_BYPASS=true, auto-login as Alex (admin)
npm run dev:auth     # Full Google OAuth flow
npm run db:reset     # Drop all → migrate → seed
npm run db:migrate   # Run pending migrations only
npm run db:seed      # Seed test data only
npm run build        # Build client for production
npm run start        # Start server with AUTH_BYPASS=true
npm run start:prod   # Start server with full auth
```

**No test framework or linter is configured.** No eslint, prettier, jest, or vitest.

## Key Decisions & Pitfalls
- **sql.js** (not better-sqlite3): No native compilation needed. Must use `new Uint8Array(buffer)` when loading DB files. Helpers: `getDb()`, `saveDb()`, `all()`, `get()`, `run()` in `server/src/db/connection.js`
- **No `@` alias**: Vite config does NOT set up `@` path alias. All imports use **relative paths** (e.g. `../../stores/agent`)
- **Bedrooms table**: Column is `name` (NOT `bedroom_name`), no `bedroom_type` column
- **Accommodations**: No `latitude`/`longitude` columns — only activities and eats have geo coords
- **DB auto-save**: Middleware in `index.js` calls `saveDb()` after every POST/PUT/PATCH/DELETE response
- **Bed requests replaced bedroom claims**: The old `bedroom_claims` table and route file (`bedroomClaims.js`) are obsolete. The system now uses `bed_requests` (migration 025) with a request→confirm workflow. `bedroomClaims.js` still exists on disk but is NOT registered in `index.js`.
- **No `.env.example`**: Config is loaded via environment variables in `server/src/config/env.js`

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
  trip_id, trip_name, start_date, end_date,
  color (green|red|yellow|purple), description, image_url

trip_members
  trip_id → trips, user_id → users (composite PK),
  rsvp_status (yes|no|pending), arrival_date, departure_date

accommodations
  accommodation_id, trip_id → trips, description, address,
  airbnb_id, airbnb_url, check_in_datetime, check_out_datetime, total_cost

bedrooms
  bedroom_id, accommodation_id → accommodations, name, price_share_adjustment

beds
  bed_id, bedroom_id → bedrooms, bed_type, assigned_user_id → users

bed_requests
  request_id, bed_id → beds, user_id → users,
  status (requested|confirmed), created_at
  UNIQUE(bed_id, user_id) — supports couples sharing beds

accommodation_images
  image_id, accommodation_id → accommodations, bedroom_id → bedrooms (nullable),
  image_url, sort_order

activities
  activity_id, trip_id → trips, title, description, address,
  google_place_id, image_url, latitude, longitude, rating,
  start_datetime, end_datetime, estimated_cost, duration, source_url,
  is_suggested, created_at

eats
  eat_id, trip_id → trips, title, description, address,
  google_place_id, image_url, latitude, longitude, rating,
  start_datetime, end_datetime, estimated_cost, duration, source_url,
  is_suggested, created_at

trip_transportation
  transport_id, trip_id → trips, user_id → users,
  mode, departure_from, arrival_datetime, return_datetime,
  flight_number, car_capacity, notes, created_at

proposals
  proposal_id, trip_id → trips, proposal_name, proposal_text, estimated_cost

ai_settings
  key (PK), value, updated_at
  Keys: agent_voice_prompt, behavior_rules,
        global_chat_accommodations_prompt, global_chat_activities_prompt,
        global_chat_itinerary_prompt, global_chat_map_prompt,
        llm_provider, ollama_base_url, ollama_model
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
| GET | /:id | auth | Get with bedrooms/beds/images/requests |
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

### Bed Requests (`/api/bed-requests`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /accommodation/:accommodationId | auth | List requests for accommodation |
| POST | / | auth+member | Create a bed request |
| PUT | /:id/confirm | admin | Confirm a request |
| DELETE | /:id | auth | Withdraw/delete request |

### Activities (`/api/activities`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /trip/:tripId | auth | List for trip |
| GET | /:id | auth | Get single |
| POST | / | auth | Create (non-admin → is_suggested=1) |
| PUT | /:id | admin | Update |
| DELETE | /:id | admin | Delete |

### Eats (`/api/eats`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /trip/:tripId | auth | List for trip |
| GET | /:id | auth | Get single |
| POST | / | auth | Create (non-admin → is_suggested=1) |
| PUT | /:id | admin | Update |
| DELETE | /:id | admin | Delete |

### Transportation (`/api/trips/:tripId/transportation`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | / | auth+member | List transport entries for trip |
| POST | / | auth+member | Create transport entry (self or admin for others) |
| PUT | /:id | auth | Update own entry (admin can update any) |
| DELETE | /:id | auth | Delete own entry (admin can delete any) |

### Agent (`/api/agent`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /preview-context | admin | View formatted trip context |
| GET | /test-llm | admin | Test Ollama connection |
| POST | /chat | auth+member | Global agent chat (page-aware, tool_use) |
| POST | /questions | admin | Generate screening questions |
| POST | /proposal | admin | Generate trip proposal |
| POST | /generate-description | admin | Generate trip description |

### Other
| Route | Auth | Purpose |
|-------|------|---------|
| `/api/images` | admin | CRUD for accommodation images |
| `/api/scrape` | admin | Scrape Airbnb listing |
| `/api/proposals` | admin | CRUD for saved proposals |
| `/api/ai-settings` | admin | CRUD for AI prompt settings |
| `/api/users` | varies | User management |

---

## Client Architecture

### Pages (Views)
| Route | View | Auth | Description |
|-------|------|------|-------------|
| `/login` | LoginView | guest | Google OAuth login |
| `/auth/callback` | AuthCallbackView | guest | OAuth callback handler |
| `/` | — | — | Redirects to `/overview` |
| `/overview` | OverviewView | auth | Trip dashboard |
| `/accommodations` | AccommodationsView | auth | Tabbed accommodation manager |
| `/activities` | ActivitiesView | auth | Activity cards grouped by date |
| `/eats` | EatsView | auth | Restaurant/meal planning |
| `/itinerary` | ItineraryView | auth | Merged timeline view |
| `/map` | MapView | auth | Google Map with pins |
| `/attendees` | AttendeesView | auth | Trip member/guest management |
| `/logistics` | LogisticsView | auth | Transportation management |
| `/trips` | TripsView | admin | Trip management |
| `/users` | UsersView | admin | User management |
| `/travel-agent` | TravelAgentView | admin | Q&A → proposal flow |
| `/ai-settings` | AiSettingsView | admin | Edit AI prompts |

### Component Hierarchy
```
App.vue
├── AppHeader.vue (top bar, TripSelector, dark mode)
├── AppSidebar.vue (desktop sidebar + mobile tab bar + drawer)
├── GlobalAgentPanel.vue (floating chat panel, all pages)
└── <router-view>
    ├── OverviewView (trip dashboard)
    ├── AccommodationsView
    │   ├── OverviewTab (image carousel, stay info, cost)
    │   ├── BedroomsTab (rooms, beds, bed requests, pricing)
    │   ├── LivingSpaceTab (shared living areas)
    │   ├── AmenitiesTab
    │   ├── LocationTab (embedded map)
    │   └── AttendeesTab (trip members)
    ├── ActivitiesView (cards + add/edit form + Google Places)
    ├── EatsView (restaurant cards + form + Google Places)
    ├── ItineraryView (grouped timeline)
    ├── MapView (Google Map + geocoded pins)
    ├── AttendeesView (guest list + RSVP + travel dates)
    └── LogisticsView (transportation entries)
```

### Stores (Pinia)
| Store | Key State | Purpose |
|-------|-----------|---------|
| `auth` | user, isAuthenticated, isAdmin | Auth state, JWT token |
| `trip` | trips, selectedTripId (persisted) | Trip selection |
| `agent` | pendingAction, lastActionResult | Agent ↔ page action bus |

### Composables
| Composable | Purpose |
|------------|---------|
| `useDarkMode` | Dark mode toggle |
| `useTripColor` | Trip color theming (sets CSS variables for accent colors based on trip color) |

### Utilities
| File | Purpose |
|------|---------|
| `api/client.js` | Axios instance with JWT interceptor |
| `mapsLoader.js` | Google Maps API loader helper |

### Agent Action Flow
```
GlobalAgentPanel → POST /agent/chat → Claude tool_use loop (agentTools.js)
                 → Response with optional action JSON
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
- `claude-sonnet-4-20250514` — Chat (with tool_use), questions, proposals, LLM client
- `claude-haiku-235-20250414` — `generateUserNote()` (fire-and-forget background task)

### LLM Provider Abstraction (`llmClient.js`)
- **Claude (default):** Uses Anthropic SDK with `tool_use` loop — calls tools from `agentTools.js`, executes them, feeds results back until Claude produces a final text response
- **Ollama (optional):** OpenAI-compatible API via `openai` npm package. Configured via `ai_settings` table keys: `llm_provider`, `ollama_base_url`, `ollama_model`. No tool support in Ollama mode.

### Agent Tools (`agentTools.js`)
40+ structured tools passed to Claude's `tool_use` API. Categories:
- **Trip overview:** `get_trip_overview`
- **Members & profiles:** `get_trip_members`, `get_member_profiles`, `get_user_bed`, `get_user_preferences`
- **Accommodations & rooms:** `get_accommodation_details`, `get_bed_availability`, `get_unassigned_beds`, `get_bed_requests`, `get_bedroom_pricing`
- **Activities & eats:** `get_activities`, `get_eats`, `search_activities`, `search_eats`
- Each tool has an `input_schema` and is executed via `executeTool()` which queries the DB directly

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
├── TRIP_OVERVIEW.md                      # Seed data trip details
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
│       │       └── 001-026_*.sql        # Schema migrations
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
│       │   ├── bedRequests.js          # Bed request/confirm/withdraw (replaces bedroomClaims)
│       │   ├── bedroomClaims.js        # ⚠️ OBSOLETE — not registered in index.js
│       │   ├── activities.js           # Activities CRUD
│       │   ├── eats.js                 # Eats/restaurants CRUD (mirrors activities)
│       │   ├── transportation.js       # Transportation entries per trip member
│       │   ├── images.js              # Accommodation image management
│       │   ├── scrape.js              # Airbnb URL scraper
│       │   ├── proposals.js           # AI proposal CRUD
│       │   ├── agent.js               # AI chat endpoints + context building
│       │   └── ai-settings.js         # AI prompt settings CRUD
│       └── services/
│           ├── agentTools.js           # 40+ Claude tool_use definitions + executeTool()
│           ├── llmClient.js            # LLM abstraction (Claude with tools / Ollama)
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
│       │   ├── useDarkMode.js          # Dark mode toggle
│       │   └── useTripColor.js         # Trip color theming (CSS variables)
│       ├── stores/
│       │   ├── auth.js                 # Auth state + JWT + initialize()
│       │   ├── trip.js                 # Trip list + selectedTripId (persisted)
│       │   └── agent.js               # Action bus: pendingAction + lastActionResult
│       ├── router/
│       │   └── index.js                # Routes + auth guard + admin guard
│       ├── components/
│       │   ├── layout/
│       │   │   ├── AppHeader.vue       # Top bar with trip selector + dark mode
│       │   │   ├── AppSidebar.vue      # Desktop sidebar + mobile tab bar + drawer
│       │   │   └── TripSelector.vue    # Trip dropdown
│       │   ├── accommodations/
│       │   │   ├── OverviewTab.vue     # Image carousel + stay info + costs + per-person breakdown
│       │   │   ├── BedroomsTab.vue     # Rooms, individual beds with request buttons, pricing
│       │   │   ├── LivingSpaceTab.vue  # Shared living areas
│       │   │   ├── AmenitiesTab.vue    # Amenity list
│       │   │   ├── LocationTab.vue     # Embedded Google Map
│       │   │   └── AttendeesTab.vue    # Trip member list
│       │   └── agent/
│       │       └── GlobalAgentPanel.vue # Floating chat panel (page-aware, action result feedback)
│       └── views/
│           ├── LoginView.vue
│           ├── AuthCallbackView.vue
│           ├── OverviewView.vue        # Trip dashboard
│           ├── AccommodationsView.vue  # Tabbed accommodation page
│           ├── ActivitiesView.vue      # Activity cards grouped by date + form + Google Places
│           ├── EatsView.vue            # Restaurant/meal planning
│           ├── ItineraryView.vue       # Merged timeline
│           ├── MapView.vue             # Google Map with geocoded pins
│           ├── AttendeesView.vue       # Guest management + RSVP + travel dates
│           ├── LogisticsView.vue       # Transportation management
│           ├── TripsView.vue           # Admin: trip management
│           ├── UsersView.vue           # Admin: user management
│           ├── TravelAgentView.vue     # Admin: Q&A → proposal
│           └── AiSettingsView.vue      # Admin: edit prompts
```
