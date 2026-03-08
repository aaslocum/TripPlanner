<script setup>
import { useRoute } from 'vue-router';
import { useAuthStore } from '../../stores/auth';

const route = useRoute();
const authStore = useAuthStore();

const navItems = [
  { path: '/accommodations', label: 'Accommodations', icon: 'home' },
  { path: '/activities', label: 'Activities', icon: 'calendar' },
  { path: '/itinerary', label: 'Itinerary', icon: 'list' },
  { path: '/map', label: 'Map', icon: 'map' },
];

const adminItems = [
  { path: '/users', label: 'Users', icon: 'users' },
];
</script>

<template>
  <aside class="fixed left-0 top-16 bottom-0 w-56 bg-white border-r border-gray-200 p-4">
    <nav class="space-y-1">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        :class="route.path === item.path ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'"
      >
        <!-- Home icon -->
        <svg v-if="item.icon === 'home'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        <!-- Calendar icon -->
        <svg v-if="item.icon === 'calendar'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <!-- List icon -->
        <svg v-if="item.icon === 'list'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
        <!-- Map icon -->
        <svg v-if="item.icon === 'map'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        {{ item.label }}
      </router-link>

      <!-- Admin section -->
      <template v-if="authStore.isAdmin">
        <div class="pt-4 mt-4 border-t border-gray-200">
          <p class="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Admin</p>
          <router-link
            v-for="item in adminItems"
            :key="item.path"
            :to="item.path"
            class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            :class="route.path === item.path ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            {{ item.label }}
          </router-link>
        </div>
      </template>
    </nav>
  </aside>
</template>
