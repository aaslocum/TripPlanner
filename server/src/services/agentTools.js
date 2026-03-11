import { getDb, all, get } from '../db/connection.js';

// ---------------------------------------------------------------------------
// Tool schemas — passed to anthropic.messages.create({ tools: AGENT_TOOLS })
// ---------------------------------------------------------------------------

export const AGENT_TOOLS = [
  // ── Trip overview ──────────────────────────────────────────────────────────
  {
    name: 'get_trip_overview',
    description: 'Get a high-level summary of the trip: dates, group size, number of accommodations, activities, and total estimated budget.',
    input_schema: { type: 'object', properties: {} },
  },

  // ── Members & Profiles ─────────────────────────────────────────────────────
  {
    name: 'get_trip_members',
    description: 'Get all trip members with their names, emails, and interest notes (ai_notes).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_member_profiles',
    description: 'Get structured travel preference profiles for all trip members: activity style (adventurous/relaxed/mixed), dietary restrictions, budget tier, mobility notes, and drink preferences.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_user_bed',
    description: 'Find which bed a specific person has been assigned to. Returns the bed type, bedroom name, and accommodation.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'First name, last name, or full name of the person to look up.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_user_preferences',
    description: 'Get the full travel preference profile for a specific trip member by name.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'First name, last name, or full name of the member.' },
      },
      required: ['name'],
    },
  },

  // ── Accommodations & Rooms ─────────────────────────────────────────────────
  {
    name: 'get_accommodation_details',
    description: 'Get full accommodation details including description, address, Airbnb URL, check-in/check-out times, and total cost.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_bed_availability',
    description: 'Get all beds for the trip with their status: bed type, bedroom name, accommodation name, and who they are assigned to (or null if unclaimed).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_unassigned_beds',
    description: 'Get only the unclaimed/available beds for the trip.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_bedroom_claims',
    description: 'Get the formal bedroom claim requests and their status (requested or confirmed) — who has asked for which room.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_bedroom_pricing',
    description: 'Get bedrooms with their price share adjustments — useful for calculating fair cost splits.',
    input_schema: { type: 'object', properties: {} },
  },

  // ── Activities ─────────────────────────────────────────────────────────────
  {
    name: 'get_activities',
    description: 'Get all planned activities for the trip with full details: title, description, address, datetime, cost, duration, rating.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_activities_by_date',
    description: 'Get activities happening on a specific date.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format, e.g. "2026-04-11".' },
      },
      required: ['date'],
    },
  },
  {
    name: 'get_suggested_activities',
    description: 'Get activities that have been suggested by trip members but not yet officially added (pending approval).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_activity_details',
    description: 'Get full details for a specific activity including image URL, rating, source URL, and GPS coordinates.',
    input_schema: {
      type: 'object',
      properties: {
        activity_id: { type: 'number', description: 'The numeric ID of the activity.' },
      },
      required: ['activity_id'],
    },
  },
  {
    name: 'search_activities',
    description: 'Search for activities by keyword — searches both title and description.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keyword or phrase to search for in activity titles and descriptions.' },
      },
      required: ['query'],
    },
  },

  // ── Eats (Dining) ─────────────────────────────────────────────────────────
  {
    name: 'get_eats',
    description: 'Get all dining plans (restaurants, cafes, bars) for the trip with full details: title, description, address, datetime, cost, duration, rating.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_eats_by_date',
    description: 'Get dining plans happening on a specific date.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format, e.g. "2026-04-11".' },
      },
      required: ['date'],
    },
  },
  {
    name: 'get_suggested_eats',
    description: 'Get dining options that have been suggested by trip members but not yet officially added (pending approval).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_eat_details',
    description: 'Get full details for a specific dining plan including image URL, rating, source URL, and GPS coordinates.',
    input_schema: {
      type: 'object',
      properties: {
        eat_id: { type: 'number', description: 'The numeric ID of the dining entry.' },
      },
      required: ['eat_id'],
    },
  },
  {
    name: 'search_eats',
    description: 'Search for dining plans by keyword — searches both title and description.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keyword or phrase to search for in restaurant names and descriptions.' },
      },
      required: ['query'],
    },
  },

  // ── Budget & Costs ─────────────────────────────────────────────────────────
  {
    name: 'get_cost_breakdown',
    description: 'Calculate per-person estimated costs: accommodation total cost divided by group size, plus the sum of all activity and dining costs per person.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_activity_costs',
    description: 'Get all activities that have an estimated cost, sorted from most to least expensive.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_eat_costs',
    description: 'Get all dining plans that have an estimated cost, sorted from most to least expensive.',
    input_schema: { type: 'object', properties: {} },
  },

  // ── Schedule ───────────────────────────────────────────────────────────────
  {
    name: 'get_itinerary',
    description: 'Get the full trip timeline sorted by datetime: accommodation check-in, all activities, dining plans, and check-out.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_schedule_gaps',
    description: 'Find time gaps between activities and dining plans — potential free slots in the schedule.',
    input_schema: { type: 'object', properties: {} },
  },

  // ── Transportation ─────────────────────────────────────────────────────────
  {
    name: 'get_transportation',
    description: 'Get all transportation plans for trip members: mode of travel, departure city, arrival and departure times, flight numbers, and car capacities.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_carpool_opportunities',
    description: 'Summarize carpool logistics: drivers and their available seats, people who need rides, and whether supply meets demand.',
    input_schema: { type: 'object', properties: {} },
  },

  // ── Proposals ─────────────────────────────────────────────────────────────
  {
    name: 'get_proposals',
    description: 'Get all previously generated trip proposals with their full text, places, and estimated costs.',
    input_schema: { type: 'object', properties: {} },
  },
];

