# TripPlanner Consultant Review
## Actionable Improvements for Claude Code

---

## REVIEWER 1: Business Analyst (Travel Industry)
*Background: Former travel guide, travel agent, Airbnb property manager*

### HIGH PRIORITY

#### 1. Suggested Activities Have No Approval Workflow
**Problem:** Non-admin users can submit "suggested" activities that get an amber badge, but there's no way for the admin to accept, reject, or discuss them. They just sit there.

**Action:**
- Add an `approval_status` column to activities: `pending`, `approved`, `rejected` (or repurpose `is_suggested` into a status enum)
- On the Activities page, show admin-only "Approve" / "Reject" buttons on suggested activities
- When approved, remove the suggested badge and treat as a normal activity
- Optionally notify the submitter (even just a visual indicator next to their suggestions)

#### 2. No Per-Person Cost Visibility
**Problem:** The app shows total accommodation cost but never breaks it down per person. This is the #1 question every trip member asks: "how much do I owe?"

**Action:**
- Compute and display `total_cost / member_count` on the OverviewTab
- Add a simple trip-level cost summary: accommodation cost per head + total estimated activity costs per head
- Consider the `price_share_adjustment` column on bedrooms — it exists but is never surfaced in the UI

#### 3. Bed Claiming UX is Agent-Only
**Problem:** The only way for a non-admin user to claim a bed is through the AI chat panel. There should be a direct UI path too — many users won't want to chat with an AI just to pick a bed.

**Action:**
- In BedroomsTab, show a "Claim This Bed" button on available beds when the current user has no bed assignment
- Keep the agent chat as an alternative path, not the only path
- Show current user's claimed bed highlighted with a "Your Bed" badge

#### 4. Activities Page Has No Day/Time Organization
**Problem:** Activities are listed in a flat list sorted by start_datetime. For a multi-day trip, this is hard to parse. Users can't visually see which day is packed vs. empty.

**Action:**
- Group activities by date with day headers ("Friday, April 10", "Saturday, April 11")
- Show a "No activities planned" placeholder for days with nothing scheduled
- Consider a simple timeline or time-slot view per day

#### 5. Itinerary is Read-Only with No Value-Add
**Problem:** The itinerary view shows a combined timeline but offers no interactivity. Users go there, see the same data as other pages, and leave.

**Action:**
- Add time gap detection: highlight 3+ hour gaps between activities as "free time"
- Show travel time estimates between consecutive activities (even rough drive time)
- Allow drag-and-drop reordering of activities on the same day

---

### MEDIUM PRIORITY

#### 6. No Group Preferences or Voting
**Problem:** Group trips involve compromise. Currently, one person (admin or via agent) picks activities with no input mechanism from the group.

**Action:**
- Add a simple thumbs-up/thumbs-down vote on suggested activities
- Show vote counts to admin to help prioritize
- The `ai_notes` per-user preferences are a good foundation — surface them as visible "interests" tags on the Users/Attendees page

#### 7. Map Only Geocodes Activities with google_place_id
**Problem:** In MapView, activities are only shown on the map if they have a `google_place_id`. Activities added via the agent chat (which often have an address but no place_id) don't appear.

**Action:**
- Fall back to address-based geocoding for activities without a google_place_id (same pattern used for accommodations)
- This is a ~10 line change in MapView.vue's `loadMap()` function


#### 8. Agent Chat Resets on Page Navigation
**Problem:** If a user is mid-conversation with the agent and accidentally navigates away, the entire conversation is lost. This is frustrating.

**Action:**
- Store conversation state per-page in the agent store (not just a single pendingAction)
- When navigating back to the same page, restore the previous conversation
- Add a "New Chat" button to explicitly reset instead of auto-resetting

---

### LOW PRIORITY / NICE-TO-HAVE

#### 9. No Shared Packing List
Most trip planners include a packing list feature. Low effort, high engagement.

#### 10. No Trip Countdown or Status Dashboard
A simple "Trip starts in 32 days" with completion indicators (accommodation booked ✓, activities planned ✓, beds assigned ✗) would help.

#### 11. Attendees Tab Doesn't Show Enough
The Attendees tab shows names but doesn't indicate who has claimed beds, who has suggested activities, or who hasn't engaged at all. Surface this data.

---

## REVIEWER 2: Senior Full-Stack Developer (AI/Claude Specialist)
*Background: Large-scale AI API integration, prompt engineering, efficient iteration*

### HIGH PRIORITY

#### 1. Consolidate Duplicate Prompt Infrastructure
**Problem:** There are now THREE places where AI prompts live:
- `ai_settings` DB table (migration 014) — editable activity chat prompts
- Migration 017 — hardcoded NO FABRICATION updates to DB prompts
- `getPageSystemPrompt()` in agent.js — inline global chat prompts with their own behavioral rules

