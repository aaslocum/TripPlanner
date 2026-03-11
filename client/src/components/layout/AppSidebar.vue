<script setup>
import { watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
import { useDarkMode } from '../../composables/useDarkMode';

const props = defineProps({ drawerOpen: Boolean });
const emit = defineEmits(['close-drawer']);

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { isDark, toggle: toggleDark } = useDarkMode();

const navItems = [
  { path: '/overview', label: 'Overview', icon: 'overview' },
  { path: '/accommodations', label: 'Stays', icon: 'home', catColor: 'green' },
  { path: '/attendees', label: 'Guests', icon: 'attendees' },
  { path: '/activities', label: 'Activities', icon: 'calendar', catColor: 'purple' },
  { path: '/eats', label: 'Eats', icon: 'eats', catColor: 'red' },
  { path: '/itinerary', label: 'Itinerary', icon: 'list' },
  { path: '/map', label: 'Map', icon: 'map' },
  { path: '/logistics', label: 'Logistics', icon: 'logistics' },
];

// Category color classes for active nav items
const catActiveClass = {
  green: 'bg-flag-green-light dark:bg-flag-green/10 text-flag-green',
  purple: 'bg-flag-purple-light dark:bg-flag-purple/10 text-flag-purple',
  red: 'bg-flag-red-light dark:bg-flag-red/10 text-flag-red',
};
const defaultActiveClass = 'bg-trip-accent-light dark:bg-trip-accent/10 text-trip-accent';
const inactiveClass = 'text-warm-700 dark:text-warm-300 hover:bg-warm-50 dark:hover:bg-dark-raised';

function navClass(item) {
  if (route.path !== item.path) return inactiveClass;
  return item.catColor ? catActiveClass[item.catColor] : defaultActiveClass;
}

// Subset for the mobile bottom tab bar (max 5)
const mobileTabItems = [
  { path: '/overview', label: 'Overview', icon: 'overview' },
  { path: '/accommodations', label: 'Stays', icon: 'home', catColor: 'green' },
  { path: '/activities', label: 'Activities', icon: 'calendar', catColor: 'purple' },
  { path: '/itinerary', label: 'Itinerary', icon: 'list' },
  { path: '/map', label: 'Map', icon: 'map' },
];

const mobileActiveClass = {
  green: 'text-flag-green',
  purple: 'text-flag-purple',
  red: 'text-flag-red',
};

function mobileNavClass(item) {
  if (route.path !== item.path) return 'text-warm-500 dark:text-warm-400';
  return item.catColor ? mobileActiveClass[item.catColor] : 'text-trip-accent';
}

const adminItems = [
  { path: '/trips', label: 'Trips', icon: 'trips' },
  { path: '/users', label: 'Users', icon: 'users' },
  { path: '/travel-agent', label: 'Travel Agent', icon: 'agent' },
  { path: '/ai-settings', label: 'AI Settings', icon: 'ai-settings' },
];

// Close drawer on route change
watch(() => route.path, () => emit('close-drawer'));

function logout() {
  authStore.logout();
  router.push('/login');
  emit('close-drawer');
}
</script>

<template>
  <!-- Desktop sidebar -->
  <aside class="hidden md:block fixed left-0 top-16 bottom-0 w-56 bg-surface dark:bg-dark-surface border-r border-warm-200 dark:border-dark-border p-4 flex flex-col">
    <nav class="space-y-1 flex-1">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        :class="navClass(item)"
      >
        <svg v-if="item.icon === 'overview'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
        <svg v-if="item.icon === 'home'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        <svg v-if="item.icon === 'attendees'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <svg v-if="item.icon === 'calendar'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <svg v-if="item.icon === 'list'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
        <svg v-if="item.icon === 'eats'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 10C4 7.239 7.582 6 12 6s8 1.239 8 4H4z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 13h18M3 16h18" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19h14c0 1.657-1.567 3-3.5 3h-7C6.567 22 5 20.657 5 19z" />
        </svg>
        <svg v-if="item.icon === 'map'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        <svg v-if="item.icon === 'logistics'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 16l1-2h6l2-3h4l4 2 2 1 1 2H1z" />
          <circle cx="7" cy="18" r="2" stroke-width="2"/>
          <circle cx="17" cy="18" r="2" stroke-width="2"/>
        </svg>
        {{ item.label }}
      </router-link>

      <template v-if="authStore.isAdmin">
        <div class="pt-4 mt-4 border-t border-warm-200 dark:border-dark-border">
          <p class="px-3 text-xs font-display font-bold text-warm-400 dark:text-warm-500 uppercase tracking-wider mb-2">Admin</p>
          <router-link
            v-for="item in adminItems"
            :key="item.path"
            :to="item.path"
            class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            :class="route.path === item.path ? 'bg-trip-accent-light dark:bg-trip-accent/10 text-trip-accent' : 'text-warm-700 dark:text-warm-300 hover:bg-warm-50 dark:hover:bg-dark-raised'"
          >
            <svg v-if="item.icon === 'trips'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <svg v-if="item.icon === 'users'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <svg v-if="item.icon === 'logistics'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h2m6-12h2l3 4v6h-2m-3-6h3" />
            </svg>
            <svg v-if="item.icon === 'agent'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <svg v-if="item.icon === 'ai-settings'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            {{ item.label }}
          </router-link>
        </div>
      </template>
    </nav>

    <!-- Logout button -->
    <div class="border-t border-warm-200 dark:border-dark-border pt-3">
      <button @click="logout" class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        Log Out
      </button>
    </div>
  </aside>

  <!-- Mobile bottom tab bar -->
  <nav class="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-surface dark:bg-dark-surface border-t border-warm-200 dark:border-dark-border z-50 flex items-stretch">
    <router-link
      v-for="item in mobileTabItems"
      :key="item.path"
      :to="item.path"
      class="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors"
      :class="mobileNavClass(item)"
    >
      <svg v-if="item.icon === 'overview'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
      <svg v-if="item.icon === 'home'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
      <svg v-if="item.icon === 'attendees'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      <svg v-if="item.icon === 'calendar'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <svg v-if="item.icon === 'eats'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 0V4m-4.5 7.5L3 7m13.5 4.5L21 7M8 16l-3 4m11-4l3 4" />
      </svg>
      <svg v-if="item.icon === 'list'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
      <svg v-if="item.icon === 'map'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
      <svg v-if="item.icon === 'logistics'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h2m6-12h2l3 4v6h-2m-3-6h3" />
      </svg>
      <span>{{ item.label }}</span>
    </router-link>
  </nav>

  <!-- Mobile slide-out drawer -->
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="drawerOpen" class="md:hidden fixed inset-0 z-[90]">
        <!-- Overlay -->
        <div class="absolute inset-0 bg-black/40 dark:bg-black/60" @click="emit('close-drawer')"></div>
        <!-- Panel -->
        <div class="absolute left-0 top-0 bottom-0 w-64 bg-surface dark:bg-dark-surface shadow-xl flex flex-col">
          <!-- Drawer header -->
          <div class="h-14 flex items-center justify-between px-4 border-b border-warm-200 dark:border-dark-border">
            <div class="flex items-center gap-2">
              <svg class="w-6 h-6 text-trip-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="font-display font-bold uppercase tracking-wide text-flag-black dark:text-warm-100">Framily Trip Planner</span>
            </div>
            <button @click="emit('close-drawer')" class="p-1 rounded text-warm-400 hover:text-warm-600 dark:hover:text-warm-300">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- User info -->
          <div v-if="authStore.activeUser" class="px-4 py-3 border-b border-warm-200 dark:border-dark-border">
            <div class="flex items-center gap-3">
              <img v-if="authStore.activeUser.avatar_url" :src="authStore.activeUser.avatar_url" class="w-10 h-10 rounded-full" />
              <div v-else class="w-10 h-10 rounded-full bg-trip-accent-light dark:bg-trip-accent/20 flex items-center justify-center text-sm font-medium text-trip-accent">
                {{ authStore.activeUser.first_name?.[0] }}{{ authStore.activeUser.last_name?.[0] }}
              </div>
              <div class="min-w-0">
                <p class="text-sm font-medium text-flag-black dark:text-warm-100 truncate">{{ authStore.activeUser.first_name }} {{ authStore.activeUser.last_name }}</p>
                <p class="text-xs text-warm-500 dark:text-warm-400 truncate">{{ authStore.activeUser.email }}</p>
              </div>
            </div>
          </div>

          <!-- Drawer nav (items not in mobile tab bar) -->
          <div class="flex-1 overflow-y-auto p-3 space-y-1">
            <!-- Guests (not in mobile tab bar) -->
            <router-link
              to="/attendees"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
              :class="route.path === '/attendees' ? defaultActiveClass : inactiveClass"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Guests
            </router-link>
            <!-- Eats (not in mobile tab bar) -->
            <router-link
              to="/eats"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
              :class="route.path === '/eats' ? catActiveClass.red : inactiveClass"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 10C4 7.239 7.582 6 12 6s8 1.239 8 4H4z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 13h18M3 16h18" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19h14c0 1.657-1.567 3-3.5 3h-7C6.567 22 5 20.657 5 19z" />
              </svg>
              Eats
            </router-link>
            <!-- Logistics (not in mobile tab bar) -->
            <router-link
              to="/logistics"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
              :class="route.path === '/logistics' ? defaultActiveClass : inactiveClass"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 16l1-2h6l2-3h4l4 2 2 1 1 2H1z" />
                <circle cx="7" cy="18" r="2" stroke-width="2"/>
                <circle cx="17" cy="18" r="2" stroke-width="2"/>
              </svg>
              Logistics
            </router-link>
            <div class="border-t border-warm-200 dark:border-dark-border my-2"></div>

            <!-- Admin section -->
            <template v-if="authStore.isAdmin">
              <p class="px-3 pt-2 pb-1 text-xs font-display font-bold text-warm-400 dark:text-warm-500 uppercase tracking-wider">Admin</p>
              <router-link
                v-for="item in adminItems"
                :key="item.path"
                :to="item.path"
                class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                :class="route.path === item.path ? 'bg-trip-accent-light dark:bg-trip-accent/10 text-trip-accent' : 'text-warm-700 dark:text-warm-300 hover:bg-warm-50 dark:hover:bg-dark-raised'"
              >
                <svg v-if="item.icon === 'trips'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <svg v-if="item.icon === 'users'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <svg v-if="item.icon === 'agent'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <svg v-if="item.icon === 'ai-settings'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                {{ item.label }}
              </router-link>
              <div class="border-t border-warm-200 dark:border-dark-border my-2"></div>
            </template>

            <!-- Dark mode toggle -->
            <button @click="toggleDark" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-warm-700 dark:text-warm-300 hover:bg-warm-50 dark:hover:bg-dark-raised transition-colors">
              <svg v-if="isDark" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              {{ isDark ? 'Light Mode' : 'Dark Mode' }}
            </button>
          </div>

          <!-- Logout -->
          <div class="border-t border-warm-200 dark:border-dark-border p-3">
            <button @click="logout" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Log Out
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.2s ease;
}
.drawer-enter-active > div:last-child,
.drawer-leave-active > div:last-child {
  transition: transform 0.2s ease;
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}
.drawer-enter-from > div:last-child,
.drawer-leave-to > div:last-child {
  transform: translateX(-100%);
}
</style>