// ---------------------------------------------------------------------------
// Tool executor — dispatches to the right DB query function
// ---------------------------------------------------------------------------

export async function executeTool(toolName, tripId, input = {}) {
  const db = await getDb();
  switch (toolName) {
    case 'get_trip_overview':         return getTripOverview(db, tripId);
    case 'get_trip_members':          return getTripMembers(db, tripId);
    case 'get_member_profiles':       return getMemberProfiles(db, tripId);
    case 'get_user_bed':              return getUserBed(db, tripId, input.name);
    case 'get_user_preferences':      return getUserPreferences(db, tripId, input.name);
    case 'get_accommodation_details': return getAccommodationDetails(db, tripId);
    case 'get_bed_availability':      return getBedAvailability(db, tripId);
    case 'get_unassigned_beds':       return getUnassignedBeds(db, tripId);
    case 'get_bedroom_claims':        return getBedroomClaims(db, tripId);
    case 'get_bedroom_pricing':       return getBedroomPricing(db, tripId);
    case 'get_activities':            return getActivities(db, tripId);
    case 'get_activities_by_date':    return getActivitiesByDate(db, tripId, input.date);
    case 'get_suggested_activities':  return getSuggestedActivities(db, tripId);
    case 'get_activity_details':      return getActivityDetails(db, input.activity_id);
    case 'search_activities':         return searchActivities(db, tripId, input.query);
    case 'get_eats':                  return getEats(db, tripId);
    case 'get_eats_by_date':          return getEatsByDate(db, tripId, input.date);
    case 'get_suggested_eats':        return getSuggestedEats(db, tripId);
    case 'get_eat_details':           return getEatDetails(db, input.eat_id);
    case 'search_eats':               return searchEats(db, tripId, input.query);
    case 'get_cost_breakdown':        return getCostBreakdown(db, tripId);
    case 'get_activity_costs':        return getActivityCosts(db, tripId);
    case 'get_eat_costs':             return getEatCosts(db, tripId);
    case 'get_itinerary':             return getItinerary(db, tripId);
    case 'get_schedule_gaps':         return getScheduleGaps(db, tripId);
    case 'get_transportation':        return getTransportation(db, tripId);
    case 'get_carpool_opportunities': return getCarpoolOpportunities(db, tripId);
    case 'get_proposals':             return getProposals(db, tripId);
    default: return { error: `Unknown tool: ${toolName}` };
  }
}

// ---------------------------------------------------------------------------
// Individual query functions
// ---------------------------------------------------------------------------