The DB prompts and code prompts have separate NO FABRICATION rules that can drift. The voice prompt gets prepended in two different endpoints independently.

**Action:**
- Move ALL prompt templates into the `ai_settings` table with keys like `global_chat_accommodations_prompt`, `global_chat_activities_prompt`, etc.
- Create a single `buildSystemPrompt(promptKey, variables)` helper that:
  1. Reads the prompt template from DB (with hardcoded fallback)
  2. Prepends voice/tone
  3. Replaces `{{TRIP_CONTEXT}}`, `{{PAGE_CONTEXT}}`, `{{BEHAVIOR_RULES}}`
  4. Appends escalation suffix
- Store `BEHAVIOR_RULES` as its own `ai_settings` key so it's centrally maintained
- Update AiSettingsView to show ALL prompt templates (currently it only shows activity chat prompts)

#### 2. ActivityAgentChat Is Now Redundant
**Problem:** `ActivityAgentChat.vue` (the original modal chat) and the global panel's activities mode do the same thing but with separate endpoints (`/activity-chat` vs `/chat`), separate prompt pipelines, and separate UI components.

**Action:**
- Remove `ActivityAgentChat.vue` and the "Ask the Travel Agent" button from the add-activity form
- Remove the `/activity-chat` endpoint from agent.js
- The GlobalAgentPanel with `page: 'activities'` fully replaces this functionality
- This eliminates ~200 lines of duplicate code and one API endpoint

#### 3. Add Streaming Responses
**Problem:** Users stare at bouncing dots for 3-8 seconds while waiting for Claude. This feels broken, especially on Sonnet which can take 4-5s for complex prompts.

**Action:**
- Switch `anthropic.messages.create()` to `anthropic.messages.stream()` in the `/chat` endpoint
- Use Server-Sent Events (SSE) on the Express route: `res.writeHead(200, { 'Content-Type': 'text/event-stream' })`
- In GlobalAgentPanel, use `EventSource` or `fetch` with `ReadableStream` to render tokens as they arrive
- Parse the final complete message for JSON actions after stream ends
- This dramatically improves perceived responsiveness

#### 4. JSON Parsing Is Fragile
**Problem:** The current JSON extraction does `text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')` then `JSON.parse()`. This fails when:
- Claude includes a preamble before the JSON ("Sure! Here's the activity:")
- The JSON has trailing text after the closing brace
- Claude wraps it in markdown with extra whitespace

**Action:**
```javascript
function extractJSON(text) {
  // Try direct parse first
  try { return JSON.parse(text); } catch {}
  // Try stripping markdown fences
  const fenced = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '');
  try { return JSON.parse(fenced); } catch {}
  // Try extracting first { ... } or [ ... ] block
  const match = text.match(/\{[\s\S]*\}/);
  if (match) try { return JSON.parse(match[0]); } catch {}
  return null;
}
```
- Replace all three `try { JSON.parse(...) }` blocks with this shared utility
- Also consider using Claude's `tool_use` feature instead of asking for raw JSON — it's more reliable and the SDK handles parsing

#### 5. No Trip Membership Validation on Agent Endpoints
**Problem:** `POST /agent/chat` only checks `authMiddleware` — any authenticated user can chat about any trip by passing any `tripId`. Same for `POST /beds/:id/claim` — no verification the user belongs to the trip that owns that bed.

**Action:**
- Create a `tripMemberMiddleware(tripIdSource)` that verifies `req.user.user_id` is in `trip_members` for the given trip
- Apply to `/agent/chat`, `/activity-chat`, and `/beds/:id/claim`
- This is a security issue — a user could claim beds in trips they're not part of

#### 6. Switch User Notes Generation to Haiku
**Problem:** `generateUserNote()` uses Sonnet for a simple 1-3 sentence summary. This is wasteful — it's a fire-and-forget background task that doesn't need Sonnet's reasoning.

**Action:**
- Change `generateUserNote()` model to `claude-haiku-235-20250414`
- Reduce max_tokens from 200 to 150
- This cuts cost by ~90% for this call with no quality loss for such a simple task

---

### MEDIUM PRIORITY

#### 7. No Error Feedback on Agent Actions
**Problem:** When the agent dispatches an action (claim-bed, add-activity), the panel closes immediately. If the API call fails (bed already taken, validation error), the user sees nothing — the page view catches the error with `console.error` and moves on.

**Action:**
- Don't close the panel immediately on confirm — wait for the action to complete
- Add a `lastActionResult` to the agent store: `{ success: boolean, message: string }`
- Page views set this after executing the action
- Panel watches it and shows a success toast or error message before closing
- For claim-bed specifically, show "Bed claimed!" or "Sorry, that bed was just taken by someone else"

