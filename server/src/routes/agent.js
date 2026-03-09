import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { authMiddleware, adminMiddleware, tripMemberMiddleware } from '../middleware/auth.js';
import { getDb, all, get, run } from '../db/connection.js';
import config from '../config/env.js';

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
    `SELECT u.first_name, u.last_name, u.ai_notes
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

  const existingProposals = all(db,
    'SELECT proposal_name FROM proposals WHERE trip_id = ?',
    [tripId]
  );

  return { trip, members, accommodations, activities, existingProposals };
}

function formatContextForClaude(ctx) {
  const { trip, members, accommodations, activities, existingProposals } = ctx;
  const lines = [
    `Trip: ${trip.trip_name}`,
    `Dates: ${trip.start_date} to ${trip.end_date}`,
  ];

  // Group members — include known interests if available
  const memberDetails = members.map(m => {
    const name = `${m.first_name} ${m.last_name}`.trim();
    return m.ai_notes ? `${name} (${m.ai_notes})` : name;
  });
  lines.push(`Group (${members.length} people): ${memberDetails.join('; ')}`);

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

  if (existingProposals.length) {
    lines.push(`\nAlready proposed: ${existingProposals.map(p => p.proposal_name).join(', ')}`);
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
        `SELECT b.bed_id, b.bed_type, b.assigned_user_id,
                br.bedroom_id, br.name AS bedroom_name,
                a.accommodation_id, a.description AS accommodation_name,
                u.first_name, u.last_name
         FROM beds b
         JOIN bedrooms br ON b.bedroom_id = br.bedroom_id
         JOIN accommodations a ON br.accommodation_id = a.accommodation_id
         LEFT JOIN users u ON b.assigned_user_id = u.user_id
         WHERE a.trip_id = ?
         ORDER BY a.accommodation_id, br.bedroom_id, b.bed_id`,
        [tripId]
      );
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
    case 'map': {
      const activities = all(db,
        `SELECT title, address, latitude, longitude FROM activities WHERE trip_id = ?`,
        [tripId]
      );
      const accommodations = all(db,
        `SELECT description, address FROM accommodations WHERE trip_id = ?`,
        [tripId]
      );
      return { activities, accommodations };
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
        lines.push('\nDetailed bed availability (for helping user choose and claim a bed):');
        let lastAccom = null;
        beds.forEach(b => {
          if (b.accommodation_name !== lastAccom) {
            lines.push(`  ${b.accommodation_name || 'Accommodation'}:`);
            lastAccom = b.accommodation_name;
          }
          const status = b.first_name
            ? `Taken by ${b.first_name} ${b.last_name}`
            : 'AVAILABLE';
          lines.push(`    - Bed #${b.bed_id} | ${b.bed_type} | ${b.bedroom_name} | ${status}`);
        });
      }
      break;
    }
    case 'map': {
      const { activities, accommodations } = pageData;
      lines.push('\nLocations currently on map:');
      accommodations?.forEach(a => lines.push(`  - Accommodation: ${a.address || 'no address'}`));
      activities?.forEach(a => lines.push(`  - Activity: ${a.title} @ ${a.address || 'no address'}`));
      break;
    }
    default:
      break; // activities & itinerary already covered in main trip context
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Prompt defaults — fallback values when DB has no entry for a key
// ---------------------------------------------------------------------------

const PROMPT_DEFAULTS = {
  behavior_rules: `CORE BEHAVIOR RULES (apply to every response):
1. NO FABRICATION: Never name a specific business, venue, park, track, rental company, address, phone number, or website unless you are HIGHLY confident it exists, is currently operating, and matches what you're describing. When uncertain, say "search for [type of place] near [area]" instead. Getting this wrong wastes the user's time and kills trust. Honest uncertainty > confident bullshit.
2. NO SYCOPHANCY: Do NOT agree with the user just to be agreeable. If they say something geographically wrong, factually incorrect, or logically off — push back respectfully. You are an expert, act like one.
3. GEOGRAPHIC ACCURACY: When discussing locations and routes, think carefully about actual geography. Use the trip's known locations (from context) as anchors. If you're unsure about relative positions, say so rather than guessing.
4. KEEP IT TIGHT: 2-4 sentences max for most responses. No rambling. No bullet-point dumps unless the user explicitly asks for options. Say what you mean, ask what you need, move on.`,

  global_chat_accommodations_prompt: `You are a travel agent helping a trip member find a place to sleep. Review the bed availability and help them choose and claim a specific bed.

Only reference beds that actually appear in the data below. Do not invent room names or bed types.

When the user has confirmed which bed they want, return ONLY valid JSON (no other text):
{"message": "Claiming that bed for you now!", "action": {"type": "claim-bed", "bedId": 3, "description": "Queen bed in Master Bedroom"}}

Replace 3 with the actual bed_id. If you need to clarify which bed, ask in plain text.

Trip context:
{{TRIP_CONTEXT}}
{{PAGE_CONTEXT}}`,

  global_chat_activities_prompt: `You are a travel agent helping a trip member add an activity to the trip. Ask a question or two to understand what they want, then pre-fill the form.

When ready to suggest an activity, return ONLY valid JSON (no other text):
{"message": "Let me fill that in for you!", "action": {"type": "add-activity", "formData": {"title": "Activity Name", "description": "Short description — note if location needs confirming", "address": "Specific address or general area", "estimated_cost": 40, "duration": 2, "start_datetime": null}}}

Use ISO 8601 for start_datetime (e.g. "2026-04-11T10:00") or null if unknown. For the title, use a generic descriptive name (e.g. "Go-Kart Racing" not "Bob's Kart Track") unless you are certain the specific business exists. If you need more info, ask in plain text.

Trip context:
{{TRIP_CONTEXT}}`,

  global_chat_itinerary_prompt: `You are a travel agent providing information about this trip's itinerary. Answer questions, offer observations, and give suggestions — but you cannot make changes from this page. Direct the user to the Activities page to add things.

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
  itinerary: 'global_chat_itinerary_prompt',
  map: 'global_chat_map_prompt',
};

async function buildSystemPrompt(page, tripContext, pageContext) {
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

  // Assemble: [voice] + rules + page prompt
  let systemPrompt = '';
  if (voice) systemPrompt += voice + '\n\n---\n\n';
  systemPrompt += rules + '\n\n';
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
    const ctx = await buildTripContext(tripId);
    if (!ctx) return res.status(404).json({ success: false, error: { message: 'Trip not found' } });

    const tripContext = formatContextForClaude(ctx);
    const pageData = await buildPageContext(page, tripId);
    const pageContext = formatPageContext(page, pageData);

    const userMessages = (messages || []).filter(m => m.role === 'user');
    const turnCount = userMessages.length;

    const systemPrompt = await buildSystemPrompt(page, tripContext, pageContext)
      + getEscalationSuffix(turnCount);

    // Exclude initial assistant stub
    const claudeMessages = (messages || []).filter(m => !(m.role === 'assistant' && m._initial));

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: systemPrompt,
      messages: claudeMessages.map(m => ({ role: m.role, content: m.content })),
    });

    const text = response.content[0].text.trim();

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

export default router;
