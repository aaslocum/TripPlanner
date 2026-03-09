<script setup>
import { ref, watch, onMounted } from 'vue';
import { useTripStore } from '../stores/trip';
import apiClient from '../api/client';

const tripStore = useTripStore();

// Proposals list
const proposals = ref([]);
const loadingProposals = ref(false);

// UI state: 'idle' | 'prompt' | 'questions' | 'proposal_preview'
const stage = ref('idle');
const error = ref('');

// Stage: prompt
const DEFAULT_SYSTEM_PROMPT = `You are a travel agent. Your client already has a trip planned, but they want you to help them get the most out of it. You want to ask 4 questions that when answered will give you better context to provide high quality suggestions. Use what you already know about this trip to ask some questions that will result in good information to offer suggestions. However, it's critical that you don't ask the client anything too direct, like "what do you want to do" or "what kind of activities do you like". The questions should be abstract, but telling — in a way that the client doesn't know what you're getting at. For example, "How long has it been since your last massage? Was it good?" as an indicator for how much the client might value a spa day. Return ONLY a JSON array of exactly 4 question strings, no other text.`;
const systemPrompt = ref(DEFAULT_SYSTEM_PROMPT);
const loadingQuestions = ref(false);

// Stage: questions
const questions = ref([]);
const answers = ref(['', '', '', '']);
const loadingProposal = ref(false);

// Stage: proposal preview
const proposalPreview = ref(null);
const savingProposal = ref(false);

async function fetchProposals() {
  if (!tripStore.selectedTripId) return;
  loadingProposals.value = true;
  try {
    const { data } = await apiClient.get(`/proposals/trip/${tripStore.selectedTripId}`);
    proposals.value = data.data;
  } catch {
    // Table may not exist yet or server not running — fail silently
  } finally {
    loadingProposals.value = false;
  }
}

async function generateQuestions() {
  error.value = '';
  loadingQuestions.value = true;
  try {
    const { data } = await apiClient.post('/agent/questions', {
      tripId: tripStore.selectedTripId,
      promptOverride: systemPrompt.value,
    });
    questions.value = data.data.questions;
    answers.value = data.data.questions.map(() => '');
    stage.value = 'questions';
  } catch (e) {
    error.value = e.response?.data?.error?.message || 'Failed to generate questions.';
  } finally {
    loadingQuestions.value = false;
  }
}

async function generateProposal() {
  error.value = '';
  loadingProposal.value = true;
  try {
    const qa = questions.value.map((q, i) => ({ question: q, answer: answers.value[i] }));
    const { data } = await apiClient.post('/agent/proposal', {
      tripId: tripStore.selectedTripId,
      qa,
    });
    proposalPreview.value = data.data;
    stage.value = 'proposal_preview';
  } catch (e) {
    error.value = e.response?.data?.error?.message || 'Failed to generate proposal.';
  } finally {
    loadingProposal.value = false;
  }
}

async function saveProposal() {
  savingProposal.value = true;
  try {
    await apiClient.post('/proposals', {
      trip_id: tripStore.selectedTripId,
      ...proposalPreview.value,
    });
    await fetchProposals();
    stage.value = 'idle';
    proposalPreview.value = null;
    questions.value = [];
    answers.value = [];
    systemPrompt.value = DEFAULT_SYSTEM_PROMPT;
  } finally {
    savingProposal.value = false;
  }
}

async function deleteProposal(id) {
  if (!confirm('Delete this proposal?')) return;
  await apiClient.delete(`/proposals/${id}`);
  await fetchProposals();
}

function startAgentFlow() {
  stage.value = 'prompt';
  error.value = '';
}

function cancelFlow() {
  stage.value = 'idle';
  error.value = '';
  proposalPreview.value = null;
  questions.value = [];
  answers.value = [];
}

