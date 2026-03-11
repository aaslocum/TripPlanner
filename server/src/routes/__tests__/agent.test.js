import { describe, it, expect } from 'vitest';

// extractJSON is defined inside agent.js as a non-exported function.
// We re-implement it here to test the logic, matching the source exactly.
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

// Test getEscalationSuffix logic
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

describe('extractJSON', () => {
  describe('direct parse', () => {
    it('parses valid JSON object directly', () => {
      expect(extractJSON('{"key": "value"}')).toEqual({ key: 'value' });
    });

    it('parses valid JSON array directly', () => {
      expect(extractJSON('["a", "b", "c"]')).toEqual(['a', 'b', 'c']);
    });

    it('parses numbers', () => {
      expect(extractJSON('42')).toBe(42);
    });

    it('parses null', () => {
      expect(extractJSON('null')).toBe(null);
    });
  });

  describe('markdown fence stripping', () => {
    it('strips ```json fences', () => {
      const input = '```json\n{"message": "hello"}\n```';
      expect(extractJSON(input)).toEqual({ message: 'hello' });
    });

    it('strips ``` fences without language tag', () => {
      const input = '```\n{"action": "test"}\n```';
      expect(extractJSON(input)).toEqual({ action: 'test' });
    });

    it('strips fences with whitespace', () => {
      const input = '```json\n  {"data": 123}  \n```';
      expect(extractJSON(input)).toEqual({ data: 123 });
    });
  });

  describe('regex extraction - objects', () => {
    it('extracts JSON object from surrounding text', () => {
      const input = 'Here is the result: {"message": "Got it!", "action": {"type": "add-activity"}} Hope that helps!';
      const result = extractJSON(input);
      expect(result.message).toBe('Got it!');
      expect(result.action.type).toBe('add-activity');
    });

    it('extracts nested JSON objects', () => {
      const input = 'text {"a": {"b": {"c": 1}}} more text';
      expect(extractJSON(input)).toEqual({ a: { b: { c: 1 } } });
    });
  });

  describe('regex extraction - arrays', () => {
    it('extracts JSON array from surrounding text', () => {
      const input = 'Questions: ["What is your favorite food?", "How far do you like to hike?"]';
      const result = extractJSON(input);
      expect(result).toEqual(["What is your favorite food?", "How far do you like to hike?"]);
    });

    it('extracts array of objects', () => {
      const input = 'Here: [{"id": 1}, {"id": 2}] done';
      expect(extractJSON(input)).toEqual([{ id: 1 }, { id: 2 }]);
    });
  });

  describe('failure cases', () => {
    it('returns null for plain text', () => {
      expect(extractJSON('just some plain text')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(extractJSON('')).toBeNull();
    });

    it('returns null for invalid JSON in braces', () => {
      expect(extractJSON('{not: valid json}')).toBeNull();
    });

    it('returns null for truncated JSON', () => {
      expect(extractJSON('{"key": "val')).toBeNull();
    });
  });

  describe('agent action JSON patterns', () => {
    it('parses a bed request action', () => {
      const input = '{"message": "Requesting that bed!", "action": {"type": "request-bed", "bedId": 3, "description": "Queen bed in Master"}}';
      const result = extractJSON(input);
      expect(result.action.type).toBe('request-bed');
      expect(result.action.bedId).toBe(3);
    });

    it('parses an add-activity action', () => {
      const input = '{"message": "Here you go!", "action": {"type": "add-activity", "formData": {"title": "Hiking", "estimated_cost": 40}}}';
      const result = extractJSON(input);
      expect(result.action.type).toBe('add-activity');
      expect(result.action.formData.title).toBe('Hiking');
    });

    it('parses a center-map action', () => {
      const input = '{"message": "Centering!", "action": {"type": "center-map", "query": "Blue Ridge Parkway"}}';
      const result = extractJSON(input);
      expect(result.action.type).toBe('center-map');
    });
  });
});

describe('getEscalationSuffix', () => {
  it('returns empty string for turns <= 6', () => {
    expect(getEscalationSuffix(1)).toBe('');
    expect(getEscalationSuffix(6)).toBe('');
  });

  it('returns impatience note for turns 7-8', () => {
    const result = getEscalationSuffix(7);
    expect(result).toContain('more direct and brief');
    expect(getEscalationSuffix(8)).toContain('more direct and brief');
  });

  it('returns blunt note for turn 9', () => {
    const result = getEscalationSuffix(9);
    expect(result).toContain('really dragging');
    expect(result).toContain('very terse');
  });

  it('returns dismissive notes for turns 10+', () => {
    const result = getEscalationSuffix(10);
    expect(result).toContain('WRAP IT UP');
    expect(result).toContain('dismissive and funny');
  });

  it('cycles through dismissal messages', () => {
    const results = new Set();
    for (let i = 10; i < 20; i++) {
      results.add(getEscalationSuffix(i));
    }
    // Should produce multiple distinct messages
    expect(results.size).toBeGreaterThan(1);
  });
});