function getTripOverview(db, tripId) {
  const trip = get(db, 'SELECT * FROM trips WHERE trip_id = ?', [tripId]);
  if (!trip) return { error: 'Trip not found' };

  const memberCount = get(db, 'SELECT COUNT(*) as cnt FROM trip_members WHERE trip_id = ?', [tripId]).cnt;
  const accommodationCount = get(db, 'SELECT COUNT(*) as cnt FROM accommodations WHERE trip_id = ?', [tripId]).cnt;
  const activityCount = get(db, 'SELECT COUNT(*) as cnt FROM activities WHERE trip_id = ? AND is_suggested = 0', [tripId]).cnt;
  const eatCount = get(db, 'SELECT COUNT(*) as cnt FROM eats WHERE trip_id = ? AND is_suggested = 0', [tripId]).cnt;
  const totalCost = get(db,
    'SELECT COALESCE(SUM(total_cost), 0) as total FROM accommodations WHERE trip_id = ?', [tripId]).total;
  const activityCosts = get(db,
    'SELECT COALESCE(SUM(estimated_cost), 0) as total FROM activities WHERE trip_id = ? AND is_suggested = 0', [tripId]).total;
  const eatCosts = get(db,
    'SELECT COALESCE(SUM(estimated_cost), 0) as total FROM eats WHERE trip_id = ? AND is_suggested = 0', [tripId]).total;

  const grandTotal = totalCost + activityCosts + eatCosts;
  return {
    trip_name: trip.trip_name,
    start_date: trip.start_date,
    end_date: trip.end_date,
    member_count: memberCount,
    accommodation_count: accommodationCount,
    activity_count: activityCount,
    dining_count: eatCount,
    total_accommodation_cost: totalCost,
    total_activity_costs: activityCosts,
    total_dining_costs: eatCosts,
    estimated_total: grandTotal,
    estimated_per_person: memberCount > 0 ? Math.round(grandTotal / memberCount) : 0,
  };
}

function getTripMembers(db, tripId) {
  return all(db,
    `SELECT u.user_id, u.first_name, u.last_name, u.email, u.ai_notes
     FROM trip_members tm JOIN users u ON tm.user_id = u.user_id
     WHERE tm.trip_id = ?
     ORDER BY u.first_name`,
    [tripId]);
}

function getMemberProfiles(db, tripId) {
  return all(db,
    `SELECT u.user_id, u.first_name, u.last_name, u.email,
            u.pref_activity_style, u.pref_dietary, u.pref_budget_tier,
            u.pref_mobility, u.pref_drinks, u.ai_notes
     FROM trip_members tm JOIN users u ON tm.user_id = u.user_id
     WHERE tm.trip_id = ?
     ORDER BY u.first_name`,
    [tripId]);
}

function getUserBed(db, tripId, name) {
  if (!name) return { error: 'name is required' };
  const nameParts = name.trim().split(/\s+/);
  const [first, ...rest] = nameParts;
  const last = rest.join(' ');

  const beds = all(db,
    `SELECT b.bed_id, b.bed_type, br.name as bedroom_name, a.description as accommodation_name,
            u.first_name, u.last_name
     FROM beds b
     JOIN bedrooms br ON b.bedroom_id = br.bedroom_id
     JOIN accommodations a ON br.accommodation_id = a.accommodation_id
     LEFT JOIN users u ON b.assigned_user_id = u.user_id
     WHERE a.trip_id = ?
       AND (LOWER(u.first_name) LIKE LOWER(?) OR LOWER(u.last_name) LIKE LOWER(?)
            OR LOWER(u.first_name || ' ' || u.last_name) LIKE LOWER(?))`,
    [tripId, `%${first}%`, `%${last || first}%`, `%${name}%`]);

  return beds.length > 0 ? beds : { result: `No bed found assigned to "${name}"` };
}

function getUserPreferences(db, tripId, name) {
  if (!name) return { error: 'name is required' };
  const user = get(db,
    `SELECT u.user_id, u.first_name, u.last_name, u.email, u.ai_notes,
            u.pref_activity_style, u.pref_dietary, u.pref_budget_tier,
            u.pref_mobility, u.pref_drinks
     FROM trip_members tm JOIN users u ON tm.user_id = u.user_id
     WHERE tm.trip_id = ?
       AND (LOWER(u.first_name) LIKE LOWER(?) OR LOWER(u.last_name) LIKE LOWER(?)
            OR LOWER(u.first_name || ' ' || u.last_name) LIKE LOWER(?))
     LIMIT 1`,
    [tripId, `%${name}%`, `%${name}%`, `%${name}%`]);
  return user || { result: `No member found matching "${name}"` };
}

