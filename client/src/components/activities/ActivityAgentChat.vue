<script setup>
import { ref, nextTick, onMounted } from 'vue';
import apiClient from '../../api/client';
import { useAuthStore } from '../../stores/auth';

const props = defineProps({
  tripId: { type: [Number, String], required: true },
});

const emit = defineEmits(['fill', 'close']);

const authStore = useAuthStore();
const inputText = ref('');
const isTyping = ref(false);
const messagesEl = ref(null);

const messages = ref([
  {
    id: 1,
    role: 'agent',
    content: "Hey, how can I help? What kind of activity are you looking for?",
  },
]);

// Full conversation history sent to the API
const history = ref([
  { role: 'assistant', content: "Hey, how can I help? What kind of activity are you looking for?", _initial: true },
]);

let idCounter = 1;

async function scrollToBottom() {
  await nextTick();
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
  }
}

async function send() {
  const content = inputText.value.trim();
  if (!content || isTyping.value) return;
  inputText.value = '';

  messages.value.push({ id: ++idCounter, role: 'user', content });
  history.value.push({ role: 'user', content });
  await scrollToBottom();

  isTyping.value = true;
  try {
    const { data } = await apiClient.post('/agent/activity-chat', {
      tripId: props.tripId,
      messages: history.value,
    });

    const { message, formData } = data.data;
    messages.value.push({ id: ++idCounter, role: 'agent', content: message });
    history.value.push({ role: 'assistant', content: message });
    await scrollToBottom();

    if (formData) {
      await new Promise(r => setTimeout(r, 1800));
      emit('fill', formData);
      emit('close');
    }
  } catch {
    messages.value.push({
      id: ++idCounter,
      role: 'agent',
      content: "Sorry, I ran into an issue. Please try again.",
    });
    await scrollToBottom();
  } finally {
    isTyping.value = false;
  }
}

function onKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send();
  }
}

onMounted(scrollToBottom);
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50" @click="emit('close')" />

      <!-- Chat panel -->
      <div class="relative w-full sm:max-w-md bg-white dark:bg-gray-900 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden" style="height: 520px; max-height: 90vh;">

        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 bg-violet-600 flex-shrink-0">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p class="text-white font-semibold text-sm leading-tight">Travel Agent</p>
              <p class="text-violet-200 text-xs leading-tight">I'll help find something great</p>
            </div>
          </div>
          <button @click="emit('close')" class="text-white/70 hover:text-white transition-colors p-1">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Messages -->
        <div ref="messagesEl" class="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50 dark:bg-gray-950">
          <div
            v-for="msg in messages"
            :key="msg.id"
            class="flex"
            :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
          >
            <!-- Agent avatar -->
            <div v-if="msg.role === 'agent'" class="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
              <svg class="w-3.5 h-3.5 text-violet-600 dark:text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div
              class="max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed"
              :class="msg.role === 'user'
                ? 'bg-violet-600 text-white rounded-br-sm'
                : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-bl-sm shadow-sm'"
            >
              {{ msg.content }}
            </div>
          </div>

          <!-- Typing indicator -->
          <Transition name="fade">
            <div v-if="isTyping" class="flex justify-start items-end gap-2">
              <div class="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center flex-shrink-0">
                <svg class="w-3.5 h-3.5 text-violet-600 dark:text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex gap-1">
                <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0ms" />
                <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 150ms" />
                <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 300ms" />
              </div>
            </div>
          </Transition>
        </div>

        <!-- Input -->
        <div class="flex-shrink-0 px-4 py-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex gap-2 items-end">
          <textarea
            v-model="inputText"
            @keydown="onKeydown"
            :disabled="isTyping"
            rows="1"
            placeholder="Type a message..."
            class="flex-1 resize-none border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50 max-h-24 overflow-auto"
          />
          <button
            @click="send"
            :disabled="!inputText.trim() || isTyping"
            class="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center hover:bg-violet-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
