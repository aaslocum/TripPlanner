<script setup>
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../../stores/auth';
import { useTripStore } from '../../stores/trip';
import apiClient from '../../api/client';
import TripSelector from './TripSelector.vue';

const authStore = useAuthStore();
const tripStore = useTripStore();
const showImpersonateModal = ref(false);
const tripMembers = ref([]);

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
  <header class="fixed top-0 left-0 right-0 h-16 z-50 flex items-center px-6"
    :class="authStore.isImpersonating ? 'bg-amber-50 border-b-2 border-amber-400' : 'bg-white border-b border-gray-200'">
    <div class="flex items-center gap-3">
      <svg class="w-7 h-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <h1 class="text-lg font-semibold text-gray-900">Trip Planner</h1>
    </div>

    <div class="ml-8">
      <TripSelector />
    </div>

    <div class="ml-auto flex items-center gap-3">
      <!-- Impersonation banner -->
      <div v-if="authStore.isImpersonating" class="flex items-center gap-2">
        <span class="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded">
          Viewing as {{ authStore.activeUser.first_name }} {{ authStore.activeUser.last_name }}
        </span>
        <button @click="authStore.stopImpersonating()" class="bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-amber-600 transition-colors">
          Exit Impersonation
        </button>
      </div>

      <!-- Impersonate button (real admin only, not while impersonating) -->
      <button
        v-if="authStore.isRealAdmin && !authStore.isImpersonating"
        @click="openImpersonateModal"
        class="text-xs text-gray-500 hover:text-gray-700 font-medium px-2 py-1 rounded hover:bg-gray-100 transition-colors"
      >
        Impersonate
      </button>

      <div v-if="authStore.activeUser" class="flex items-center gap-2">
        <img v-if="authStore.activeUser.avatar_url" :src="authStore.activeUser.avatar_url" class="w-8 h-8 rounded-full" />
        <div v-else class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-medium text-indigo-700">
          {{ authStore.activeUser.first_name?.[0] }}{{ authStore.activeUser.last_name?.[0] }}
        </div>
        <span class="text-sm text-gray-700">{{ authStore.activeUser.first_name }}</span>
      </div>
    </div>
  </header>

  <!-- Impersonate Modal -->
  <Teleport to="body">
    <div v-if="showImpersonateModal" class="fixed inset-0 z-[100] flex items-center justify-center">
      <div class="absolute inset-0 bg-black/40" @click="showImpersonateModal = false"></div>
      <div class="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[70vh] flex flex-col">
        <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900">Impersonate User</h3>
          <button @click="showImpersonateModal = false" class="text-gray-400 hover:text-gray-600">&times;</button>
        </div>
        <div class="overflow-y-auto p-4">
          <p class="text-xs text-gray-500 mb-3">Select a trip member to see the app from their perspective.</p>
          <div class="space-y-1">
            <button
              v-for="member in tripMembers"
              :key="member.user_id"
              @click="selectUser(member)"
              class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left"
              :class="member.user_id === authStore.user?.user_id ? 'opacity-40 pointer-events-none' : ''"
            >
              <div class="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-medium text-indigo-700 shrink-0">
                {{ member.first_name?.[0] || '?' }}{{ member.last_name?.[0] || '' }}
              </div>
              <div class="min-w-0">
                <p class="text-sm font-medium text-gray-900 truncate">{{ member.first_name }} {{ member.last_name }}</p>
                <p class="text-xs text-gray-500 truncate">{{ member.email }}</p>
              </div>
              <span v-if="member.role === 'admin'" class="ml-auto text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full shrink-0">Admin</span>
            </button>
          </div>
          <p v-if="!tripMembers.length" class="text-sm text-gray-500 text-center py-4">No trip members found.</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>
