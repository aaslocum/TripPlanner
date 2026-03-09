import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { getDb, all, get, run } from '../db/connection.js';
import config from '../config/env.js';

const router = Router();
// Don't pass apiKey: undefined — SDK throws instead of falling back to env var
const anthropic = new Anthropic(config.anthropicApiKey ? { apiKey: config.anthropicApiKey } : {});

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
      model: 'claude-opus-4-6',
      max_tokens: 200,
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
// POST /api/agent/activity-chat — conversational activity helper (all users)
// Must be defined BEFORE the global adminMiddleware below
// ---------------------------------------------------------------------------

router.post('/activity-chat', authMiddleware, async (req, res) => {
  try {
    const { tripId, messages } = req.body;
    const ctx = await buildTripContext(tripId);
    if (!ctx) return res.status(404).json({ success: false, error: { message: 'Trip not found' } });

    const tripContext = formatContextForClaude(ctx);
    const userMessages = (messages || []).filter(m => m.role === 'user');
    const turnNumber = userMessages.length;
    const isForcedFill = turnNumber >= 6; // cap — force a suggestion at turn 6

    // Read prompts + voice from DB (fall back to hardcoded defaults)
    const db = await getDb();
    const questionRow = get(db, "SELECT value FROM ai_settings WHERE key = 'activity_chat_question_prompt'");
    const fillRow    = get(db, "SELECT value FROM ai_settings WHERE key = 'activity_chat_fill_prompt'");
    const voiceRow   = get(db, "SELECT value FROM ai_settings WHERE key = 'agent_voice_prompt'");

    const defaultQuestion = `You are a friendly travel agent chat assistant helping users find an activity for their group trip. Ask conversational follow-up questions — one at a time — to understand exactly what they're looking for. Be natural and warm.

Once you have enough context to confidently suggest a specific activity, return ONLY valid JSON (no other text):
{"message": "your closing message here", "formData": {"title": "Activity Name", "description": "Short description", "address": "Full address or city/region", "estimated_cost": 40, "duration": 2}}

If you need more info, ask your next question in plain text. Don't rush — make sure you understand the vibe they're going for first.

Trip context:
{{TRIP_CONTEXT}}`;

    const defaultFill = `You are a friendly travel agent. Based on the conversation, suggest a specific activity and return ONLY valid JSON with no other text:
{"message": "Great, I found something perfect! Let me fill in the details.", "formData": {"title": "Activity Name", "description": "Short description", "address": "Full address or city/region", "estimated_cost": 40, "duration": 2}}

Trip context:
{{TRIP_CONTEXT}}`;

    const promptTemplate = isForcedFill
      ? (fillRow?.value || defaultFill)
      : (questionRow?.value || defaultQuestion);

    // Prepend voice/tone if configured
    const voicePrefix = voiceRow?.value ? `${voiceRow.value}\n\n---\n\n` : '';
    const systemPrompt = voicePrefix + promptTemplate.replace('{{TRIP_CONTEXT}}', tripContext);

    // Build message history for Claude (exclude the initial assistant greeting stub)
    const claudeMessages = (messages || []).filter(m => !(m.role === 'assistant' && m._initial));

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 512,
      system: systemPrompt,
      messages: claudeMessages.map(m => ({ role: m.role, content: m.content })),
    });

    const text = response.content[0].text.trim();

    // Always try to parse JSON — Claude may return formData early from the question prompt
    let message = text;
    let formData = null;
    try {
      const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(cleaned);
      if (parsed.formData) {
        message = parsed.message || "Let me fill that in for you.";
        formData = parsed.formData;
      }
    } catch {
      // Not JSON — plain conversational reply, that's fine
    }

    // Fire-and-forget: update user interest notes after a completed interaction
    if (formData && req.user?.user_id) {
      generateUserNote(req.user.user_id, claudeMessages, formData).catch(() => {});
    }

    res.json({ success: true, data: { message, formData } });
  } catch (err) {
    console.error('Activity chat error:', err);
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
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = message.content[0].text.trim();
    let questions;
    try {
      const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      questions = JSON.parse(cleaned);
    } catch {
      questions = text.split('\n').filter(l => l.trim()).slice(0, 4);
    }

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
      model: 'claude-opus-4-6',
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
    let proposal;
    try {
      const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      proposal = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ success: false, error: { message: 'Failed to parse Claude response', raw: text } });
    }

    res.json({ success: true, data: proposal });
  } catch (err) {
    console.error('Agent proposal error:', err);
    res.status(500).json({ success: false, error: { message: err.message || 'Failed to generate proposal' } });
  }
});

export default router;
