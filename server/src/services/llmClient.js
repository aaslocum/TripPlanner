import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import config from '../config/env.js';
import { getDb, get } from '../db/connection.js';
import { AGENT_TOOLS, executeTool } from './agentTools.js';

const anthropic = new Anthropic(config.anthropicApiKey ? { apiKey: config.anthropicApiKey } : {});

// ---------------------------------------------------------------------------
// Read LLM config from ai_settings table
// ---------------------------------------------------------------------------
async function getLLMConfig() {
  const db = await getDb();
  const provider = get(db, "SELECT value FROM ai_settings WHERE key = 'llm_provider'")?.value || 'claude';
  const baseUrl = get(db, "SELECT value FROM ai_settings WHERE key = 'ollama_base_url'")?.value || 'http://localhost:11434';
  const model = get(db, "SELECT value FROM ai_settings WHERE key = 'ollama_model'")?.value || 'llama3.2';
  return { provider, baseUrl, model };
}

// ---------------------------------------------------------------------------
// Main entry point — used by agent.js /chat handler
// ---------------------------------------------------------------------------
export async function callChatLLM({ system, messages, tripId }) {
  const cfg = await getLLMConfig();

  if (cfg.provider === 'ollama') {
    return callOllama({ system, messages, baseUrl: cfg.baseUrl, model: cfg.model });
  }

  return callClaudeWithTools({ system, messages, tripId });
}

// ---------------------------------------------------------------------------
// Claude path — with full tool_use loop
// ---------------------------------------------------------------------------
async function callClaudeWithTools({ system, messages, tripId }) {
  let loopMessages = [...messages];

  let response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system,
    tools: AGENT_TOOLS,
    messages: loopMessages,
  });

  while (response.stop_reason === 'tool_use') {
    const toolUses = response.content.filter(b => b.type === 'tool_use');
    console.log(`[agent/tools] ${toolUses.map(t => t.name).join(', ')}`);

    const toolResults = await Promise.all(
      toolUses.map(async t => ({
        type: 'tool_result',
        tool_use_id: t.id,
        content: JSON.stringify(await executeTool(t.name, tripId, t.input)),
      }))
    );

    loopMessages = [
      ...loopMessages,
      { role: 'assistant', content: response.content },
      { role: 'user', content: toolResults },
    ];

    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system,
      tools: AGENT_TOOLS,
      messages: loopMessages,
    });
  }

  const text = response.content.find(b => b.type === 'text')?.text?.trim() ?? '';
  return { text, provider: 'claude' };
}

// ---------------------------------------------------------------------------
// Ollama path — OpenAI-compatible API, no tools
// ---------------------------------------------------------------------------
async function callOllama({ system, messages, baseUrl, model }) {
  console.log(`[llm] provider=ollama model=${model} baseUrl=${baseUrl}`);

  const client = new OpenAI({
    baseURL: `${baseUrl}/v1`,
    apiKey: 'ollama', // required by SDK but not used by Ollama
  });

  // Convert Anthropic-style messages to OpenAI format
  const openAiMessages = [
    { role: 'system', content: system },
    ...messages.map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : m.content?.[0]?.text ?? '' })),
  ];

  const response = await client.chat.completions.create({
    model,
    messages: openAiMessages,
    max_tokens: 4096,
  });

  const text = response.choices[0]?.message?.content?.trim() ?? '';
  return { text, provider: 'ollama' };
}

// ---------------------------------------------------------------------------
// Ollama connection test — used by GET /api/agent/test-llm
// ---------------------------------------------------------------------------
export async function testOllamaConnection() {
  const cfg = await getLLMConfig();
  try {
    const res = await fetch(`${cfg.baseUrl}/api/tags`);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    const models = (data.models || []).map(m => m.name);
    return { ok: true, models, baseUrl: cfg.baseUrl };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
