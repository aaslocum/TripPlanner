<script setup>
import { ref, watch, computed, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { useAgentStore } from '../../stores/agent';
import { useTripStore } from '../../stores/trip';
import apiClient from '../../api/client';

const route = useRoute();
const agentStore = useAgentStore();
const tripStore = useTripStore();

const isOpen = ref(false);
const messages = ref([]);
const inputText = ref('');
const isLoading = ref(false);
const messagesEnd = ref(null);
const pendingLocalAction = ref(null); // action waiting for user confirmation

// Map route names to backend page keys
const PAGE_MAP = {
  Accommodations: 'accommodations',
  Activities: 'activities',
  Itinerary: 'itinerary',
  Map: 'map',
};

const currentPage = computed(() => PAGE_MAP[route.name] || 'itinerary');

const PAGE_GREETINGS = {
  accommodations: "Hey! I can help you find a place to sleep. Tell me what you're looking for or ask about what beds are available.",
  activities: "Hey! Let's plan something fun. What kind of activity are you thinking?",
  itinerary: "Hey! I can answer questions about the trip schedule. What would you like to know?",
  map: "Hey! Where would you like to go? I can center the map on any location.",
};

const PAGE_TITLES = {
  accommodations: '🛏️ Room Finder',
  activities: '🏔️ Activity Planner',
  itinerary: '📅 Itinerary Info',
  map: '🗺️ Map Navigator',
};

const panelTitle = computed(() => PAGE_TITLES[currentPage.value] || '✈️ Travel Agent');

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
    const res = await apiClient.post('/agent/chat', {
      tripId,
      page: currentPage.value,
      messages: messages.value,
    });

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
  } catch {
    messages.value.push({
      role: 'assistant',
      content: "Hmm, something went wrong on my end. Try again?",
    });
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
const actionLabel = computed(() => {
  const a = pendingLocalAction.value;
  if (!a) return '';
  if (a.type === 'claim-bed') return a.description || `Bed #${a.bedId}`;
  if (a.type === 'add-activity') {
    const f = a.formData || {};
    const parts = [f.title || 'Activity'];
    if (f.estimated_cost) parts.push(`~$${f.estimated_cost}`);
    if (f.duration) parts.push(`${f.duration}h`);
    return parts.join(' · ');
  }
  return '';
});

const actionConfirmLabel = computed(() => {
  const a = pendingLocalAction.value;
  if (!a) return 'Confirm';
  if (a.type === 'claim-bed') return 'Claim It';
  if (a.type === 'add-activity') return 'Fill Form';
  return 'Confirm';
});
</script>

<template>
  <!-- Floating toggle button (shown when panel is closed) -->
  <Teleport to="body">
    <button
      v-if="!isOpen"
      @click="isOpen = true"
      class="fixed bottom-24 md:bottom-8 right-4 z-40 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white rounded-full w-14 h-14 shadow-lg flex items-center justify-center text-2xl transition-all duration-200 hover:scale-110"
      title="Open Travel Agent"
    >
      ✈️
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
        class="fixed right-0 top-14 md:top-16 bottom-20 md:bottom-0 w-80 sm:w-96 z-40 bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-violet-600 text-white flex-shrink-0">
          <div>
            <span class="font-semibold text-sm">{{ panelTitle }}</span>
          </div>
          <button @click="isOpen = false" class="hover:text-violet-200 transition-colors p-1 -mr-1">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Messages -->
        <div class="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          <div
            v-for="(msg, i) in messages"
            :key="i"
            class="flex"
            :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
          >
            <div
              class="max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed"
              :class="msg.role === 'user'
                ? 'bg-violet-600 text-white rounded-br-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm'"
            >
              {{ msg.content }}
            </div>
          </div>

          <!-- Typing indicator -->
          <div v-if="isLoading" class="flex justify-start">
            <div class="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-sm px-3 py-2">
              <div class="flex gap-1 items-center h-4">
                <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]"></span>
                <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]"></span>
                <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]"></span>
              </div>
            </div>
          </div>

          <!-- Action confirmation card -->
          <div v-if="pendingLocalAction && !isLoading" class="mx-1">
            <div class="bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800 rounded-xl p-3">
              <p class="text-xs font-semibold text-violet-700 dark:text-violet-300 mb-1 uppercase tracking-wide">
                {{ pendingLocalAction.type === 'claim-bed' ? 'Claim Bed' : 'Add Activity' }}
              </p>
              <p class="text-sm text-gray-800 dark:text-gray-200 mb-3">{{ actionLabel }}</p>
              <div class="flex gap-2">
                <button
                  @click="confirmAction"
                  class="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium py-1.5 rounded-lg transition-colors"
                >
                  {{ actionConfirmLabel }}
                </button>
                <button
                  @click="cancelAction"
                  class="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium py-1.5 rounded-lg transition-colors"
                >
                  Never mind
                </button>
              </div>
            </div>
          </div>

          <div ref="messagesEnd" />
        </div>

        <!-- Input -->
        <div class="border-t border-gray-200 dark:border-gray-700 px-3 py-2.5 flex-shrink-0">
          <div class="flex gap-2 items-end">
            <textarea
              v-model="inputText"
              @keydown="handleKeydown"
              :disabled="isLoading"
              placeholder="Message..."
              rows="1"
              class="flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50 max-h-24 overflow-y-auto"
              style="field-sizing: content;"
            />
            <button
              @click="sendMessage"
              :disabled="isLoading || !inputText.trim()"
              class="bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-xl p-2 transition-colors flex-shrink-0"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
