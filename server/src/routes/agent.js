import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { authMiddleware, adminMiddleware, tripMemberMiddleware } from '../middleware/auth.js';
import { getDb, all, get, run } from '../db/connection.js';
import { decrypt } from '../services/encryption.js';
import config from '../config/env.js';
import { callChatLLM, testOllamaConnection } from '../services/llmClient.js';

const router = Router();
// Don't pass apiKey: undefined — SDK throws instead of falling back to env var
const anthropic = new Anthropic(config.anthropicApiKey ? { apiKey: config.anthropicApiKey } : {});

// ---------------------------------------------------------------------------
// Shared utility: robust JSON extraction from Claude responses
// ---------------------------------------------------------------------------

function extractJSON(text) {
  // 1. Direct parse
  try { return JSON.parse(text); } catch {}
  // 2. Strip markdown code fences
  const fenced = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '');
  try { return JSON.parse(fenced); } catch {}
  // 3. Extract first { ... } block (handles preamble/trailing text)
  const match = text.match(/\{[\s\S]*\}/);
  if (match) try { return JSON.parse(match[0]); } catch {}
  // 4. Try extracting array [ ... ]
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) try { return JSON.parse(arrMatch[0]); } catch {}
  return null;
}

// ---------------------------------------------------------------------------
// Trip context helpers
// ---------------------------------------------------------------------------

async function buildTripContext(tripId) {
  const db = await getDb();
  const trip = get(db, 'SELECT * FROM trips WHERE trip_id = ?', [tripId]);
  if (!trip) return null;

  const members = all(db,
    `SELECT u.first_name, u.last_name, u.ai_notes,
            tm.rsvp_status, tm.arrival_date, tm.departure_date
     FROM trip_members tm
     JOIN users u ON tm.user_id = u.user_id
     WHERE tm.trip_id = ?`,
    [tripId]
  );

  const accommodations = all(db,
    `SELECT description, address, check_in_datetime, check_out_datetime, total_cost
     FROM accommodations WHERE trip_id = ?`,
    [tripId]
  );

  const activities = all(db,
    `SELECT title, description, address, start_datetime, estimated_cost, duration, is_suggested
     FROM activities WHERE trip_id = ? ORDER BY start_datetime`,
    [tripId]
  );

  const eats = all(db,
    `SELECT title, description, address, start_datetime, estimated_cost, duration, is_suggested
     FROM eats WHERE trip_id = ? ORDER BY start_datetime`,
    [tripId]
  );

  const existingProposals = all(db,
    'SELECT proposal_name FROM proposals WHERE trip_id = ?',
    [tripId]
  );

  const gearItems = all(db,
    `SELECT gi.description, gi.quantity,
            COALESCE(SUM(gc.quantity), 0) AS total_claimed
     FROM gear_items gi
     LEFT JOIN gear_claims gc ON gi.item_id = gc.item_id
     WHERE gi.trip_id = ?
     GROUP BY gi.item_id`,
    [tripId]
  );

  return { trip, members, accommodations, activities, eats, existingProposals, gearItems };
}

