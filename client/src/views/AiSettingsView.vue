<script setup>
import { ref, onMounted, computed } from 'vue';
import { useTripStore } from '../stores/trip';
import apiClient from '../api/client';

const tripStore = useTripStore();

// Settings state — keys match ai_settings table
const settings = ref({
  agent_voice_prompt: '',
  behavior_rules: '',
  global_chat_accommodations_prompt: '',
  global_chat_activities_prompt: '',
  global_chat_itinerary_prompt: '',
  global_chat_map_prompt: '',
});
const loading = ref(false);
const saving = ref(false);
const saved = ref(false);
const saveError = ref('');

// Context preview state
const contextPreview = ref('');
const contextLoading = ref(false);
const contextError = ref('');

// Which page prompt to preview assembled
const previewPage = ref('accommodations');

const pagePromptKeys = [
  { key: 'global_chat_accommodations_prompt', label: 'Accommodations', icon: '🛏️', desc: 'Helps users find and claim beds. Has access to detailed bed availability.' },
  { key: 'global_chat_activities_prompt', label: 'Activities', icon: '🏔️', desc: 'Helps users add activities. Returns JSON to pre-fill the activity form.' },
  { key: 'global_chat_itinerary_prompt', label: 'Itinerary', icon: '📅', desc: 'Answers questions about the trip schedule. Read-only — cannot make changes.' },
  { key: 'global_chat_map_prompt', label: 'Map', icon: '🗺️', desc: 'Centers the map on locations. Returns JSON with geocodable location strings.' },
];

// Assembled prompt preview
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
  if (tripStore.selectedTripId) loadContext();
});
</script>

<template>
  <div class="max-w-3xl">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">AI Settings</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Configure the prompts sent to Claude for the Travel Agent panel</p>
      </div>
      <button
        @click="saveSettings"
        :disabled="saving || loading"
        class="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
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

    <div v-if="loading" class="py-16 text-center text-gray-500 dark:text-gray-400">Loading settings...</div>

    <div v-else class="space-y-6">

      <!-- How it works -->
      <div class="bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800 rounded-xl p-4 text-sm">
        <p class="font-medium text-violet-900 dark:text-violet-200 mb-1">How the Travel Agent works</p>
        <ul class="text-violet-700 dark:text-violet-300 space-y-0.5 list-disc list-inside">
          <li>The agent panel adapts to the current page (Accommodations, Activities, Itinerary, Map)</li>
          <li>Each page has its own prompt — edit them below to customize behavior</li>
          <li><strong>Tone &amp; Voice</strong> is prepended to every prompt automatically</li>
          <li><strong>Behavior Rules</strong> (no fabrication, no sycophancy, etc.) are prepended after voice</li>
          <li>Use <code class="bg-violet-100 dark:bg-violet-900 px-1 rounded">&#123;&#123;TRIP_CONTEXT&#125;&#125;</code> and <code class="bg-violet-100 dark:bg-violet-900 px-1 rounded">&#123;&#123;PAGE_CONTEXT&#125;&#125;</code> as placeholders for live data</li>
          <li>After extended conversations (7+ turns), the agent gets progressively more impatient</li>
        </ul>
      </div>

      <!-- Tone & Voice -->
      <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div class="mb-3">
          <label class="block text-sm font-semibold text-gray-900 dark:text-gray-100">Tone &amp; Voice</label>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Prepended to every prompt — defines how Claude communicates across all pages.</p>
        </div>
        <textarea
          v-model="settings.agent_voice_prompt"
          rows="10"
          class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-mono dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
        />
      </div>

      <!-- Behavior Rules -->
      <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div class="mb-3">
          <label class="block text-sm font-semibold text-gray-900 dark:text-gray-100">Behavior Rules</label>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Core rules prepended to every page prompt (no fabrication, no sycophancy, geographic accuracy, brevity).</p>
        </div>
        <textarea
          v-model="settings.behavior_rules"
          rows="8"
          class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-mono dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
        />
      </div>

      <!-- Page-specific prompts -->
      <div
        v-for="pp in pagePromptKeys"
        :key="pp.key"
        class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5"
      >
        <div class="mb-3">
          <label class="block text-sm font-semibold text-gray-900 dark:text-gray-100">{{ pp.icon }} {{ pp.label }} Page Prompt</label>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ pp.desc }}</p>
        </div>
        <textarea
          v-model="settings[pp.key]"
          rows="8"
          class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-mono dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
        />
      </div>

      <!-- Live Trip Context -->
      <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div class="flex items-start justify-between mb-3">
          <div>
            <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">Live Trip Context Preview</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              What <code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">&#123;&#123;TRIP_CONTEXT&#125;&#125;</code> expands to for <strong>{{ tripStore.selectedTrip?.trip_name || 'the selected trip' }}</strong>
            </p>
          </div>
          <button
            @click="loadContext"
            :disabled="contextLoading || !tripStore.selectedTripId"
            class="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
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

        <pre v-if="contextPreview" class="text-xs bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg p-3 overflow-x-auto text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{{ contextPreview }}</pre>
        <div v-else class="text-xs text-gray-400 dark:text-gray-600 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg p-3 italic">
          Click Refresh to load the current trip context
        </div>
      </div>

      <!-- Full Prompt Preview -->
      <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div class="flex items-start justify-between mb-3">
          <div>
            <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">Full Prompt Preview</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Read-only — the complete system prompt Claude receives, assembled from voice + rules + page prompt</p>
          </div>
          <select
            v-model="previewPage"
            class="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 dark:bg-gray-800 dark:text-gray-300"
          >
            <option v-for="pp in pagePromptKeys" :key="pp.key" :value="pp.key.replace('global_chat_', '').replace('_prompt', '')">
              {{ pp.icon }} {{ pp.label }}
            </option>
          </select>
        </div>
        <pre class="text-xs bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg p-3 overflow-x-auto text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-96 overflow-y-auto">{{ assembledPreview }}</pre>
      </div>

    </div>
  </div>
</template>
