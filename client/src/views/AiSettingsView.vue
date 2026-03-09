<script setup>
import { ref, onMounted, computed } from 'vue';
import { useTripStore } from '../stores/trip';
import apiClient from '../api/client';

const tripStore = useTripStore();

// Settings state
const settings = ref({
  agent_voice_prompt: '',
  activity_chat_question_prompt: '',
  activity_chat_fill_prompt: '',
});
const loading = ref(false);
const saving = ref(false);
const saved = ref(false);
const saveError = ref('');

// Context preview state
const contextPreview = ref('');
const contextLoading = ref(false);
const contextError = ref('');

// Computed: full prompt previews with voice + context substituted
const buildFullPrompt = (prompt) => {
  const voicePrefix = settings.value.agent_voice_prompt
    ? `${settings.value.agent_voice_prompt}\n\n---\n\n`
    : '';
  return voicePrefix + prompt.replace('{{TRIP_CONTEXT}}', contextPreview.value || '[Load context below to preview]');
};
const questionPromptPreview = computed(() => buildFullPrompt(settings.value.activity_chat_question_prompt));
const fillPromptPreview    = computed(() => buildFullPrompt(settings.value.activity_chat_fill_prompt));

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
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Configure the prompts sent to Claude for the Activity Chat feature</p>
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

    <div v-if="loading" class="py-16 text-center text-gray-500 dark:text-gray-400">Loading settings…</div>

    <div v-else class="space-y-6">

      <!-- How it works -->
      <div class="bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800 rounded-xl p-4 text-sm">
        <p class="font-medium text-violet-900 dark:text-violet-200 mb-1">How Activity Chat works</p>
        <ul class="text-violet-700 dark:text-violet-300 space-y-0.5 list-disc list-inside">
          <li>Claude asks follow-up questions using the <strong>Questions Prompt</strong> until it has enough context (up to 6 turns)</li>
          <li>It can return <code class="bg-violet-100 dark:bg-violet-900 px-1 rounded">formData</code> JSON early if it feels confident — no need to wait for turn 6</li>
          <li>Turn 6+ forces the <strong>Form Fill Prompt</strong> regardless</li>
          <li>The <strong>Tone & Voice</strong> block is prepended to every prompt automatically</li>
          <li>Use <code class="bg-violet-100 dark:bg-violet-900 px-1 rounded">&#123;&#123;TRIP_CONTEXT&#125;&#125;</code> as a placeholder — replaced with live trip data (members + interests + activities) at runtime</li>
          <li>After each completed chat, Claude writes a brief interest note on that user — visible in the context preview</li>
        </ul>
      </div>

      <!-- Tone & Voice -->
      <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div class="mb-3">
          <label class="block text-sm font-semibold text-gray-900 dark:text-gray-100">Tone &amp; Voice</label>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Prepended to every prompt — defines how Claude communicates. Affects all turns of the chat.</p>
        </div>
        <textarea
          v-model="settings.agent_voice_prompt"
          rows="12"
          class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-mono dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
        />
      </div>

      <!-- Follow-up Questions Prompt -->
      <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div class="mb-3">
          <label class="block text-sm font-semibold text-gray-900 dark:text-gray-100">Follow-up Questions Prompt</label>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Used on turns 1–5 — Claude asks one question at a time, or returns JSON <code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">formData</code> when it has enough context</p>
        </div>
        <textarea
          v-model="settings.activity_chat_question_prompt"
          rows="10"
          class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-mono dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
        />
      </div>

      <!-- Form Fill Prompt -->
      <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div class="mb-3">
          <label class="block text-sm font-semibold text-gray-900 dark:text-gray-100">Form Fill Prompt</label>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Forced on turn 6+ — Claude must return valid JSON with a <code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">formData</code> object</p>
        </div>
        <textarea
          v-model="settings.activity_chat_fill_prompt"
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
              What <code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">&#123;&#123;TRIP_CONTEXT&#125;&#125;</code> expands to for <strong>{{ tripStore.selectedTrip?.trip_name || 'the selected trip' }}</strong> — includes member interests if any have been noted
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
        <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Full Request Preview</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">Read-only — the complete system prompt Claude receives, with voice prefix and trip context substituted in</p>

        <div class="space-y-4">
          <div>
            <p class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Turns 1–5 (Follow-up Questions)</p>
            <pre class="text-xs bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg p-3 overflow-x-auto text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{{ questionPromptPreview }}</pre>
          </div>
          <div>
            <p class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Turn 6+ (Forced Form Fill)</p>
            <pre class="text-xs bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg p-3 overflow-x-auto text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{{ fillPromptPreview }}</pre>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
