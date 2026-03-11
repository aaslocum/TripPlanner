<script setup>
import { ref, watch, onMounted, computed } from 'vue';
import { useTripStore } from '../stores/trip';
import apiClient from '../api/client';

const tripStore = useTripStore();

// ---- User Context Profiles + Preferences ----
const users = ref([]);
const selectedUserId = ref(null);
const selectedUserData = ref(null); // holds first_name, last_name, email for round-trip
const userContext = ref('');
const userPrefs = ref({
  pref_activity_style: '',
  pref_dietary: '',
  pref_budget_tier: '',
  pref_mobility: '',
  pref_drinks: '',
});
const ucLoading = ref(false);
const ucSaving = ref(false);
const ucSaved = ref(false);
const ucError = ref('');

async function fetchUsers() {
  try {
    const { data } = await apiClient.get('/users');
    users.value = data.data;
  } catch {}
}

async function loadUserContext() {
  if (!selectedUserId.value) {
    userContext.value = '';
    selectedUserData.value = null;
    userPrefs.value = { pref_activity_style: '', pref_dietary: '', pref_budget_tier: '', pref_mobility: '', pref_drinks: '' };
    return;
  }
  ucLoading.value = true;
  ucError.value = '';
  try {
    const [ctxRes, userRes] = await Promise.all([
      apiClient.get(`/users/${selectedUserId.value}/context`),
      apiClient.get(`/users/${selectedUserId.value}`),
    ]);
    userContext.value = ctxRes.data.data.context || '';
    const u = userRes.data.data;
    selectedUserData.value = { first_name: u.first_name, last_name: u.last_name, email: u.email };
    userPrefs.value = {
      pref_activity_style: u.pref_activity_style || '',
      pref_dietary: u.pref_dietary || '',
      pref_budget_tier: u.pref_budget_tier || '',
      pref_mobility: u.pref_mobility || '',
      pref_drinks: u.pref_drinks || '',
    };
  } catch (err) {
    ucError.value = err.response?.data?.error?.message || 'Failed to load user data';
  } finally {
    ucLoading.value = false;
  }
}

async function saveUserProfile() {
  if (!selectedUserId.value || !selectedUserData.value) return;
  ucSaving.value = true;
  ucSaved.value = false;
  ucError.value = '';
  try {
    await Promise.all([
      apiClient.put(`/users/${selectedUserId.value}`, {
        ...selectedUserData.value,
        ...userPrefs.value,
      }),
      apiClient.put(`/users/${selectedUserId.value}/context`, {
        context: userContext.value || null,
      }),
    ]);
    ucSaved.value = true;
    setTimeout(() => (ucSaved.value = false), 3000);
  } catch (err) {
    ucError.value = err.response?.data?.error?.message || 'Save failed';
  } finally {
    ucSaving.value = false;
  }
}

watch(selectedUserId, () => { loadUserContext(); });

// ---- AI Prompt Settings ----
const settings = ref({
  agent_voice_prompt: '',
  behavior_rules: '',
  global_chat_accommodations_prompt: '',
  global_chat_activities_prompt: '',
  global_chat_itinerary_prompt: '',
  global_chat_map_prompt: '',
  llm_provider: 'claude',
  ollama_base_url: 'http://localhost:11434',
  ollama_model: 'llama3.2',
});
const loading = ref(false);
const saving = ref(false);
const saved = ref(false);
const saveError = ref('');

// ---- LLM Provider ----
const llmSaving = ref(false);
const llmSaved = ref(false);
const llmSaveError = ref('');
const llmTesting = ref(false);
const llmTestResult = ref(null); // { ok, models?, error? }

async function saveLLMSettings() {
  llmSaving.value = true;
  llmSaved.value = false;
  llmSaveError.value = '';
  try {
    await apiClient.put('/ai-settings', {
      llm_provider: settings.value.llm_provider,
      ollama_base_url: settings.value.ollama_base_url,
      ollama_model: settings.value.ollama_model,
    });
    llmSaved.value = true;
    setTimeout(() => (llmSaved.value = false), 3000);
  } catch (err) {
    llmSaveError.value = err.response?.data?.error?.message || 'Save failed';
  } finally {
    llmSaving.value = false;
  }
}