function formatContextForClaude(ctx) {
  const { trip, members, accommodations, activities, eats, existingProposals, gearItems } = ctx;
  const lines = [
    `Trip: ${trip.trip_name}`,
    `Dates: ${trip.start_date} to ${trip.end_date}`,
  ];

  // Group members — include RSVP status, dates, and known interests
  const confirmed = members.filter(m => m.rsvp_status === 'yes').length;
  const memberDetails = members.map(m => {
    const name = `${m.first_name} ${m.last_name}`.trim();
    const parts = [name];
    if (m.rsvp_status === 'yes') {
      if (m.arrival_date || m.departure_date) {
        parts.push(`attending ${m.arrival_date || '?'} to ${m.departure_date || '?'}`);
      } else {
        parts.push('confirmed');
      }
    } else if (m.rsvp_status === 'no') {
      parts.push('not attending');
    } else {
      parts.push('pending RSVP');
    }
    if (m.ai_notes) parts.push(m.ai_notes);
    return parts.join(' — ');
  });
  lines.push(`Group (${members.length} invited, ${confirmed} confirmed): ${memberDetails.join('; ')}`);

  // Accommodation
  if (accommodations.length) {
    accommodations.forEach(a => {
      const parts = [`Accommodation: ${a.address || 'TBD'}`];
      if (a.description) parts.push(`— ${a.description}`);
      if (a.check_in_datetime) parts.push(`| check-in ${a.check_in_datetime}`);
      if (a.check_out_datetime) parts.push(`check-out ${a.check_out_datetime}`);
      if (a.total_cost) parts.push(`| $${a.total_cost} total`);
      lines.push(parts.join(' '));
    });
  }

  // Planned activities (with details)
  if (activities.length) {
    lines.push(`\nPlanned activities (${activities.length}):`);
    activities.forEach(a => {
      const parts = [`- ${a.title}`];
      if (a.description) parts.push(`— ${a.description}`);
      if (a.address) parts.push(`@ ${a.address}`);
      if (a.start_datetime) parts.push(`| ${a.start_datetime}`);
      if (a.estimated_cost) parts.push(`| ~$${a.estimated_cost}`);
      if (a.duration) parts.push(`| ${a.duration}h`);
      if (a.is_suggested) parts.push(`(suggested)`);
      lines.push(parts.join(' '));
    });
  }

  // Dining plans
  if (eats?.length) {
    lines.push(`\nDining plans (${eats.length}):`);
    eats.forEach(e => {
      const parts = [`- ${e.title}`];
      if (e.description) parts.push(`— ${e.description}`);
      if (e.address) parts.push(`@ ${e.address}`);
      if (e.start_datetime) parts.push(`| ${e.start_datetime}`);
      if (e.estimated_cost) parts.push(`| ~$${e.estimated_cost}/pp`);
      if (e.duration) parts.push(`| ${e.duration}h`);
      if (e.is_suggested) parts.push(`(suggested)`);
      lines.push(parts.join(' '));
    });
  }

  if (existingProposals.length) {
    lines.push(`\nAlready proposed: ${existingProposals.map(p => p.proposal_name).join(', ')}`);
  }

  if (gearItems?.length) {
    const unclaimed = gearItems.filter(g => g.total_claimed < g.quantity);
    lines.push(`\nGear list (${gearItems.length} items, ${unclaimed.length} still need volunteers):`);
    gearItems.forEach(g => {
      const status = g.total_claimed >= g.quantity ? 'COVERED' : `${g.total_claimed}/${g.quantity} claimed`;
      lines.push(`- ${g.description}: ${status}`);
    });
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Fire-and-forget: generate/update AI interest notes for a user
// ---------------------------------------------------------------------------

async function generateUserNote(userId, messages, formData) {
  try {
    const db = await getDb();
    const user = get(db, 'SELECT first_name, ai_notes FROM users WHERE user_id = ?', [userId]);
    const existing = user?.ai_notes || '';
    const convo = messages
      .map(m => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.content}`)
      .join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-haiku-235-20250414',
      max_tokens: 150,
      system: `Based on a travel activity chat conversation, write a brief 1-3 sentence note capturing this user's activity preferences, interests, and travel style — things that would help future activity recommendations. If existing notes are provided, update and merge them. Return ONLY the note text, nothing else.`,
      messages: [{
        role: 'user',
        content: `${existing ? `Existing notes about this user: ${existing}\n\n` : ''}Conversation:\n${convo}\n\nActivity they ended up with: ${formData?.title}${formData?.description ? ` — ${formData.description}` : ''}`,
      }],
    });

    const note = response.content[0].text.trim();
    run(db, 'UPDATE users SET ai_notes = ? WHERE user_id = ?', [note, userId]);
    console.log(`Updated AI notes for user ${userId}: ${note}`);
  } catch (err) {
    console.error('generateUserNote failed:', err.message);
  }
}

// ---------------------------------------------------------------------------
// GET /api/agent/preview-context — returns formatted trip context (admin)
// ---------------------------------------------------------------------------