#### 8. Cache Trip Context Between Messages
**Problem:** Every single message in a conversation triggers fresh `buildTripContext()` + `buildPageContext()` DB queries. For a 10-message conversation, that's 10 identical sets of queries.

**Action:**
- Add a simple in-memory cache keyed by `tripId` with a 60-second TTL
- `buildTripContext` checks cache first, returns cached if fresh
- Invalidate on any POST/PUT/DELETE to activities, accommodations, beds
- This eliminates ~80% of redundant DB reads during active conversations

#### 9. Token Tracking / Cost Visibility
**Problem:** There's no visibility into AI API usage. The admin has no idea how much the agent is costing or how it's being used.

**Action:**
- Log `response.usage.input_tokens` and `response.usage.output_tokens` after each API call
- Create an `ai_usage` table: `(id, user_id, endpoint, model, input_tokens, output_tokens, created_at)`
- Add a simple usage dashboard to AiSettingsView: total tokens this week, cost estimate, calls per user
- This pays for itself by catching runaway usage early

#### 10. Consider Tool Use Instead of Raw JSON Prompting
**Problem:** You're instructing Claude to output structured JSON and then manually parsing it. Anthropic's `tool_use` feature is built exactly for this — Claude returns structured data via a tool call that the SDK automatically validates and parses.

**Action:**
- Define tools for each action type:
```javascript
tools: [{
  name: "claim_bed",
  description: "Claim a specific bed for the user",
  input_schema: {
    type: "object",
    properties: {
      bedId: { type: "number" },
      description: { type: "string" }
    },
    required: ["bedId"]
  }
}, {
  name: "add_activity",
  description: "Pre-fill activity form with suggested activity",
  input_schema: { /* formData schema */ }
}, {
  name: "center_map",
  description: "Center the map on a location",
  input_schema: {
    type: "object",
    properties: { query: { type: "string" } },
    required: ["query"]
  }
}]
```
- Claude returns a `tool_use` content block when it wants to take an action, and a `text` block for conversation
- Eliminates JSON parsing entirely — the SDK handles it
- More reliable than hoping Claude outputs valid JSON in the text

---

### LOW PRIORITY / CODE QUALITY

#### 11. Extract Shared Chat Component
`ActivityAgentChat.vue` (if kept) and `GlobalAgentPanel.vue` share ~70% identical code: message rendering, typing indicator, input handling, API call pattern. Extract a `BaseChatPanel.vue` with slots for header and action cards.

#### 12. View Files Are Too Large
`ActivitiesView.vue` (~235 lines of script) and `AccommodationsView.vue` (~290 lines) handle forms, API calls, Google Places, and rendering all in one file. Extract:
- Form logic into composables (`useActivityForm`, `useAccommodationForm`)
- Google Places into a shared `usePlacesSearch` composable (currently duplicated between both views)

#### 13. Inline SVG Icons Should Be Components
Every icon is an inline `<svg>` block. Create a simple `<Icon name="edit" />` component or use an icon library. This reduces template noise and makes icons reusable.

#### 14. OverviewTab Image Carousel Has No Keyboard Support
The image carousel in OverviewTab.vue only has click handlers — no arrow key navigation, no swipe on mobile, no alt text on images.

---

## PRIORITY MATRIX

| # | Item | Impact | Effort | Who |
|---|------|--------|--------|-----|
| BA-1 | Suggested activity approval workflow | High | Medium | Both |
| BA-3 | Direct bed claiming UI | High | Low | Dev |
| T-2 | Remove redundant ActivityAgentChat | High | Low | Dev |
| T-5 | Trip membership validation | High | Low | Dev |
| T-4 | Robust JSON parsing | High | Low | Dev |
| T-6 | Haiku for user notes | High | Trivial | Dev |
| BA-2 | Per-person cost breakdown | High | Low | Dev |
| BA-7 | Map geocode fallback for addresses | Medium | Low | Dev |
| T-1 | Consolidate prompt infrastructure | Medium | Medium | Dev |
| T-3 | Streaming responses | Medium | Medium | Dev |
| BA-4 | Group activities by day | Medium | Low | Dev |
| T-7 | Error feedback on agent actions | Medium | Low | Dev |
| T-10 | Tool use instead of JSON parsing | Medium | Medium | Dev |
| BA-9 | Preserve chat on page nav | Medium | Low | Dev |
| BA-8 | Accommodation notes/house rules | Low | Low | Dev |
| T-8 | Cache trip context | Low | Low | Dev |
| BA-6 | Activity voting | Low | Medium | Both |
| T-9 | Token/cost tracking | Low | Medium | Dev |
