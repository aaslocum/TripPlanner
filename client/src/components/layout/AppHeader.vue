<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '../../stores/auth';
import { useTripStore } from '../../stores/trip';
import apiClient from '../../api/client';
import TripSelector from './TripSelector.vue';
import { useDarkMode } from '../../composables/useDarkMode';

const emit = defineEmits(['toggle-menu']);

const authStore = useAuthStore();
const tripStore = useTripStore();
const { isDark, toggle } = useDarkMode();
const showImpersonateModal = ref(false);
const tripMembers = ref([]);
const rsvpStatus = ref(null);
const showRsvpDropdown = ref(false);
const rsvpDropdownRef = ref(null);

async function fetchMyRsvp() {
  if (!tripStore.selectedTripId) { rsvpStatus.value = null; return; }
  try {
    const { data } = await apiClient.get(`/trips/${tripStore.selectedTripId}/members/me`);
    rsvpStatus.value = data.data?.rsvp_status || 'pending';
  } catch {
    rsvpStatus.value = null; // Not a member of this trip
  }
}

async function submitRsvp(status) {
  if (!tripStore.selectedTripId) return;
  try {
    await apiClient.put(`/trips/${tripStore.selectedTripId}/members/me`, { rsvp_status: status });
    rsvpStatus.value = status;
  } catch (err) {
    console.error('RSVP failed:', err);
  }
  showRsvpDropdown.value = false;
}

function handleClickOutsideRsvp(e) {
  if (rsvpDropdownRef.value && !rsvpDropdownRef.value.contains(e.target)) {
    showRsvpDropdown.value = false;
  }
}

onMounted(() => {
  fetchMyRsvp();
  document.addEventListener('click', handleClickOutsideRsvp);
});
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutsideRsvp);
});
watch(() => tripStore.selectedTripId, fetchMyRsvp);

async function openImpersonateModal() {
  if (!tripStore.selectedTripId) return;
  const { data } = await apiClient.get(`/trips/${tripStore.selectedTripId}/members`);
  tripMembers.value = data.data;
  showImpersonateModal.value = true;
}

function selectUser(user) {
  authStore.impersonate(user);
  showImpersonateModal.value = false;
}
</script>