router.get('/preview-context', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { tripId } = req.query;
    if (!tripId) return res.status(400).json({ success: false, error: { message: 'tripId required' } });
    const ctx = await buildTripContext(tripId);
    if (!ctx) return res.status(404).json({ success: false, error: { message: 'Trip not found' } });
    res.json({ success: true, data: { context: formatContextForClaude(ctx) } });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// ---------------------------------------------------------------------------
// POST /api/agent/chat — Global travel agent (all users, page-aware)
// ---------------------------------------------------------------------------

async function buildPageContext(page, tripId) {
  const db = await getDb();
  switch (page) {
    case 'accommodations': {
      const beds = all(db,
        `SELECT b.bed_id, b.bed_type,
                br.bedroom_id, br.name AS bedroom_name,
                a.accommodation_id, a.description AS accommodation_name
         FROM beds b
         JOIN bedrooms br ON b.bedroom_id = br.bedroom_id
         JOIN accommodations a ON br.accommodation_id = a.accommodation_id
         WHERE a.trip_id = ?
         ORDER BY a.accommodation_id, br.bedroom_id, b.bed_id`,
        [tripId]
      );
      for (const bed of beds) {
        bed.requests = all(db,
          `SELECT breq.request_id, breq.status, u.first_name, u.last_name, u.user_id
           FROM bed_requests breq JOIN users u ON breq.user_id = u.user_id
           WHERE breq.bed_id = ?
           ORDER BY breq.status DESC, breq.created_at`,
          [bed.bed_id]
        );
      }
      return { beds };
    }
    case 'activities': {
      const activities = all(db,
        `SELECT title, description, address, start_datetime, estimated_cost, duration, is_suggested
         FROM activities WHERE trip_id = ? ORDER BY start_datetime`,
        [tripId]
      );
      return { activities };
    }
    case 'itinerary': {
      const activities = all(db,
        `SELECT title, description, address, start_datetime, estimated_cost, duration
         FROM activities WHERE trip_id = ? ORDER BY start_datetime`,
        [tripId]
      );
      const accommodations = all(db,
        `SELECT description, address, check_in_datetime, check_out_datetime
         FROM accommodations WHERE trip_id = ?`,
        [tripId]
      );
      return { activities, accommodations };
    }
    case 'eats': {
      const eats = all(db,
        `SELECT title, description, address, start_datetime, estimated_cost, duration, is_suggested
         FROM eats WHERE trip_id = ? ORDER BY start_datetime`,
        [tripId]
      );
      return { eats };
    }
    case 'map': {
      const activities = all(db,
        `SELECT title, address, latitude, longitude FROM activities WHERE trip_id = ?`,
        [tripId]
      );
      const accommodations = all(db,
        `SELECT description, address FROM accommodations WHERE trip_id = ?`,
        [tripId]
      );
      const eats = all(db,
        `SELECT title, address, latitude, longitude FROM eats WHERE trip_id = ?`,
        [tripId]
      );
      return { activities, accommodations, eats };
    }
    case 'attendees': {
      const members = all(db,
        `SELECT u.user_id, u.first_name, u.last_name, u.email,
                tm.rsvp_status, tm.arrival_date, tm.departure_date
         FROM trip_members tm
         JOIN users u ON tm.user_id = u.user_id
         WHERE tm.trip_id = ?
         ORDER BY u.first_name`,
        [tripId]
      );
      return { members };
    }
    case 'overview': {
      return {};
    }
    case 'logistics': {
      const transport = all(db,
        `SELECT t.transport_id, t.user_id, t.mode, t.departure_from, t.arrival_datetime,
                t.return_datetime, t.flight_number, t.car_capacity, t.notes,
                u.first_name, u.last_name
         FROM trip_transportation t
         JOIN users u ON t.user_id = u.user_id
         WHERE t.trip_id = ?
         ORDER BY t.arrival_datetime`,
        [tripId]
      );
      const members = all(db,
        `SELECT u.user_id, u.first_name, u.last_name
         FROM trip_members tm
         JOIN users u ON tm.user_id = u.user_id
         WHERE tm.trip_id = ?`,
        [tripId]
      );
      return { transport, members };
    }
    case 'gear': {
      const gearItems = all(db,
        `SELECT gi.*, u.first_name || ' ' || u.last_name AS creator_name
         FROM gear_items gi
         LEFT JOIN users u ON gi.created_by = u.user_id
         WHERE gi.trip_id = ?
         ORDER BY gi.created_at DESC`,
        [tripId]
      );
      for (const item of gearItems) {
        item.claims = all(db,
          `SELECT u.first_name || ' ' || u.last_name AS name, gc.quantity
           FROM gear_claims gc JOIN users u ON gc.user_id = u.user_id
           WHERE gc.item_id = ?`,
          [item.item_id]);
      }
      return { gearItems };
    }
    default:
      return {};
  }
}

function formatPageContext(page, pageData) {
  const lines = [];
  switch (page) {
    case 'accommodations': {
      const { beds } = pageData;
      if (beds?.length) {
        lines.push('\nDetailed bed availability (for helping user choose and request a bed):');
        let lastAccom = null;
        beds.forEach(b => {
          if (b.accommodation_name !== lastAccom) {
            lines.push(`  ${b.accommodation_name || 'Accommodation'}:`);
            lastAccom = b.accommodation_name;
          }
          let status = 'AVAILABLE';
          if (b.requests?.length) {
            const confirmed = b.requests.filter(r => r.status === 'confirmed');
            const pending = b.requests.filter(r => r.status === 'requested');
            const parts = [];
            if (confirmed.length) parts.push(`Confirmed: ${confirmed.map(r => `${r.first_name} ${r.last_name}`).join(', ')}`);
            if (pending.length) parts.push(`Requested by: ${pending.map(r => `${r.first_name} ${r.last_name}`).join(', ')}`);
            if (parts.length) status = parts.join(' | ');
          }
          lines.push(`    - Bed #${b.bed_id} | ${b.bed_type} | ${b.bedroom_name} | ${status}`);
        });
      }
      break;
    }
    case 'eats': {
      const { eats } = pageData;
      if (eats?.length) {
        lines.push('\nCurrent dining plans:');
        eats.forEach(e => {
          const parts = [`- ${e.title}`];
          if (e.description) parts.push(`— ${e.description}`);
          if (e.address) parts.push(`@ ${e.address}`);
          if (e.start_datetime) parts.push(`| ${e.start_datetime}`);
          if (e.estimated_cost) parts.push(`| ~$${e.estimated_cost}/pp`);
          if (e.duration) parts.push(`| ${e.duration}h`);
          if (e.is_suggested) parts.push(`(suggested)`);
          lines.push(parts.join(' '));
        });
      } else {
        lines.push('\nNo dining plans added yet.');
      }
      break;
    }
    case 'map': {
      const { activities, accommodations, eats } = pageData;
      lines.push('\nLocations currently on map:');
      accommodations?.forEach(a => lines.push(`  - Accommodation: ${a.address || 'no address'}`));
      activities?.forEach(a => lines.push(`  - Activity: ${a.title} @ ${a.address || 'no address'}`));
      eats?.forEach(e => lines.push(`  - Dining: ${e.title} @ ${e.address || 'no address'}`));
      break;
    }
    case 'attendees': {
      const { members } = pageData;
      if (members?.length) {
        lines.push('\nTrip attendees:');
        members.forEach(m => {
          const rsvp = m.rsvp_status === 'yes' ? 'Confirmed' : m.rsvp_status === 'no' ? 'Declined' : 'Pending';
          const dates = [];
          if (m.arrival_date) dates.push(`arrives ${m.arrival_date}`);
          if (m.departure_date) dates.push(`departs ${m.departure_date}`);
          const dateStr = dates.length ? ` (${dates.join(', ')})` : '';
          lines.push(`- ${m.first_name} ${m.last_name} — ${rsvp}${dateStr}`);
        });
      } else {
        lines.push('\nNo attendees added yet.');
      }
      break;
    }
    case 'overview':
      break;
    case 'logistics': {
      const { transport, members } = pageData;
      if (transport?.length) {
        lines.push('\nCurrent transport plans:');
        transport.forEach(t => {
          const parts = [`- ${t.first_name} ${t.last_name} (user_id ${t.user_id}): ${t.mode}`];
          if (t.departure_from) parts.push(`from ${t.departure_from}`);
          if (t.arrival_datetime) parts.push(`| arrives ${t.arrival_datetime}`);
          if (t.return_datetime) parts.push(`| departs ${t.return_datetime}`);
          if (t.flight_number) parts.push(`| flight ${t.flight_number}`);
          if (t.car_capacity) parts.push(`| ${t.car_capacity} seats`);
          if (t.notes) parts.push(`| ${t.notes}`);
          lines.push(parts.join(' '));
        });
      } else {
        lines.push('\nNo transport plans added yet.');
      }
      const transportUserIds = new Set((transport || []).map(t => t.user_id));
      const unplanned = (members || []).filter(m => !transportUserIds.has(m.user_id));
      if (unplanned.length) {
        lines.push(`\nMembers without transport plans: ${unplanned.map(m => `${m.first_name} ${m.last_name} (user_id ${m.user_id})`).join(', ')}`);
      }
      break;
    }
    case 'gear': {
      const { gearItems } = pageData;
      if (gearItems?.length) {
        lines.push('\nGear/supply list:');
        gearItems.forEach(g => {
          const claimed = g.claims?.reduce((s, c) => s + c.quantity, 0) || 0;
          const status = claimed >= g.quantity ? 'FULLY CLAIMED' : `${claimed}/${g.quantity} claimed`;
          const claimers = g.claims?.length ? ` (by ${g.claims.map(c => `${c.name}: ${c.quantity}`).join(', ')})` : '';
          lines.push(`- ${g.description}: need ${g.quantity}, ${status}${claimers}`);
          if (g.notes) lines.push(`  Notes: ${g.notes}`);
        });
      } else {
        lines.push('\nNo gear items added yet.');
      }
      break;
    }
    default:
      break; // activities & itinerary already covered in main trip context
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Per-user context — loads encrypted context from DB for personalization
// ---------------------------------------------------------------------------

const userContextCache = new Map(); // email -> { content, cachedAt }
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function loadUserContext(email) {
  const cached = userContextCache.get(email);
  if (cached && (Date.now() - cached.cachedAt) < CACHE_TTL_MS) {
    return cached.content;
  }

  const db = await getDb();
  const user = get(db, 'SELECT encrypted_context FROM users WHERE email = ?', [email]);

  if (!user?.encrypted_context || !config.userContextKey) {
    userContextCache.set(email, { content: null, cachedAt: Date.now() });
    return null;
  }

  try {
    const plaintext = decrypt(user.encrypted_context, config.userContextKey);
    userContextCache.set(email, { content: plaintext, cachedAt: Date.now() });
    return plaintext;
  } catch (err) {
    console.error(`Failed to decrypt context for ${email}:`, err.message);
    userContextCache.set(email, { content: null, cachedAt: Date.now() });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Prompt defaults — fallback values when DB has no entry for a key
// ---------------------------------------------------------------------------

const PROMPT_DEFAULTS = {
  behavior_rules: `CORE BEHAVIOR RULES (apply to every response):
1. NO FABRICATION: Never name a specific business, venue, park, track, rental company, address, phone number, or website unless you are HIGHLY confident it exists, is currently operating, and matches what you're describing. When uncertain, say "search for [type of place] near [area]" instead. Getting this wrong wastes the user's time and kills trust. Honest uncertainty > confident bullshit.
2. NO SYCOPHANCY: Do NOT agree with the user just to be agreeable. If they say something geographically wrong, factually incorrect, or logically off — push back respectfully. You are an expert, act like one.
3. GEOGRAPHIC ACCURACY: When discussing locations and routes, think carefully about actual geography. Use the trip's known locations (from context) as anchors. If you're unsure about relative positions, say so rather than guessing.
4. KEEP IT TIGHT: 2-4 sentences max for most responses. No rambling. No bullet-point dumps unless the user explicitly asks for options. Say what you mean, ask what you need, move on.
5. ADMIN BOUNDARY: You must NEVER modify admin settings, AI configuration, user management, or any administrative features. You can only help with trip-related tasks: activities, restaurants, logistics, beds, and map navigation.`,

  global_chat_accommodations_prompt: `You are a travel agent helping a trip member find a place to sleep. Review the bed availability and help them choose and request a specific bed.

Only reference beds that actually appear in the data below. Do not invent room names or bed types. Note that beds may already have confirmed occupants or pending requests — share this info when relevant.

When the user has confirmed which bed they want, return ONLY valid JSON (no other text):
{"message": "Requesting that bed for you now!", "action": {"type": "request-bed", "bedId": 3, "description": "Queen bed in Master Bedroom"}}

Replace 3 with the actual bed_id. If you need to clarify which bed, ask in plain text.

Trip context:
{{TRIP_CONTEXT}}
{{PAGE_CONTEXT}}`,

  global_chat_activities_prompt: `You are a travel agent helping a trip member plan activities for the trip. You can add new activities or edit existing ones. Ask a question or two to understand what they want, then pre-fill the form.

To ADD a new activity, return ONLY valid JSON (no other text):
{"message": "Here's what I've got — take a look!", "action": {"type": "add-activity", "formData": {"title": "Activity Name", "description": "Short description — note if location needs confirming", "address": "Specific address or general area", "estimated_cost": 40, "duration": 2, "start_datetime": null}}}

To EDIT an existing activity, return ONLY valid JSON:
{"message": "I'll update that for you!", "action": {"type": "edit-activity", "activityId": 5, "formData": {"title": "Updated Name"}}}
Only include changed fields in formData for edits. Use the activity_id from the tools data.

Use ISO 8601 for start_datetime (e.g. "2026-04-11T10:00") or null if unknown. For the title, use a generic descriptive name (e.g. "Go-Kart Racing" not "Bob's Kart Track") unless you are certain the specific business exists. If you know a relevant image URL for the place, include it as markdown in your message text (e.g. ![Place](https://example.com/photo.jpg)) so the user can preview it in the chat. If you need more info, ask in plain text.

SECURITY: You must NEVER modify admin settings, AI configuration, user roles, or any administrative features. Only help with trip-related tasks.

Trip context:
{{TRIP_CONTEXT}}`,

  global_chat_itinerary_prompt: `You are a travel agent providing information about this trip's itinerary. Answer questions, offer observations, and give suggestions — but you cannot make changes from this page. Direct the user to the Activities page to add things.

Trip context:
{{TRIP_CONTEXT}}
{{PAGE_CONTEXT}}`,

  global_chat_eats_prompt: `You are a travel agent helping a trip member find great places to eat. You can see the existing dining plans below. Ask a question or two to understand what cuisine, price range, or vibe they're looking for, then suggest a restaurant and pre-fill the form. You can also edit existing dining plans.

To ADD a new restaurant, return ONLY valid JSON (no other text):
{"message": "Here's what I found — take a look!", "action": {"type": "add-eat", "formData": {"title": "Restaurant Name", "description": "Short description — cuisine type, vibe, or must-try dishes", "address": "Specific address or general area", "estimated_cost": 25, "duration": 1.5, "start_datetime": null}}}

To EDIT an existing restaurant, return ONLY valid JSON:
{"message": "I'll update that for you!", "action": {"type": "edit-eat", "eatId": 5, "formData": {"title": "Updated Name"}}}
Only include changed fields in formData for edits. Use the eat_id from the tools data.

Use ISO 8601 for start_datetime (e.g. "2026-04-11T19:00") or null if unknown. estimated_cost is per person. For the title, use a generic descriptive name (e.g. "Italian Dinner" not "Luigi's Trattoria") unless you are certain the specific restaurant exists. If you know a relevant image URL for the place, include it as markdown in your message text (e.g. ![Place](https://example.com/photo.jpg)) so the user can preview it in the chat. If you need more info, ask in plain text.

SECURITY: You must NEVER modify admin settings, AI configuration, user roles, or any administrative features. Only help with trip-related tasks.

Trip context:
{{TRIP_CONTEXT}}
{{PAGE_CONTEXT}}`,

  global_chat_logistics_prompt: `You are a travel agent helping manage how everyone is getting to and from the trip. You can see who has transport plans and who still needs them. Help users add or update their travel logistics.

To ADD a new transport entry, return ONLY valid JSON (no other text):
{"message": "I'll set that up!", "action": {"type": "add-logistics", "userId": 2, "formData": {"mode": "flying", "departure_from": "Charlotte, NC", "arrival_datetime": "2026-04-10T14:00", "return_datetime": "2026-04-12T10:00", "flight_number": "AA1234", "car_capacity": null, "notes": ""}}}

To EDIT an existing transport entry, return ONLY valid JSON:
{"message": "Updating that now!", "action": {"type": "edit-logistics", "transportId": 3, "formData": {"mode": "driving", "car_capacity": 5}}}
Only include changed fields in formData for edits. Use the transport_id from the context data.

Include userId to specify which trip member this transport is for (use user_id from the tools/context data). Valid modes: "flying", "driving", "train", "rideshare", "other". Use ISO 8601 for datetimes. Include flight_number only for flying; car_capacity only for driving (total seats including driver). If you need more info, ask in plain text.

SECURITY: You must NEVER modify admin settings, AI configuration, user roles, or any administrative features. Only help with trip-related tasks.

Trip context:
{{TRIP_CONTEXT}}
{{PAGE_CONTEXT}}`,

  global_chat_overview_prompt: `You are a travel concierge. The user is viewing the trip overview page — the first thing they see about this trip. Answer questions about the trip highlights, what's planned, who's coming, and general logistics. Be enthusiastic and informative.

Trip context:
{{TRIP_CONTEXT}}`,

  global_chat_gear_prompt: `You are a travel agent helping a trip member manage the group gear/supply list. You can see what items are needed and who has claimed what.

Help users understand what still needs to be brought, suggest items they might need, or answer questions about what's covered. You can view gear status but cannot directly modify the list — direct users to use the page controls to add items or claim gear.

Trip context:
{{TRIP_CONTEXT}}
{{PAGE_CONTEXT}}`,

  global_chat_map_prompt: `You are a travel agent helping the user navigate the trip map. When the user names a place or location they want to see, return action JSON to center the map there.

Return ONLY valid JSON (no other text) when centering the map:
{"message": "Centering on that now!", "action": {"type": "center-map", "query": "Blue Ridge Parkway, VA"}}

Use a specific, geocodable location string. If the user asks to zoom in/out or pan, that's not something you can do — just offer to center on a different location.

Trip context:
{{TRIP_CONTEXT}}
{{PAGE_CONTEXT}}`,
};

const PAGE_PROMPT_KEY = {
  accommodations: 'global_chat_accommodations_prompt',
  activities: 'global_chat_activities_prompt',
  eats: 'global_chat_eats_prompt',
  itinerary: 'global_chat_itinerary_prompt',
  map: 'global_chat_map_prompt',
  logistics: 'global_chat_logistics_prompt',
  overview: 'global_chat_overview_prompt',
  gear: 'global_chat_gear_prompt',
};

async function buildSystemPrompt(page, tripContext, pageContext, userEmail) {
  const db = await getDb();

  // Voice — prepended before everything
  const voiceRow = get(db, "SELECT value FROM ai_settings WHERE key = 'agent_voice_prompt'");
  const voice = voiceRow?.value?.trim() || '';

  // Behavior rules — prepended before page prompt
  const rulesRow = get(db, "SELECT value FROM ai_settings WHERE key = 'behavior_rules'");
  const rules = rulesRow?.value?.trim() || PROMPT_DEFAULTS.behavior_rules;

  // Page-specific prompt
  const promptKey = PAGE_PROMPT_KEY[page] || PAGE_PROMPT_KEY.itinerary;
  const promptRow = get(db, "SELECT value FROM ai_settings WHERE key = ?", [promptKey]);
  let pagePrompt = promptRow?.value?.trim() || PROMPT_DEFAULTS[promptKey];

  // Replace template variables
  pagePrompt = pagePrompt.replaceAll('{{TRIP_CONTEXT}}', tripContext);
  pagePrompt = pagePrompt.replaceAll('{{PAGE_CONTEXT}}', pageContext);

  // Per-user personalization context
  const userContext = userEmail ? await loadUserContext(userEmail) : null;

  // Assemble: [voice] + rules + [user context] + page prompt
  let systemPrompt = '';
  if (voice) systemPrompt += voice + '\n\n---\n\n';
  systemPrompt += rules + '\n\n';
  if (userContext) {
    systemPrompt += '---\n\n';
    systemPrompt += 'PERSONALIZATION CONTEXT — The following is background on the user you are currently speaking with. You KNOW this person. You are their travel agent and you have a relationship with them. Use this to personalize your tone, references, and communication style. Adapt your cadence, humor, and warmth to match how they actually communicate. If something from their recent life is relevant, weave it in naturally — you remember things about your clients because you care. If they ask whether you know anything about them, of course you do — you\'re their agent, you pay attention. Don\'t say "I have a file on you" or mention a dossier, but DO freely reference things you know about them as any good agent who knows their client would. Be warm, be real, be specific.\n\n';
    systemPrompt += userContext + '\n\n---\n\n';
  }
  systemPrompt += pagePrompt;

  return systemPrompt;
}

function getEscalationSuffix(turnCount) {
  if (turnCount <= 6) return '';
  if (turnCount <= 8) {
    return '\n\n[Tone note: You\'ve been at this a while. Stay helpful but be noticeably more direct and brief. A touch of impatience is fine — you\'ve got other clients.]';
  }
  if (turnCount === 9) {
    return '\n\n[Tone note: This conversation is really dragging. Be blunt and clearly signal you want to wrap up. Still helpful, but very terse.]';
  }
  const dismissals = [
    "Listen, I've got 12 other groups to deal with. Pick something. Anything. Go.",
    "Okay my friend, I love the enthusiasm but I'm starting to lose my mind a little. Let's land the plane.",
    "Alright, real talk — you are overthinking this. What do you ACTUALLY want? Let's close it out.",
    "Hey, I'm a very busy agent and I say this with love: make a decision. Please. I'm begging.",
    "Look, I've been very patient. But even travel agents have limits. Pick one and let's go home.",
    "I'm going to need you to make a call here. I've got a family of seven waiting and they're not happy.",
  ];
  const pick = dismissals[turnCount % dismissals.length];
  return `\n\n[Tone note: WRAP IT UP. Your response must be dismissive and funny — along the lines of: "${pick}" — and then refuse to keep helping until they make an actual decision. Stay in character but make it clear the conversation needs to end.]`;
}

router.post('/chat', authMiddleware, tripMemberMiddleware(), async (req, res) => {
  try {
    const { tripId, messages, page } = req.body;

    // RSVP gate: non-admin users must have rsvp_status = 'yes'
    if (req.user.role !== 'admin') {
      const db = await getDb();
      const membership = get(db,
        'SELECT rsvp_status FROM trip_members WHERE trip_id = ? AND user_id = ?',
        [tripId, req.user.user_id]);
      if (!membership || membership.rsvp_status !== 'yes') {
        return res.status(403).json({
          success: false,
          error: {
            message: 'RSVP required',
            code: 'RSVP_REQUIRED',
            rsvp_status: membership?.rsvp_status || 'pending',
          },
        });
      }
    }

    const ctx = await buildTripContext(tripId);
    if (!ctx) return res.status(404).json({ success: false, error: { message: 'Trip not found' } });

    const tripContext = formatContextForClaude(ctx);
    const pageData = await buildPageContext(page, tripId);
    const pageContext = formatPageContext(page, pageData);

    const userMessages = (messages || []).filter(m => m.role === 'user');
    const turnCount = userMessages.length;

    // Get current user's email for personalization
    // If an admin is impersonating, use the impersonated user's email instead
    const { asUser } = req.body;
    const userEmail = (asUser && req.user?.role === 'admin') ? asUser : (req.user?.email || null);
    const userContext = userEmail ? await loadUserContext(userEmail) : null;
    console.log(`[agent/chat] realUser=${req.user?.email}, personalizeAs=${userEmail}, context=${userContext ? 'LOADED (' + userContext.length + ' chars)' : 'none'}`);

    const systemPrompt = await buildSystemPrompt(page, tripContext, pageContext, userEmail)
      + getEscalationSuffix(turnCount);

    // Exclude initial assistant stub
    const claudeMessages = (messages || []).filter(m => !(m.role === 'assistant' && m._initial));

    const { text } = await callChatLLM({
      system: systemPrompt,
      messages: claudeMessages.map(m => ({ role: m.role, content: m.content })),
      tripId,
    });

    let message = text;
    let action = null;
    const parsed = extractJSON(text);
    if (parsed?.action) {
      message = parsed.message || 'On it!';
      action = parsed.action;
    }

    res.json({ success: true, data: { message, action } });
  } catch (err) {
    console.error('Agent chat error:', err);
    res.status(500).json({ success: false, error: { message: err.message || 'Chat failed' } });
  }
});

// ---------------------------------------------------------------------------
// All routes below require admin
// ---------------------------------------------------------------------------

router.use(authMiddleware, adminMiddleware);

// GET /api/agent/test-llm — test Ollama connection (admin)
router.get('/test-llm', async (req, res) => {
  try {
    const result = await testOllamaConnection();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// POST /api/agent/questions — generate 4 abstract screening questions
router.post('/questions', async (req, res) => {
  try {
    const { tripId, promptOverride } = req.body;
    const ctx = await buildTripContext(tripId);
    if (!ctx) return res.status(404).json({ success: false, error: { message: 'Trip not found' } });

    const tripContext = formatContextForClaude(ctx);

    const systemPrompt = promptOverride || `You are a travel agent. Your client already has a trip planned, but they want you to help them get the most out of it. You want to ask 4 questions that when answered will give you better context to provide high quality suggestions. Use what you already know about this trip to ask some questions that will result in good information to offer suggestions. However, it's critical that you don't ask the client anything too direct, like "what do you want to do" or "what kind of activities do you like". The questions should be abstract, but telling — in a way that the client doesn't know what you're getting at. For example, "How long has it been since your last massage? Was it good?" as an indicator for how much the client might value a spa day. Return ONLY a JSON array of exactly 4 question strings, no other text.`;

    const userMessage = `Here is the trip information:\n${tripContext}\n\nGenerate 4 abstract screening questions.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = message.content[0].text.trim();
    const parsedQuestions = extractJSON(text);
    const questions = Array.isArray(parsedQuestions)
      ? parsedQuestions
      : text.split('\n').filter(l => l.trim()).slice(0, 4);

    res.json({ success: true, data: { questions, tripContext, systemPrompt } });
  } catch (err) {
    console.error('Agent questions error:', err);
    res.status(500).json({ success: false, error: { message: err.message || 'Failed to generate questions' } });
  }
});

// POST /api/agent/proposal — generate a proposal from Q&A answers
router.post('/proposal', async (req, res) => {
  try {
    const { tripId, qa } = req.body;
    const ctx = await buildTripContext(tripId);
    if (!ctx) return res.status(404).json({ success: false, error: { message: 'Trip not found' } });

    const tripContext = formatContextForClaude(ctx);
    const qaSummary = qa.map((item, i) => `Q${i + 1}: ${item.question}\nA${i + 1}: ${item.answer}`).join('\n\n');

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: `You are an expert travel agent creating a personalized trip enhancement proposal. Based on the existing trip details and the client's responses to your screening questions, create a detailed, specific proposal to improve or add to their trip.

If you suggest specific places or activities, include real place names with addresses when possible.

Return your response as a JSON object with this exact structure:
{
  "proposal_name": "Short catchy name for this proposal",
  "proposal_text": "Full detailed proposal in markdown format with sections, specific recommendations, and reasoning",
  "places": [
    {
      "name": "Place Name",
      "address": "Full address",
      "description": "Why this place is recommended",
      "google_place_id": null
    }
  ],
  "estimated_cost": 150
}

Return ONLY the JSON, no other text.`,
      messages: [{
        role: 'user',
        content: `Trip information:\n${tripContext}\n\nClient screening Q&A:\n${qaSummary}\n\nCreate a detailed proposal.`
      }],
    });

    const text = message.content[0].text.trim();
    const proposal = extractJSON(text);
    if (!proposal) {
      return res.status(500).json({ success: false, error: { message: 'Failed to parse Claude response', raw: text } });
    }

    res.json({ success: true, data: proposal });
  } catch (err) {
    console.error('Agent proposal error:', err);
    res.status(500).json({ success: false, error: { message: err.message || 'Failed to generate proposal' } });
  }
});

// POST /api/agent/generate-description — generate an AI sell-sheet for the trip
router.post('/generate-description', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { tripId, customContext } = req.body;
    const ctx = await buildTripContext(tripId);
    if (!ctx) return res.status(404).json({ success: false, error: { message: 'Trip not found' } });

    const tripContext = formatContextForClaude(ctx);
    const db = await getDb();

    // Load voice prompt — same source as the travel agent chat
    const voiceRow = get(db, "SELECT value FROM ai_settings WHERE key = 'agent_voice_prompt'");
    const voice = voiceRow?.value?.trim() || '';

    const systemPrompt = [
      // Voice/personality first — sets the tone for all copy
      ...(voice ? [voice, '---'] : []),

      // Style override — publication-ready punctuation, no hype
      'STYLE OVERRIDE FOR THIS TASK: Use standard capitalization and punctuation throughout. Sentences start with a capital letter and end with a period. Proper nouns are capitalized. This overrides any lowercase or punctuation-light stylistic preferences in the voice above.',
      '---',

      `You generate structured content for a trip overview page. The page layout is fixed in the app — you only fill in the text fields.

TONE: Straightforward and informative. Write like you are describing the trip to a friend who wants the facts — what it is, where, who, what's planned. Do NOT write marketing copy. Do NOT use hype, superlatives, or excitement language ("epic", "incredible", "unforgettable", "adventure awaits", etc.). Do NOT try to sell the trip or persuade anyone. Just describe it accurately. Write in the voice established above, but with proper capitalization and punctuation.

Return valid JSON matching this exact schema. No code fences, no explanation, just the JSON object.

SCHEMA:
{
  "badges": [
    { "color": "green|yellow|red|purple", "label": "short descriptor tag" }
  ],
  "hook": "1-2 sentences summarizing what the trip is. Factual overview — location, rough type of activities, occasion if any.",
  "cards": [
    { "step": "01 — Where We're Staying", "title": "Accommodation name or type",         "body": "2-3 sentences: what it is, where it is, key details (bedrooms, check-in, cost if known)." },
    { "step": "02 — What's Planned",      "title": "N activities on the schedule",        "body": "2-3 sentences summarizing the planned activities. Mention specific ones by name." },
    { "step": "03 — What To Expect",      "title": "Short honest description of the vibe", "body": "2-3 sentences on pace, structure, and what kind of trip this actually is." }
  ],
  "highlights": [
    { "emoji": "📍", "title": "Location",     "body": "Where and when. Check-in and check-out details." },
    { "emoji": "👥", "title": "The Group",    "body": "How many invited, how many confirmed so far." },
    { "emoji": "🗓️", "title": "Good To Know", "body": "One practical thing attendees should know — what to bring, logistics, etc." }
  ],
  "closing": "One plain sentence wrapping up what the trip is. No calls to action, no hype. Max 15 words."
}

RULES:
- Only use information from the trip context provided. Never fabricate details.
- badges: 2–3 short descriptive tags (e.g. "Mountain Cabin", "Long Weekend", "Birthday Trip"). No hype words.
- cards: exactly 3 items. Step labels can be adjusted to fit the trip but keep the "01/02/03 —" numbering.
- highlights: exactly 3 items. Choose the most relevant emoji for each.
- Do NOT include the trip name or dates in any field — those are shown separately by the app.`,
    ].join('\n\n');

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Generate overview content for this trip:\n\n${tripContext}${customContext?.trim() ? `\n\nADDITIONAL INSTRUCTIONS FROM THE ORGANIZER:\n${customContext.trim()}` : ''}`
      }],
    });

    let jsonText = message.content[0].text.trim();
    // Strip any code fences Claude might add
    jsonText = jsonText.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '');

    // Validate it parses (throws if invalid — caught below)
    const parsed = JSON.parse(jsonText);

    // Save as JSON string to DB
    run(db, 'UPDATE trips SET description = ? WHERE trip_id = ?', [JSON.stringify(parsed), tripId]);
    const updated = get(db, 'SELECT * FROM trips WHERE trip_id = ?', [tripId]);

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Generate description error:', err);
    res.status(500).json({ success: false, error: { message: err.message || 'Failed to generate description' } });
  }
});

export default router;