function getAccommodationDetails(db, tripId) {
  const accs = all(db,
    `SELECT a.accommodation_id, a.description, a.address, a.airbnb_url,
            a.check_in_datetime, a.check_out_datetime, a.total_cost,
            COUNT(DISTINCT br.bedroom_id) as bedroom_count,
            COUNT(DISTINCT b.bed_id) as bed_count
     FROM accommodations a
     LEFT JOIN bedrooms br ON a.accommodation_id = br.accommodation_id
     LEFT JOIN beds b ON br.bedroom_id = b.bedroom_id
     WHERE a.trip_id = ?
     GROUP BY a.accommodation_id`,
    [tripId]);
  return accs;
}

function getBedAvailability(db, tripId) {
  return all(db,
    `SELECT b.bed_id, b.bed_type,
            br.name as bedroom_name, br.price_share_adjustment,
            a.description as accommodation_name,
            CASE WHEN b.assigned_user_id IS NOT NULL
              THEN u.first_name || ' ' || u.last_name ELSE NULL END as assigned_to
     FROM accommodations a
     JOIN bedrooms br ON a.accommodation_id = br.accommodation_id
     JOIN beds b ON br.bedroom_id = b.bedroom_id
     LEFT JOIN users u ON b.assigned_user_id = u.user_id
     WHERE a.trip_id = ?
     ORDER BY a.description, br.name`,
    [tripId]);
}

function getUnassignedBeds(db, tripId) {
  return all(db,
    `SELECT b.bed_id, b.bed_type,
            br.name as bedroom_name, br.price_share_adjustment,
            a.description as accommodation_name
     FROM accommodations a
     JOIN bedrooms br ON a.accommodation_id = br.accommodation_id
     JOIN beds b ON br.bedroom_id = b.bedroom_id
     WHERE a.trip_id = ? AND b.assigned_user_id IS NULL
     ORDER BY a.description, br.name`,
    [tripId]);
}

function getBedroomClaims(db, tripId) {
  return all(db,
    `SELECT bc.claim_id, bc.status,
            br.name as bedroom_name, a.description as accommodation_name,
            u.first_name, u.last_name, u.email,
            bc.created_at
     FROM bedroom_claims bc
     JOIN bedrooms br ON bc.bedroom_id = br.bedroom_id
     JOIN accommodations a ON br.accommodation_id = a.accommodation_id
     JOIN users u ON bc.user_id = u.user_id
     WHERE a.trip_id = ?
     ORDER BY bc.status, u.first_name`,
    [tripId]);
}

function getBedroomPricing(db, tripId) {
  return all(db,
    `SELECT br.bedroom_id, br.name as bedroom_name,
            br.price_share_adjustment,
            a.description as accommodation_name, a.total_cost
     FROM bedrooms br
     JOIN accommodations a ON br.accommodation_id = a.accommodation_id
     WHERE a.trip_id = ?
     ORDER BY a.description, br.name`,
    [tripId]);
}

function getActivities(db, tripId) {
  return all(db,
    `SELECT activity_id, title, description, address, start_datetime, end_datetime,
            estimated_cost, duration, rating, is_suggested, source_url
     FROM activities WHERE trip_id = ?
     ORDER BY start_datetime`,
    [tripId]);
}

function getActivitiesByDate(db, tripId, date) {
  if (!date) return { error: 'date is required (YYYY-MM-DD)' };
  return all(db,
    `SELECT activity_id, title, description, address, start_datetime, end_datetime,
            estimated_cost, duration, rating, is_suggested
     FROM activities
     WHERE trip_id = ? AND DATE(start_datetime) = ?
     ORDER BY start_datetime`,
    [tripId, date]);
}

function getSuggestedActivities(db, tripId) {
  return all(db,
    `SELECT activity_id, title, description, address, start_datetime,
            estimated_cost, duration, rating, source_url
     FROM activities WHERE trip_id = ? AND is_suggested = 1
     ORDER BY created_at DESC`,
    [tripId]);
}

function getActivityDetails(db, activityId) {
  if (!activityId) return { error: 'activity_id is required' };
  return get(db,
    `SELECT * FROM activities WHERE activity_id = ?`,
    [activityId]) || { error: `Activity ${activityId} not found` };
}

function searchActivities(db, tripId, query) {
  if (!query) return { error: 'query is required' };
  const like = `%${query}%`;
  return all(db,
    `SELECT activity_id, title, description, address, start_datetime,
            estimated_cost, duration, rating, is_suggested
     FROM activities
     WHERE trip_id = ? AND (LOWER(title) LIKE LOWER(?) OR LOWER(description) LIKE LOWER(?))
     ORDER BY start_datetime`,
    [tripId, like, like]);
}