async function testLLMConnection() {
  llmTesting.value = true;
  llmTestResult.value = null;
  try {
    const { data } = await apiClient.get('/agent/test-llm');
    llmTestResult.value = data.data;
  } catch (err) {
    llmTestResult.value = { ok: false, error: err.response?.data?.error?.message || 'Connection failed' };
  } finally {
    llmTesting.value = false;
  }
}

// ---- Context Preview ----
const contextPreview = ref('');
const contextLoading = ref(false);
const contextError = ref('');
const previewPage = ref('accommodations');

const pagePromptKeys = [
  { key: 'global_chat_accommodations_prompt', label: 'Accommodations', icon: '🛏️', desc: 'Helps users find and claim beds. Has access to detailed bed availability.' },
  { key: 'global_chat_activities_prompt', label: 'Activities', icon: '🏔️', desc: 'Helps users add activities. Returns JSON to pre-fill the activity form.' },
  { key: 'global_chat_itinerary_prompt', label: 'Itinerary', icon: '📅', desc: 'Answers questions about the trip schedule. Read-only — cannot make changes.' },
  { key: 'global_chat_map_prompt', label: 'Map', icon: '🗺️', desc: 'Centers the map on locations. Returns JSON with geocodable location strings.' },
];

const assembledPreview = computed(() => {
  const voice = settings.value.agent_voice_prompt?.trim();
  const rules = settings.value.behavior_rules?.trim();
  const promptKey = `global_chat_${previewPage.value}_prompt`;
  let prompt = settings.value[promptKey] || '';

  const ctx = contextPreview.value || '[Load context below to preview]';
  prompt = prompt.replaceAll('{{TRIP_CONTEXT}}', ctx);
  prompt = prompt.replaceAll('{{PAGE_CONTEXT}}', '[Page-specific data injected at runtime]');

  let assembled = '';
  if (voice) assembled += voice + '\n\n---\n\n';
  if (rules) assembled += rules + '\n\n';
  assembled += prompt;
  return assembled;
});

async function fetchSettings() {
  loading.value = true;
  try {
    const { data } = await apiClient.get('/ai-settings');
    settings.value = { ...settings.value, ...data.data };
  } finally {
    loading.value = false;
  }
}

async function saveSettings() {
  saving.value = true;
  saved.value = false;
  saveError.value = '';
  try {
    await apiClient.put('/ai-settings', settings.value);
    saved.value = true;
    setTimeout(() => (saved.value = false), 3000);
  } catch (err) {
    saveError.value = err.response?.data?.error?.message || 'Save failed';
  } finally {
    saving.value = false;
  }
}

async function loadContext() {
  if (!tripStore.selectedTripId) return;
  contextLoading.value = true;
  contextError.value = '';
  try {
    const { data } = await apiClient.get(`/agent/preview-context?tripId=${tripStore.selectedTripId}`);
    contextPreview.value = data.data.context;
  } catch (err) {
    contextError.value = err.response?.data?.error?.message || 'Failed to load context';
  } finally {
    contextLoading.value = false;
  }
}

onMounted(() => {
  fetchSettings();
  fetchUsers();
  if (tripStore.selectedTripId) loadContext();
});
</script>