<template>
  <header class="fixed top-0 left-0 right-0 h-14 md:h-16 z-50 flex items-center px-3 md:px-6"
    :class="authStore.isImpersonating ? 'bg-amber-50 dark:bg-amber-950 border-b-2 border-amber-400 dark:border-amber-600' : 'bg-flag-black border-b border-warm-700'">

    <!-- Hamburger (mobile only) -->
    <button @click="emit('toggle-menu')" class="md:hidden p-2 -ml-1 mr-1 rounded-lg text-white/80 hover:bg-white/10">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>

    <div class="flex items-center gap-2 md:gap-3">
      <svg class="w-6 h-6 md:w-7 md:h-7 text-trip-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <h1 class="hidden md:block text-lg font-display font-bold uppercase tracking-wide text-white">Framily Trip Planner</h1>
    </div>

    <div class="ml-3 md:ml-8">
      <TripSelector />
    </div>

    <!-- RSVP Button -->
    <div v-if="rsvpStatus !== null && !authStore.isImpersonating" ref="rsvpDropdownRef" class="ml-4 relative">
      <button
        v-if="rsvpStatus !== 'yes'"
        @click="showRsvpDropdown = !showRsvpDropdown"
        class="bg-trip-accent hover:bg-trip-accent-hover text-white text-xs font-display font-bold uppercase tracking-wider px-4 py-1.5 rounded-full transition-colors flex items-center gap-1.5"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        RSVP
      </button>
      <span
        v-else
        class="text-xs font-display font-bold uppercase tracking-wider text-green-400 flex items-center gap-1"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        Going
      </span>

      <!-- Dropdown -->
      <div
        v-if="showRsvpDropdown"
        class="absolute top-full mt-2 right-0 bg-surface dark:bg-dark-surface rounded-lg shadow-xl border border-warm-200 dark:border-dark-border p-2 min-w-[180px] z-50"
      >
        <button
          @click="submitRsvp('yes')"
          class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-950 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          I'm going!
        </button>
        <button
          @click="submitRsvp('no')"
          class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Can't make it
        </button>
      </div>
    </div>

    <div class="ml-auto flex items-center gap-2 md:gap-3">
      <!-- Impersonation banner -->
      <div v-if="authStore.isImpersonating" class="flex items-center gap-2">
        <span class="hidden md:inline text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900 px-2 py-1 rounded">
          Viewing as {{ authStore.activeUser.first_name }} {{ authStore.activeUser.last_name }}
        </span>
        <button @click="authStore.stopImpersonating()" class="bg-amber-500 text-white px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-xs font-medium hover:bg-amber-600 transition-colors">
          Exit
        </button>
      </div>

      <!-- Impersonate button (desktop only) -->
      <button
        v-if="authStore.isRealAdmin && !authStore.isImpersonating"
        @click="openImpersonateModal"
        class="hidden md:block text-xs text-white/60 hover:text-white font-medium px-2 py-1 rounded hover:bg-white/10 transition-colors"
      >
        Impersonate
      </button>

      <!-- Dark mode toggle (desktop only) -->
      <button
        @click="toggle"
        class="hidden md:block p-2 rounded-lg text-white/60 hover:bg-white/10 transition-colors"
        :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
      >
        <svg v-if="isDark" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      </button>

      <div v-if="authStore.activeUser" class="flex items-center gap-2">
        <img v-if="authStore.activeUser.avatar_url" :src="authStore.activeUser.avatar_url" class="w-8 h-8 rounded-full" />
        <div v-else class="w-8 h-8 rounded-full bg-trip-accent/20 flex items-center justify-center text-sm font-medium text-trip-accent">
          {{ authStore.activeUser.first_name?.[0] }}{{ authStore.activeUser.last_name?.[0] }}
        </div>
        <span class="hidden md:inline text-sm text-white/80">{{ authStore.activeUser.first_name }}</span>
      </div>
    </div>
  </header>

  <!-- Impersonate Modal -->
  <Teleport to="body">
    <div v-if="showImpersonateModal" class="fixed inset-0 z-[100] flex items-center justify-center">
      <div class="absolute inset-0 bg-black/40 dark:bg-black/60" @click="showImpersonateModal = false"></div>
      <div class="relative bg-surface dark:bg-dark-surface rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[70vh] flex flex-col">
        <div class="px-6 py-4 border-b border-warm-200 dark:border-dark-border flex items-center justify-between">
          <h3 class="text-lg font-semibold text-flag-black dark:text-warm-100">Impersonate User</h3>
          <button @click="showImpersonateModal = false" class="text-warm-400 dark:text-warm-500 hover:text-warm-600 dark:hover:text-warm-300">&times;</button>
        </div>
        <div class="overflow-y-auto p-4">
          <p class="text-xs text-warm-500 dark:text-warm-400 mb-3">Select a trip member to see the app from their perspective.</p>
          <div class="space-y-1">
            <button
              v-for="member in tripMembers"
              :key="member.user_id"
              @click="selectUser(member)"
              class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-warm-50 dark:hover:bg-dark-raised transition-colors text-left"
              :class="member.user_id === authStore.user?.user_id ? 'opacity-40 pointer-events-none' : ''"
            >
              <div class="w-9 h-9 rounded-full bg-trip-accent-light dark:bg-trip-accent/20 flex items-center justify-center text-sm font-medium text-trip-accent shrink-0">
                {{ member.first_name?.[0] || '?' }}{{ member.last_name?.[0] || '' }}
              </div>
              <div class="min-w-0">
                <p class="text-sm font-medium text-flag-black dark:text-warm-100 truncate">{{ member.first_name }} {{ member.last_name }}</p>
                <p class="text-xs text-warm-500 dark:text-warm-400 truncate">{{ member.email }}</p>
              </div>
              <span v-if="member.role === 'admin'" class="ml-auto text-xs bg-trip-accent-light dark:bg-trip-accent/20 text-trip-accent px-2 py-0.5 rounded-full shrink-0">Admin</span>
            </button>
          </div>
          <p v-if="!tripMembers.length" class="text-sm text-warm-500 dark:text-warm-400 text-center py-4">No trip members found.</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>