// ── Eats (Dining) queries ────────────────────────────────────────────────

function getEats(db, tripId) {
  return all(db,
    `SELECT eat_id, title, description, address, start_datetime, end_datetime,
            estimated_cost, duration, rating, is_suggested, source_url
     FROM eats WHERE trip_id = ?
     ORDER BY start_datetime`,
    [tripId]);
}

function getEatsByDate(db, tripId, date) {
  if (!date) return { error: 'date is required (YYYY-MM-DD)' };
  return all(db,
    `SELECT eat_id, title, description, address, start_datetime, end_datetime,
            estimated_cost, duration, rating, is_suggested
     FROM eats
     WHERE trip_id = ? AND DATE(start_datetime) = ?
     ORDER BY start_datetime`,
    [tripId, date]);
}

function getSuggestedEats(db, tripId) {
  return all(db,
    `SELECT eat_id, title, description, address, start_datetime,
            estimated_cost, duration, rating, source_url
     FROM eats WHERE trip_id = ? AND is_suggested = 1
     ORDER BY created_at DESC`,
    [tripId]);
}

function getEatDetails(db, eatId) {
  if (!eatId) return { error: 'eat_id is required' };
  return get(db,
    `SELECT * FROM eats WHERE eat_id = ?`,
    [eatId]) || { error: `Dining entry ${eatId} not found` };
}

function searchEats(db, tripId, query) {
  if (!query) return { error: 'query is required' };
  const like = `%${query}%`;
  return all(db,
    `SELECT eat_id, title, description, address, start_datetime,
            estimated_cost, duration, rating, is_suggested
     FROM eats
     WHERE trip_id = ? AND (LOWER(title) LIKE LOWER(?) OR LOWER(description) LIKE LOWER(?))
     ORDER BY start_datetime`,
    [tripId, like, like]);
}

function getEatCosts(db, tripId) {
  return all(db,
    `SELECT eat_id, title, address, start_datetime, estimated_cost, duration
     FROM eats
     WHERE trip_id = ? AND estimated_cost > 0 AND is_suggested = 0
     ORDER BY estimated_cost DESC`,
    [tripId]);
}

function getCostBreakdown(db, tripId) {
  const memberCount = get(db, 'SELECT COUNT(*) as cnt FROM trip_members WHERE trip_id = ?', [tripId]).cnt;
  const accommodations = all(db,
    'SELECT description, total_cost FROM accommodations WHERE trip_id = ?', [tripId]);
  const totalAccommodation = accommodations.reduce((s, a) => s + (a.total_cost || 0), 0);
  const totalActivityCost = get(db,
    'SELECT COALESCE(SUM(estimated_cost), 0) as total FROM activities WHERE trip_id = ? AND is_suggested = 0', [tripId]).total;
  const totalEatCost = get(db,
    'SELECT COALESCE(SUM(estimated_cost), 0) as total FROM eats WHERE trip_id = ? AND is_suggested = 0', [tripId]).total;

  const perPersonAccommodation = memberCount > 0 ? totalAccommodation / memberCount : 0;
  const perPersonActivity = memberCount > 0 ? totalActivityCost / memberCount : 0;
  const perPersonDining = memberCount > 0 ? totalEatCost / memberCount : 0;

  return {
    group_size: memberCount,
    accommodations: accommodations.map(a => ({
      name: a.description,
      total: a.total_cost,
      per_person: memberCount > 0 ? Math.round(a.total_cost / memberCount) : 0,
    })),
    total_accommodation: totalAccommodation,
    total_activities: totalActivityCost,
    total_dining: totalEatCost,
    per_person_accommodation: Math.round(perPersonAccommodation),
    per_person_activities: Math.round(perPersonActivity),
    per_person_dining: Math.round(perPersonDining),
    estimated_per_person_total: Math.round(perPersonAccommodation + perPersonActivity + perPersonDining),
  };
}

function getActivityCosts(db, tripId) {
  return all(db,
    `SELECT activity_id, title, address, start_datetime, estimated_cost, duration
     FROM activities
     WHERE trip_id = ? AND estimated_cost > 0 AND is_suggested = 0
     ORDER BY estimated_cost DESC`,
    [tripId]);
}