<template>
  <div class="max-w-3xl">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-display font-black uppercase tracking-wide text-flag-black dark:text-warm-100">AI Settings</h2>
        <p class="text-sm text-warm-500 dark:text-warm-400 mt-0.5">Configure the prompts sent to Claude for the Travel Agent panel</p>
      </div>
      <button
        @click="saveSettings"
        :disabled="saving || loading"
        class="flex items-center gap-2 bg-trip-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-trip-accent-hover transition-colors disabled:opacity-50"
      >
        <svg v-if="saving" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <svg v-else-if="saved" class="w-4 h-4 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
        {{ saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes' }}
      </button>
    </div>

    <div v-if="saveError" class="mb-4 p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-lg text-sm">
      {{ saveError }}
    </div>

    <div v-if="loading" class="py-16 text-center text-warm-500 dark:text-warm-400">Loading settings...</div>

    <div v-else class="space-y-6">

      <!-- How it works -->
      <div class="bg-trip-accent-light dark:bg-trip-accent/10 border border-trip-accent/30 dark:border-trip-accent/30 rounded-xl p-4 text-sm">
        <p class="font-medium text-flag-black dark:text-warm-100 mb-1">How the Travel Agent works</p>
        <ul class="text-trip-accent dark:text-trip-accent space-y-0.5 list-disc list-inside">
          <li>The agent panel adapts to the current page (Accommodations, Activities, Itinerary, Map)</li>
          <li>Each page has its own prompt — edit them below to customize behavior</li>
          <li><strong>Tone &amp; Voice</strong> is prepended to every prompt automatically</li>
          <li><strong>Behavior Rules</strong> (no fabrication, no sycophancy, etc.) are prepended after voice</li>
          <li>Use <code class="bg-trip-accent/10 dark:bg-trip-accent/20 px-1 rounded">&#123;&#123;TRIP_CONTEXT&#125;&#125;</code> and <code class="bg-trip-accent/10 dark:bg-trip-accent/20 px-1 rounded">&#123;&#123;PAGE_CONTEXT&#125;&#125;</code> as placeholders for live data</li>
          <li>After extended conversations (7+ turns), the agent gets progressively more impatient</li>
        </ul>
      </div>

      <!-- LLM Provider -->
      <div class="bg-surface dark:bg-dark-surface rounded-xl border border-warm-200 dark:border-dark-border p-5">
        <div class="flex items-start justify-between mb-4">
          <div>
            <label class="block text-sm font-semibold text-flag-black dark:text-warm-100">LLM Provider</label>
            <p class="text-xs text-warm-500 dark:text-warm-400 mt-0.5">Switch between Claude (cloud) and Ollama (local). Changes take effect immediately on next message.</p>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="saveLLMSettings"
              :disabled="llmSaving"
              class="flex items-center gap-1.5 bg-trip-accent text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-trip-accent-hover transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <svg v-if="llmSaving" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <svg v-else-if="llmSaved" class="w-3.5 h-3.5 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              {{ llmSaved ? 'Saved!' : llmSaving ? 'Saving...' : 'Save LLM Settings' }}
            </button>
          </div>
        </div>

        <div v-if="llmSaveError" class="text-xs text-red-600 dark:text-red-400 mb-3">{{ llmSaveError }}</div>

        <!-- Provider Select -->
        <div class="mb-4">
          <label class="block text-xs font-medium text-warm-700 dark:text-warm-300 mb-1.5">Provider</label>
          <select
            v-model="settings.llm_provider"
            class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100 focus:outline-none focus:ring-2 focus:ring-trip-accent"
          >
            <option value="claude">Claude (Sonnet 4) — cloud</option>
            <option value="ollama">Ollama — local</option>
          </select>
        </div>

        <!-- Ollama-specific fields -->
        <div v-if="settings.llm_provider === 'ollama'" class="space-y-3">
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="block text-xs font-medium text-warm-700 dark:text-warm-300 mb-1.5">Base URL</label>
              <input
                v-model="settings.ollama_base_url"
                type="text"
                placeholder="http://localhost:11434"
                class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100 focus:outline-none focus:ring-2 focus:ring-trip-accent"
              />
            </div>
            <div class="flex-1">
              <label class="block text-xs font-medium text-warm-700 dark:text-warm-300 mb-1.5">Model</label>
              <input
                v-model="settings.ollama_model"
                type="text"
                placeholder="llama3.2"
                class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100 focus:outline-none focus:ring-2 focus:ring-trip-accent"
              />
            </div>
          </div>

          <!-- Test connection -->
          <div class="flex items-center gap-3">
            <button
              @click="testLLMConnection"
              :disabled="llmTesting"
              class="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-warm-200 dark:bg-dark-raised text-warm-700 dark:text-warm-300 rounded-lg hover:bg-warm-200 dark:hover:bg-dark-border transition-colors disabled:opacity-50"
            >
              <svg v-if="llmTesting" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
              Test Connection
            </button>
            <!-- Test result -->
            <div v-if="llmTestResult" class="flex items-center gap-1.5 text-xs">
              <span v-if="llmTestResult.ok" class="flex items-center gap-1 text-green-600 dark:text-green-400">
                <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                Connected — {{ llmTestResult.models?.length || 0 }} model{{ llmTestResult.models?.length === 1 ? '' : 's' }}
                <span v-if="llmTestResult.models?.length" class="text-warm-500 dark:text-warm-400">({{ llmTestResult.models.join(', ') }})</span>
              </span>
              <span v-else class="flex items-center gap-1 text-red-600 dark:text-red-400">
                <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>
                {{ llmTestResult.error }}
              </span>
            </div>
          </div>

          <p class="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            Note: Ollama runs without tool use — the agent won't be able to query trip data. Switch back to Claude to re-enable tools.
          </p>
        </div>

        <div v-if="settings.llm_provider === 'claude'" class="text-xs text-warm-500 dark:text-warm-400 bg-warm-50 dark:bg-dark-bg border border-warm-200 dark:border-dark-border rounded-lg px-3 py-2">
          Using <strong>claude-sonnet-4-20250514</strong> with full tool access — can query trip data, members, activities, costs, and more.
        </div>
      </div>

      <!-- User Context Profiles -->
      <div class="bg-surface dark:bg-dark-surface rounded-xl border border-warm-200 dark:border-dark-border p-5">
        <div class="flex items-start justify-between mb-3">
          <div>
            <label class="block text-sm font-semibold text-flag-black dark:text-warm-100">User Profiles</label>
            <p class="text-xs text-warm-500 dark:text-warm-400 mt-0.5">Personalization context and travel preferences per user — context is encrypted at rest.</p>
          </div>
        </div>

        <div class="flex items-center gap-3 mb-3">
          <select
            v-model="selectedUserId"
            class="flex-1 border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100 focus:outline-none focus:ring-2 focus:ring-trip-accent"
          >
            <option :value="null">Select a user...</option>
            <option v-for="u in users" :key="u.user_id" :value="u.user_id">
              {{ u.first_name }} {{ u.last_name }} ({{ u.email }})
            </option>
          </select>
          <button
            @click="saveUserProfile"
            :disabled="ucSaving || !selectedUserId"
            class="flex items-center gap-1.5 bg-trip-accent text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-trip-accent-hover transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            <svg v-if="ucSaving" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <svg v-else-if="ucSaved" class="w-3.5 h-3.5 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            {{ ucSaved ? 'Saved!' : ucSaving ? 'Saving...' : 'Save Profile' }}
          </button>
        </div>

        <div v-if="ucError" class="text-xs text-red-600 dark:text-red-400 mb-2">{{ ucError }}</div>

        <div v-if="ucLoading" class="text-xs text-warm-400 dark:text-warm-500 py-8 text-center">Loading...</div>
        <template v-else-if="selectedUserId">
          <!-- Freeform context textarea -->
          <label class="block text-xs font-medium text-warm-700 dark:text-warm-300 mb-1.5">Personalization Context <span class="text-warm-400 dark:text-warm-500 font-normal">(encrypted)</span></label>
          <textarea
            v-model="userContext"
            rows="10"
            placeholder="# User Name — Client Profile&#10;&#10;## Communication Style&#10;- How they talk, texting habits, emoji usage&#10;&#10;## Interests&#10;- Hobbies, food preferences, activity preferences&#10;&#10;## Recent Context&#10;- Recent life events relevant to trip planning"
            class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm font-mono dark:bg-dark-raised dark:text-warm-100 focus:outline-none focus:ring-2 focus:ring-trip-accent resize-y mb-4"
          />

          <!-- Travel Preferences -->
          <div class="border-t border-warm-200 dark:border-dark-border pt-4">
            <p class="text-xs font-semibold text-warm-700 dark:text-warm-300 mb-3">Travel Preferences</p>
            <div class="grid grid-cols-2 gap-3">
              <!-- Activity Style -->
              <div>
                <label class="block text-xs font-medium text-warm-500 dark:text-warm-400 mb-1">Activity Style</label>
                <select
                  v-model="userPrefs.pref_activity_style"
                  class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100 focus:outline-none focus:ring-2 focus:ring-trip-accent"
                >
                  <option value="">Not set</option>
                  <option value="adventurous">Adventurous</option>
                  <option value="relaxed">Relaxed</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
              <!-- Budget Tier -->
              <div>
                <label class="block text-xs font-medium text-warm-500 dark:text-warm-400 mb-1">Budget Tier</label>
                <select
                  v-model="userPrefs.pref_budget_tier"
                  class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100 focus:outline-none focus:ring-2 focus:ring-trip-accent"
                >
                  <option value="">Not set</option>
                  <option value="budget">Budget</option>
                  <option value="moderate">Moderate</option>
                  <option value="luxury">Luxury</option>
                </select>
              </div>
              <!-- Dietary -->
              <div>
                <label class="block text-xs font-medium text-warm-500 dark:text-warm-400 mb-1">Dietary Restrictions</label>
                <input
                  v-model="userPrefs.pref_dietary"
                  type="text"
                  placeholder="e.g. vegan, gluten-free"
                  class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100 focus:outline-none focus:ring-2 focus:ring-trip-accent"
                />
              </div>
              <!-- Drinks -->
              <div>
                <label class="block text-xs font-medium text-warm-500 dark:text-warm-400 mb-1">Drink Preferences</label>
                <input
                  v-model="userPrefs.pref_drinks"
                  type="text"
                  placeholder="e.g. craft beer, no wine"
                  class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100 focus:outline-none focus:ring-2 focus:ring-trip-accent"
                />
              </div>
              <!-- Mobility -->
              <div class="col-span-2">
                <label class="block text-xs font-medium text-warm-500 dark:text-warm-400 mb-1">Mobility Notes</label>
                <input
                  v-model="userPrefs.pref_mobility"
                  type="text"
                  placeholder="e.g. no climbing, prefers flat terrain"
                  class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100 focus:outline-none focus:ring-2 focus:ring-trip-accent"
                />
              </div>
            </div>
          </div>
        </template>
        <div v-else class="text-xs text-warm-400 dark:text-warm-500 bg-warm-50 dark:bg-dark-bg border border-warm-200 dark:border-dark-border rounded-lg p-4 text-center italic">
          Select a user above to view or edit their profile
        </div>
      </div>

      <!-- Tone & Voice -->
      <div class="bg-surface dark:bg-dark-surface rounded-xl border border-warm-200 dark:border-dark-border p-5">
        <div class="mb-3">
          <label class="block text-sm font-semibold text-flag-black dark:text-warm-100">Tone &amp; Voice</label>
          <p class="text-xs text-warm-500 dark:text-warm-400 mt-0.5">Prepended to every prompt — defines how Claude communicates across all pages.</p>
        </div>
        <textarea
          v-model="settings.agent_voice_prompt"
          rows="10"
          class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm font-mono dark:bg-dark-raised dark:text-warm-100 focus:outline-none focus:ring-2 focus:ring-trip-accent resize-y"
        />
      </div>

      <!-- Behavior Rules -->
      <div class="bg-surface dark:bg-dark-surface rounded-xl border border-warm-200 dark:border-dark-border p-5">
        <div class="mb-3">
          <label class="block text-sm font-semibold text-flag-black dark:text-warm-100">Behavior Rules</label>
          <p class="text-xs text-warm-500 dark:text-warm-400 mt-0.5">Core rules prepended to every page prompt (no fabrication, no sycophancy, geographic accuracy, brevity).</p>
        </div>
        <textarea
          v-model="settings.behavior_rules"
          rows="8"
          class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm font-mono dark:bg-dark-raised dark:text-warm-100 focus:outline-none focus:ring-2 focus:ring-trip-accent resize-y"
        />
      </div>

      <!-- Page-specific prompts -->
      <div
        v-for="pp in pagePromptKeys"
        :key="pp.key"
        class="bg-surface dark:bg-dark-surface rounded-xl border border-warm-200 dark:border-dark-border p-5"
      >
        <div class="mb-3">
          <label class="block text-sm font-semibold text-flag-black dark:text-warm-100">{{ pp.icon }} {{ pp.label }} Page Prompt</label>
          <p class="text-xs text-warm-500 dark:text-warm-400 mt-0.5">{{ pp.desc }}</p>
        </div>
        <textarea
          v-model="settings[pp.key]"
          rows="8"
          class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm font-mono dark:bg-dark-raised dark:text-warm-100 focus:outline-none focus:ring-2 focus:ring-trip-accent resize-y"
        />
      </div>

      <!-- Live Trip Context -->
      <div class="bg-surface dark:bg-dark-surface rounded-xl border border-warm-200 dark:border-dark-border p-5">
        <div class="flex items-start justify-between mb-3">
          <div>
            <p class="text-sm font-semibold text-flag-black dark:text-warm-100">Live Trip Context Preview</p>
            <p class="text-xs text-warm-500 dark:text-warm-400 mt-0.5">
              What <code class="bg-warm-200 dark:bg-dark-raised px-1 rounded">&#123;&#123;TRIP_CONTEXT&#125;&#125;</code> expands to for <strong>{{ tripStore.selectedTrip?.trip_name || 'the selected trip' }}</strong>
            </p>
          </div>
          <button
            @click="loadContext"
            :disabled="contextLoading || !tripStore.selectedTripId"
            class="text-xs px-3 py-1.5 bg-warm-200 dark:bg-dark-raised text-warm-700 dark:text-warm-300 rounded-lg hover:bg-warm-200 dark:hover:bg-dark-border transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <svg v-if="contextLoading" class="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <svg v-else class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        <div v-if="contextError" class="text-xs text-red-600 dark:text-red-400 mb-2">{{ contextError }}</div>

        <pre v-if="contextPreview" class="text-xs bg-warm-50 dark:bg-dark-bg border border-warm-200 dark:border-dark-border rounded-lg p-3 overflow-x-auto text-warm-700 dark:text-warm-300 whitespace-pre-wrap">{{ contextPreview }}</pre>
        <div v-else class="text-xs text-warm-400 dark:text-warm-500 bg-warm-50 dark:bg-dark-bg border border-warm-200 dark:border-dark-border rounded-lg p-3 italic">
          Click Refresh to load the current trip context
        </div>
      </div>

      <!-- Full Prompt Preview -->
      <div class="bg-surface dark:bg-dark-surface rounded-xl border border-warm-200 dark:border-dark-border p-5">
        <div class="flex items-start justify-between mb-3">
          <div>
            <p class="text-sm font-semibold text-flag-black dark:text-warm-100">Full Prompt Preview</p>
            <p class="text-xs text-warm-500 dark:text-warm-400 mt-0.5">Read-only — the complete system prompt Claude receives, assembled from voice + rules + page prompt</p>
          </div>
          <select
            v-model="previewPage"
            class="text-xs border border-warm-300 dark:border-dark-border rounded-lg px-2 py-1.5 dark:bg-dark-raised dark:text-warm-300"
          >
            <option v-for="pp in pagePromptKeys" :key="pp.key" :value="pp.key.replace('global_chat_', '').replace('_prompt', '')">
              {{ pp.icon }} {{ pp.label }}
            </option>
          </select>
        </div>
        <pre class="text-xs bg-warm-50 dark:bg-dark-bg border border-warm-200 dark:border-dark-border rounded-lg p-3 overflow-x-auto text-warm-700 dark:text-warm-300 whitespace-pre-wrap max-h-96 overflow-y-auto">{{ assembledPreview }}</pre>
      </div>

    </div>
  </div>
</template>
