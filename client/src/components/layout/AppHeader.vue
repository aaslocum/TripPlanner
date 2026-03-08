<script setup>
import { useAuthStore } from '../../stores/auth';
import TripSelector from './TripSelector.vue';

const authStore = useAuthStore();
</script>

<template>
  <header class="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50 flex items-center px-6">
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
      <div v-if="authStore.user" class="flex items-center gap-2">
        <img v-if="authStore.user.avatar_url" :src="authStore.user.avatar_url" class="w-8 h-8 rounded-full" />
        <div v-else class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-medium text-indigo-700">
          {{ authStore.user.first_name?.[0] }}{{ authStore.user.last_name?.[0] }}
        </div>
        <span class="text-sm text-gray-700">{{ authStore.user.first_name }}</span>
      </div>
    </div>
  </header>
</template>