function getItinerary(db, tripId) {
  const activities = all(db,
    `SELECT 'activity' as type, title as label, address, start_datetime as datetime,
            estimated_cost, duration, is_suggested
     FROM activities WHERE trip_id = ? AND is_suggested = 0`,
    [tripId]);

  const eatsRows = all(db,
    `SELECT 'dining' as type, title as label, address, start_datetime as datetime,
            estimated_cost, duration, is_suggested
     FROM eats WHERE trip_id = ? AND is_suggested = 0`,
    [tripId]);

  const accommodations = all(db,
    `SELECT 'check-in' as type, description as label, address, check_in_datetime as datetime,
            NULL as estimated_cost, NULL as duration, 0 as is_suggested
     FROM accommodations WHERE trip_id = ?
     UNION ALL
     SELECT 'check-out' as type, description as label, address, check_out_datetime as datetime,
            NULL, NULL, 0
     FROM accommodations WHERE trip_id = ?`,
    [tripId, tripId]);

  return [...activities, ...eatsRows, ...accommodations]
    .filter(e => e.datetime)
    .sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));
}

function getScheduleGaps(db, tripId) {
  const activityRows = all(db,
    `SELECT title, start_datetime, end_datetime, duration
     FROM activities
     WHERE trip_id = ? AND is_suggested = 0 AND start_datetime IS NOT NULL`,
    [tripId]);

  const eatRows = all(db,
    `SELECT title, start_datetime, end_datetime, duration
     FROM eats
     WHERE trip_id = ? AND is_suggested = 0 AND start_datetime IS NOT NULL`,
    [tripId]);

  const activities = [...activityRows, ...eatRows]
    .sort((a, b) => (a.start_datetime || '').localeCompare(b.start_datetime || ''));

  if (activities.length < 2) return { gaps: [], note: 'Not enough scheduled events to calculate gaps.' };

  const gaps = [];
  for (let i = 0; i < activities.length - 1; i++) {
    const curr = activities[i];
    const next = activities[i + 1];
    // Estimate end of current if end_datetime not set
    const currEnd = curr.end_datetime || (curr.duration
      ? new Date(new Date(curr.start_datetime).getTime() + curr.duration * 60 * 60 * 1000).toISOString()
      : curr.start_datetime);
    const gapMs = new Date(next.start_datetime) - new Date(currEnd);
    const gapHours = Math.round(gapMs / 3600000 * 10) / 10;
    if (gapHours > 0.25) {
      gaps.push({
        after: curr.title,
        before: next.title,
        gap_start: currEnd,
        gap_end: next.start_datetime,
        gap_hours: gapHours,
      });
    }
  }
  return { gaps, total_gaps: gaps.length };
}

function getTransportation(db, tripId) {
  return all(db,
    `SELECT t.transport_id, t.user_id, u.first_name, u.last_name, u.email,
            t.mode, t.departure_from, t.arrival_datetime, t.return_datetime,
            t.flight_number, t.car_capacity, t.notes
     FROM trip_transportation t
     JOIN users u ON t.user_id = u.user_id
     WHERE t.trip_id = ?
     ORDER BY t.arrival_datetime`,
    [tripId]);
}

function getCarpoolOpportunities(db, tripId) {
  const all_transport = all(db,
    `SELECT t.mode, t.car_capacity, t.notes,
            u.first_name, u.last_name
     FROM trip_transportation t
     JOIN users u ON t.user_id = u.user_id
     WHERE t.trip_id = ?`,
    [tripId]);

  const drivers = all_transport.filter(t => t.mode === 'driving' && t.car_capacity > 1);
  const riders = all_transport.filter(t => t.mode === 'rideshare' || (t.mode === 'other' && !t.car_capacity));
  const totalAvailableSeats = drivers.reduce((s, d) => s + (d.car_capacity - 1), 0); // subtract driver seat

  return {
    drivers: drivers.map(d => ({
      name: `${d.first_name} ${d.last_name}`,
      car_capacity: d.car_capacity,
      available_seats: d.car_capacity - 1,
      notes: d.notes,
    })),
    people_needing_rides: riders.map(r => ({ name: `${r.first_name} ${r.last_name}`, notes: r.notes })),
    total_available_seats: totalAvailableSeats,
    total_needing_rides: riders.length,
    seats_balance: totalAvailableSeats - riders.length,
  };
}

function getProposals(db, tripId) {
  return all(db,
    `SELECT proposal_id, proposal_name, proposal_text, places, estimated_cost, created_at
     FROM proposals WHERE trip_id = ?
     ORDER BY created_at DESC`,
    [tripId]);
}
