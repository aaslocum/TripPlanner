import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external dependencies
const mockAnthropicCreate = vi.fn();
const mockOpenAICreate = vi.fn();
const mockExecuteTool = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    constructor() {
      this.messages = { create: mockAnthropicCreate };
    }
  },
}));

vi.mock('openai', () => ({
  default: class {
    constructor() {
      this.chat = { completions: { create: mockOpenAICreate } };
    }
  },
}));

vi.mock('../../config/env.js', () => ({
  default: { anthropicApiKey: 'test-key' },
}));

const mockGet = vi.fn();
vi.mock('../../db/connection.js', () => ({
  getDb: () => Promise.resolve({}),
  get: (...args) => mockGet(...args),
}));

vi.mock('../agentTools.js', () => ({
  AGENT_TOOLS: [{ name: 'test_tool', description: 'Test', input_schema: { type: 'object', properties: {} } }],
  executeTool: (...args) => mockExecuteTool(...args),
}));

const { callChatLLM } = await import('../llmClient.js');

beforeEach(() => {
  vi.clearAllMocks();
  // Default: Claude provider
  mockGet.mockImplementation((db, sql) => {
    if (sql.includes('llm_provider')) return { value: 'claude' };
    if (sql.includes('ollama_base_url')) return { value: 'http://localhost:11434' };
    if (sql.includes('ollama_model')) return { value: 'llama3.2' };
    return null;
  });
});

describe('callChatLLM', () => {
  describe('Claude path', () => {
    it('calls Claude API and returns text response', async () => {
      mockAnthropicCreate.mockResolvedValue({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Hello! How can I help?' }],
      });

      const result = await callChatLLM({
        system: 'You are a travel agent',
        messages: [{ role: 'user', content: 'Hi' }],
        tripId: 1,
      });

      expect(result.text).toBe('Hello! How can I help?');
      expect(result.provider).toBe('claude');
      expect(mockAnthropicCreate).toHaveBeenCalledTimes(1);
    });

    it('handles tool_use loop with one round', async () => {
      // First call: Claude wants to use a tool
      mockAnthropicCreate.mockResolvedValueOnce({
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: 'tool_1', name: 'get_trip_overview', input: {} },
        ],
      });
      mockExecuteTool.mockResolvedValueOnce({ trip_name: 'Test Trip' });

      // Second call: Claude returns final text
      mockAnthropicCreate.mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'The trip is called Test Trip!' }],
      });

      const result = await callChatLLM({
        system: 'system prompt',
        messages: [{ role: 'user', content: 'What is the trip?' }],
        tripId: 1,
      });

      expect(result.text).toBe('The trip is called Test Trip!');
      expect(mockAnthropicCreate).toHaveBeenCalledTimes(2);
      expect(mockExecuteTool).toHaveBeenCalledWith('get_trip_overview', 1, {});
    });

    it('handles multiple tool uses in one turn', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: 'tool_1', name: 'get_activities', input: {} },
          { type: 'tool_use', id: 'tool_2', name: 'get_eats', input: {} },
        ],
      });
      mockExecuteTool.mockResolvedValueOnce([{ title: 'Hiking' }]);
      mockExecuteTool.mockResolvedValueOnce([{ title: 'Italian' }]);

      mockAnthropicCreate.mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'You have hiking and Italian dinner planned.' }],
      });

      const result = await callChatLLM({
        system: 'system',
        messages: [{ role: 'user', content: 'What is planned?' }],
        tripId: 1,
      });

      expect(result.text).toBe('You have hiking and Italian dinner planned.');
      expect(mockExecuteTool).toHaveBeenCalledTimes(2);
    });

    it('returns empty string when no text block in response', async () => {
      mockAnthropicCreate.mockResolvedValue({
        stop_reason: 'end_turn',
        content: [],
      });

      const result = await callChatLLM({
        system: 'system',
        messages: [{ role: 'user', content: 'test' }],
        tripId: 1,
      });

      expect(result.text).toBe('');
    });
  });

  describe('Ollama path', () => {
    beforeEach(() => {
      mockGet.mockImplementation((db, sql) => {
        if (sql.includes('llm_provider')) return { value: 'ollama' };
        if (sql.includes('ollama_base_url')) return { value: 'http://localhost:11434' };
        if (sql.includes('ollama_model')) return { value: 'llama3.2' };
        return null;
      });
    });

    it('calls Ollama via OpenAI-compatible API', async () => {
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: 'Ollama response' } }],
      });

      const result = await callChatLLM({
        system: 'system prompt',
        messages: [{ role: 'user', content: 'Hi' }],
        tripId: 1,
      });

      expect(result.text).toBe('Ollama response');
      expect(result.provider).toBe('ollama');
      expect(mockOpenAICreate).toHaveBeenCalledTimes(1);
    });

    it('converts messages to OpenAI format with system message', async () => {
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: 'ok' } }],
      });

      await callChatLLM({
        system: 'Be helpful',
        messages: [{ role: 'user', content: 'test' }],
        tripId: 1,
      });

      const callArgs = mockOpenAICreate.mock.calls[0][0];
      expect(callArgs.messages[0]).toEqual({ role: 'system', content: 'Be helpful' });
      expect(callArgs.messages[1]).toEqual({ role: 'user', content: 'test' });
    });

    it('handles empty response gracefully', async () => {
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: null } }],
      });

      const result = await callChatLLM({
        system: 'system',
        messages: [{ role: 'user', content: 'test' }],
        tripId: 1,
      });

      expect(result.text).toBe('');
    });
  });
});
