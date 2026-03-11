<script setup>
import { ref, watch, computed, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { useAgentStore } from '../../stores/agent';
import { useAuthStore } from '../../stores/auth';
import { useTripStore } from '../../stores/trip';
import apiClient from '../../api/client';
import { marked } from 'marked';

// Configure marked for safe, compact output
marked.setOptions({
  breaks: true,
  gfm: true,
});

function renderMarkdown(text) {
  if (!text) return '';
  return marked.parse(text);
}

const route = useRoute();
const agentStore = useAgentStore();
const authStore = useAuthStore();
const tripStore = useTripStore();

const isOpen = ref(false);
const messages = ref([]);
const inputText = ref('');
const isLoading = ref(false);
const messagesEnd = ref(null);
const pendingLocalAction = ref(null); // action waiting for user confirmation

// RSVP gate state
const rsvpStatus = ref(null); // null = loading, 'pending' | 'yes' | 'no'
const rsvpLoading = ref(false);
const showRsvpGate = computed(() => !authStore.isAdmin && rsvpStatus.value !== 'yes');

async function fetchRsvpStatus() {
  const tripId = tripStore.selectedTripId;
  if (!tripId) return;
  try {
    const { data } = await apiClient.get(`/trips/${tripId}/members/me`);
    rsvpStatus.value = data.data?.rsvp_status || 'pending';
  } catch {
    rsvpStatus.value = 'pending';
  }
}

async function submitRsvp(status) {
  const tripId = tripStore.selectedTripId;
  if (!tripId) return;
  rsvpLoading.value = true;
  try {
    await apiClient.put(`/trips/${tripId}/members/me`, { rsvp_status: status });
    rsvpStatus.value = status;
    if (status === 'yes') resetConversation();
  } catch {
    // silent — user can retry
  } finally {
    rsvpLoading.value = false;
  }
}

// Re-fetch RSVP when trip changes
watch(() => tripStore.selectedTripId, () => {
  if (!authStore.isAdmin) fetchRsvpStatus();
}, { immediate: true });

// Map route names to backend page keys
const PAGE_MAP = {
  Overview: 'overview',
  Accommodations: 'accommodations',
  Activities: 'activities',
  Eats: 'eats',
  Itinerary: 'itinerary',
  Map: 'map',
  Guests: 'attendees',
  Logistics: 'logistics',
};

const currentPage = computed(() => PAGE_MAP[route.name] || 'itinerary');

const PAGE_GREETINGS = {
  overview: "Hey! I can answer questions about this trip — what's planned, who's going, and anything else you want to know.",
  accommodations: "Hey! I can help you find a place to sleep. Tell me what you're looking for or ask about what beds are available.",
  activities: "Hey! Let's plan something fun. What kind of activity are you thinking — or want to change something that's already planned?",
  eats: "Hey! Let's find some great places to eat — or tweak an existing reservation. What are you in the mood for?",
  itinerary: "Hey! I can answer questions about the trip schedule. What would you like to know?",
  map: "Hey! Where would you like to go? I can center the map on any location.",
  attendees: "Hey! I can help with questions about who's coming on the trip, RSVP statuses, and travel dates.",
  logistics: "Hey! I can help you set up or update your travel plans — flights, driving, rideshares, you name it.",
};

const PAGE_TITLES = {
  overview: 'Trip Overview',
  accommodations: 'Room Finder',
  activities: 'Activity Planner',
  eats: 'Restaurant Finder',
  itinerary: 'Itinerary Info',
  map: 'Map Navigator',
  attendees: 'Trip Guests',
  logistics: 'Travel Logistics',
};

// SVG path inner HTML for each page — mirrors sidebar nav icons
const PAGE_ICON_SVGS = {
  overview: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>',
  accommodations: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>',
  activities: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>',
  eats: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 10C4 7.239 7.582 6 12 6s8 1.239 8 4H4z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 13h18M3 16h18"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19h14c0 1.657-1.567 3-3.5 3h-7C6.567 22 5 20.657 5 19z"/>',
  itinerary: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>',
  map: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>',
  attendees: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>',
  logistics: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 16l1-2h6l2-3h4l4 2 2 1 1 2H1z"/><circle cx="7" cy="18" r="2" stroke-width="2"/><circle cx="17" cy="18" r="2" stroke-width="2"/>',
};

const panelTitle = computed(() => PAGE_TITLES[currentPage.value] || 'Travel Agent');

function resetConversation() {
  pendingLocalAction.value = null;
  messages.value = [{
    role: 'assistant',
    content: PAGE_GREETINGS[currentPage.value] || "Hey! How can I help with your trip?",
    _initial: true,
  }];
}

// Reset conversation whenever the page changes
watch(() => route.name, () => {
  resetConversation();
}, { immediate: true });

async function scrollToBottom() {
  await nextTick();
  messagesEnd.value?.scrollIntoView({ behavior: 'smooth' });
}

async function sendMessage() {
  const text = inputText.value.trim();
  if (!text || isLoading.value) return;

  inputText.value = '';
  messages.value.push({ role: 'user', content: text });
  pendingLocalAction.value = null;
  isLoading.value = true;
  await scrollToBottom();

  try {
    const tripId = tripStore.selectedTripId;
    const payload = {
      tripId,
      page: currentPage.value,
      messages: messages.value,
    };
    // When admin is impersonating another user, tell the server who to personalize for
    if (authStore.isImpersonating && authStore.impersonating?.email) {
      payload.asUser = authStore.impersonating.email;
    }
    const res = await apiClient.post('/agent/chat', payload);

    const { message, action } = res.data.data;
    messages.value.push({ role: 'assistant', content: message });

    if (action) {
      if (action.type === 'center-map') {
        // Immediate — no confirmation needed
        agentStore.dispatch(action);
      } else {
        // Requires user confirmation
        pendingLocalAction.value = action;
      }
    }
  } catch (err) {
    const code = err?.response?.data?.error?.code;
    if (code === 'RSVP_REQUIRED') {
      rsvpStatus.value = err.response.data.error.rsvp_status || 'pending';
    } else {
      messages.value.push({
        role: 'assistant',
        content: "Hmm, something went wrong on my end. Try again?",
      });
    }
  } finally {
    isLoading.value = false;
    await scrollToBottom();
  }
}

function confirmAction() {
  if (!pendingLocalAction.value) return;
  agentStore.dispatch(pendingLocalAction.value);
  pendingLocalAction.value = null;
  // Don't close panel — wait for result feedback
}

// Watch for action results from page views and show feedback
watch(() => agentStore.lastActionResult, async (result) => {
  if (!result) return;
  messages.value.push({
    role: 'assistant',
    content: result.success
      ? `✅ ${result.message}`
      : `❌ ${result.message}`,
  });
  agentStore.clearResult();
  await scrollToBottom();
});

function cancelAction() {
  messages.value.push({
    role: 'assistant',
    content: "No worries, we can try something else.",
  });
  pendingLocalAction.value = null;
}

function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

// Friendly label for the pending action card
const ACTION_TYPE_LABELS = {
  'request-bed': 'Request Bed',
  'add-activity': 'Add Activity',
  'edit-activity': 'Edit Activity',
  'add-eat': 'Add Restaurant',
  'edit-eat': 'Edit Restaurant',
  'add-logistics': 'Add Transport',
  'edit-logistics': 'Edit Transport',
};

const actionTypeLabel = computed(() => {
  const a = pendingLocalAction.value;
  if (!a) return '';
  return ACTION_TYPE_LABELS[a.type] || 'Action';
});

const actionLabel = computed(() => {
  const a = pendingLocalAction.value;
  if (!a) return '';
  if (a.type === 'request-bed') return a.description || `Bed #${a.bedId}`;
  if (a.type === 'add-activity' || a.type === 'edit-activity') {
    const f = a.formData || {};
    const parts = [f.title || 'Activity'];
    if (f.estimated_cost) parts.push(`~$${f.estimated_cost}`);
    if (f.duration) parts.push(`${f.duration}h`);
    return parts.join(' · ');
  }
  if (a.type === 'add-eat' || a.type === 'edit-eat') {
    const f = a.formData || {};
    const parts = [f.title || 'Restaurant'];
    if (f.estimated_cost) parts.push(`~$${f.estimated_cost}/pp`);
    if (f.duration) parts.push(`${f.duration}h`);
    return parts.join(' · ');
  }
  if (a.type === 'add-logistics' || a.type === 'edit-logistics') {
    const f = a.formData || {};
    const parts = [];
    if (f.mode) parts.push(f.mode);
    if (f.departure_from) parts.push(`from ${f.departure_from}`);
    return parts.join(' · ') || 'Transport entry';
  }
  return '';
});

const actionConfirmLabel = computed(() => {
  const a = pendingLocalAction.value;
  if (!a) return 'Confirm';
  if (a.type === 'request-bed') return 'Request It';
  if (a.type.startsWith('edit-')) return 'Apply Changes';
  return 'Fill Form';
});
</script>

<template>
  <!-- Floating toggle button (shown when panel is closed) -->
  <Teleport to="body">
    <button
      v-if="!isOpen"
      @click="isOpen = true"
      class="fixed bottom-24 md:bottom-8 right-4 z-40 bg-trip-accent hover:bg-trip-accent-hover active:bg-trip-accent-hover text-white rounded-full w-14 h-14 shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
      title="Open Travel Agent"
    >
      <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
      </svg>
    </button>

    <!-- Panel -->
    <Transition
      enter-active-class="transition-transform duration-300 ease-out"
      enter-from-class="translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition-transform duration-300 ease-in"
      leave-from-class="translate-x-0"
      leave-to-class="translate-x-full"
    >
      <div
        v-if="isOpen"
        class="fixed right-0 top-14 md:top-16 bottom-20 md:bottom-0 w-80 sm:w-96 z-40 bg-surface dark:bg-dark-surface shadow-2xl border-l border-warm-200 dark:border-dark-border flex flex-col"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-warm-200 dark:border-dark-border bg-trip-accent text-white flex-shrink-0">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" v-html="PAGE_ICON_SVGS[currentPage] || PAGE_ICON_SVGS.itinerary"></svg>
            <span class="font-semibold text-sm">{{ panelTitle }}</span>
          </div>
          <button @click="isOpen = false" class="hover:text-white/70 transition-colors p-1 -mr-1">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- RSVP Gate -->
        <div v-if="showRsvpGate" class="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div class="w-16 h-16 rounded-full bg-trip-accent-light dark:bg-trip-accent/10 flex items-center justify-center text-trip-accent mb-4">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
          </div>
          <h3 class="text-lg font-bold text-flag-black dark:text-warm-100 mb-2">Are you coming?</h3>
          <p class="text-sm text-warm-500 dark:text-warm-400 mb-6 leading-relaxed">
            The Travel Agent is available for confirmed attendees. Let us know if you're joining the trip!
          </p>
          <div class="flex gap-3 w-full max-w-xs">
            <button
              @click="submitRsvp('yes')"
              :disabled="rsvpLoading"
              class="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50"
            >
              I'm in!
            </button>
            <button
              @click="submitRsvp('no')"
              :disabled="rsvpLoading"
              class="flex-1 bg-warm-200 hover:bg-warm-300 dark:bg-dark-raised dark:hover:bg-dark-border text-warm-700 dark:text-warm-200 text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50"
            >
              Can't make it
            </button>
          </div>
          <p v-if="rsvpStatus === 'no'" class="text-xs text-warm-400 dark:text-warm-500 mt-4">
            Changed your mind? Tap "I'm in!" to confirm your attendance.
          </p>
        </div>

        <!-- Messages -->
        <template v-else>
        <div class="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          <div
            v-for="(msg, i) in messages"
            :key="i"
            class="flex"
            :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
          >
            <div
              v-if="msg.role === 'user'"
              class="max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed bg-trip-accent text-white rounded-br-sm"
            >
              {{ msg.content }}
            </div>
            <div
              v-else
              class="max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed bg-warm-100 dark:bg-dark-raised text-flag-black dark:text-warm-100 rounded-bl-sm agent-markdown"
              v-html="renderMarkdown(msg.content)"
            />
          </div>

          <!-- Typing indicator -->
          <div v-if="isLoading" class="flex justify-start">
            <div class="bg-warm-100 dark:bg-dark-raised rounded-2xl rounded-bl-sm px-3 py-2">
              <div class="flex gap-1 items-center h-4">
                <span class="w-1.5 h-1.5 bg-warm-400 rounded-full animate-bounce [animation-delay:0ms]"></span>
                <span class="w-1.5 h-1.5 bg-warm-400 rounded-full animate-bounce [animation-delay:150ms]"></span>
                <span class="w-1.5 h-1.5 bg-warm-400 rounded-full animate-bounce [animation-delay:300ms]"></span>
              </div>
            </div>
          </div>

          <!-- Action confirmation card -->
          <div v-if="pendingLocalAction && !isLoading" class="mx-1">
            <div class="bg-trip-accent-light dark:bg-trip-accent/10 border border-trip-accent/30 dark:border-trip-accent/30 rounded-xl p-3">
              <p class="text-xs font-semibold text-trip-accent mb-1 uppercase tracking-wide">
                {{ actionTypeLabel }}
              </p>
              <p class="text-sm text-warm-800 dark:text-warm-200 mb-3">{{ actionLabel }}</p>
              <div class="flex gap-2">
                <button
                  @click="confirmAction"
                  class="flex-1 bg-trip-accent hover:bg-trip-accent-hover text-white text-sm font-medium py-1.5 rounded-lg transition-colors"
                >
                  {{ actionConfirmLabel }}
                </button>
                <button
                  @click="cancelAction"
                  class="flex-1 bg-warm-200 hover:bg-warm-300 dark:bg-dark-raised dark:hover:bg-dark-border text-warm-700 dark:text-warm-200 text-sm font-medium py-1.5 rounded-lg transition-colors"
                >
                  Never mind
                </button>
              </div>
            </div>
          </div>

          <div ref="messagesEnd" />
        </div>

        <!-- Input -->
        <div class="border-t border-warm-200 dark:border-dark-border px-3 py-2.5 flex-shrink-0">
          <div class="flex gap-2 items-end">
            <textarea
              v-model="inputText"
              @keydown="handleKeydown"
              :disabled="isLoading"
              placeholder="Message..."
              rows="1"
              class="flex-1 resize-none rounded-xl border border-warm-200 dark:border-dark-border bg-warm-50 dark:bg-dark-raised text-sm text-flag-black dark:text-warm-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-trip-accent disabled:opacity-50 max-h-24 overflow-y-auto"
              style="field-sizing: content;"
            />
            <button
              @click="sendMessage"
              :disabled="isLoading || !inputText.trim()"
              class="bg-trip-accent hover:bg-trip-accent-hover disabled:opacity-40 text-white rounded-xl p-2 transition-colors flex-shrink-0"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
        </template>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
/* Markdown styling inside agent messages */
.agent-markdown p { margin: 0 0 0.4em; }
.agent-markdown p:last-child { margin-bottom: 0; }
.agent-markdown ul, .agent-markdown ol { margin: 0.3em 0; padding-left: 1.2em; }
.agent-markdown li { margin: 0.15em 0; }
.agent-markdown strong { font-weight: 600; }
.agent-markdown a { color: var(--color-trip-accent); text-decoration: underline; }
.dark .agent-markdown a { color: #4ade80; }
.agent-markdown code {
  background: rgba(0,0,0,0.06);
  padding: 0.1em 0.3em;
  border-radius: 3px;
  font-size: 0.85em;
}
.dark .agent-markdown code {
  background: rgba(255,255,255,0.1);
}
.agent-markdown img {
  max-width: 100%;
  border-radius: 8px;
  margin: 0.5em 0;
}
.agent-markdown blockquote {
  border-left: 3px solid var(--color-trip-accent);
  padding-left: 0.6em;
  margin: 0.4em 0;
  color: #6b7280;
}
.dark .agent-markdown blockquote {
  border-left-color: var(--color-trip-accent);
  color: #9ca3af;
}
</style>