function formatDate(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

watch(() => tripStore.selectedTripId, fetchProposals);
onMounted(fetchProposals);
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Travel Agent</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">AI-powered trip enhancement proposals</p>
      </div>
      <button
        v-if="stage === 'idle'"
        @click="startAgentFlow"
        class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        Ask the agent for ideas
      </button>
      <button v-else @click="cancelFlow" class="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
        ← Cancel
      </button>
    </div>

    <!-- Error -->
    <div v-if="error" class="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
      {{ error }}
    </div>

    <!-- Stage: Prompt editor -->
    <div v-if="stage === 'prompt'" class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Agent System Prompt</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Edit the instructions sent to Claude before generating questions.</p>
      <textarea
        v-model="systemPrompt"
        rows="8"
        class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:text-gray-100 font-mono leading-relaxed resize-y"
      ></textarea>
      <button
        @click="generateQuestions"
        :disabled="loadingQuestions"
        class="mt-4 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
      >
        <svg v-if="loadingQuestions" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        {{ loadingQuestions ? 'Generating questions...' : 'Generate Questions' }}
      </button>
    </div>

    <!-- Stage: Questions -->
    <div v-if="stage === 'questions'" class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">A few questions first...</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">Answer these to help the agent tailor recommendations.</p>
      <div class="space-y-5">
        <div v-for="(question, i) in questions" :key="i">
          <label class="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1.5">{{ i + 1 }}. {{ question }}</label>
          <textarea
            v-model="answers[i]"
            rows="2"
            class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:text-gray-100 resize-none"
            placeholder="Your answer..."
          ></textarea>
        </div>
      </div>
      <button
        @click="generateProposal"
        :disabled="loadingProposal || answers.some(a => !a.trim())"
        class="mt-5 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
      >
        <svg v-if="loadingProposal" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        {{ loadingProposal ? 'Generating proposal...' : 'Generate Proposal' }}
      </button>
    </div>

    <!-- Stage: Proposal preview -->
    <div v-if="stage === 'proposal_preview' && proposalPreview" class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <div class="flex items-start justify-between mb-4">
        <div>
          <div class="inline-flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-medium px-2.5 py-1 rounded-full mb-2">
            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
            AI Proposal
          </div>
          <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">{{ proposalPreview.proposal_name }}</h3>
          <p v-if="proposalPreview.estimated_cost" class="text-sm text-green-700 dark:text-green-400 mt-1">Estimated cost: ${{ proposalPreview.estimated_cost }}</p>
        </div>
      </div>

      <!-- Proposal text (rendered as preformatted for now) -->
      <div class="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 whitespace-pre-wrap text-sm leading-relaxed mb-6 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">{{ proposalPreview.proposal_text }}</div>

      <!-- Places -->
      <div v-if="proposalPreview.places?.length" class="mb-6">
        <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Referenced Places</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div
            v-for="(place, i) in proposalPreview.places"
            :key="i"
            class="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
          >
            <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ place.name }}</p>
            <p v-if="place.address" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ place.address }}</p>
            <p v-if="place.description" class="text-xs text-gray-600 dark:text-gray-400 mt-1">{{ place.description }}</p>
          </div>
        </div>
      </div>

      <div class="flex gap-3">
        <button
          @click="saveProposal"
          :disabled="savingProposal"
          class="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {{ savingProposal ? 'Saving...' : 'Save Proposal' }}
        </button>
        <button @click="cancelFlow" class="px-5 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          Discard
        </button>
      </div>
    </div>

    <!-- Proposals list -->
    <div v-if="stage === 'idle'">
      <div v-if="loadingProposals" class="text-center py-12 text-gray-400">Loading...</div>

      <div v-else-if="proposals.length === 0" class="text-center py-16 text-gray-500 dark:text-gray-400">
        <svg class="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <p class="text-lg font-medium">No proposals yet</p>
        <p class="text-sm mt-1">Ask the agent for ideas to get started</p>
      </div>

      <div v-else class="space-y-4">
        <div
          v-for="proposal in proposals"
          :key="proposal.proposal_id"
          class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
        >
          <div class="flex items-start justify-between mb-3">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-xs font-medium px-2 py-0.5 rounded-full">AI Proposal</span>
                <span class="text-xs text-gray-400 dark:text-gray-500">{{ formatDate(proposal.created_at) }}</span>
              </div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ proposal.proposal_name }}</h3>
              <p v-if="proposal.estimated_cost" class="text-sm text-green-700 dark:text-green-400 mt-0.5">Est. ${{ proposal.estimated_cost }}</p>
            </div>
            <button @click="deleteProposal(proposal.proposal_id)" class="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">{{ proposal.proposal_text }}</div>
          <div v-if="proposal.places?.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            <div
              v-for="(place, i) in proposal.places"
              :key="i"
              class="border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-xs"
            >
              <p class="font-medium text-gray-900 dark:text-gray-100">{{ place.name }}</p>
              <p v-if="place.address" class="text-gray-500 dark:text-gray-400 mt-0.5">{{ place.address }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
