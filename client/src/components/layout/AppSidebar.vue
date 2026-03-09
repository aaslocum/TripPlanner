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
  { path: '/accommodations', label: 'Stays', icon: 'home' },
  { path: '/activities', label: 'Activities', icon: 'calendar' },
  { path: '/itinerary', label: 'Itinerary', icon: 'list' },
  { path: '/map', label: 'Map', icon: 'map' },
];

const adminItems = [
  { path: '/users', label: 'Users', icon: 'users' },
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
  <!-- Desktop sidebar (unchanged) -->
  <aside class="hidden md:block fixed left-0 top-16 bottom-0 w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 p-4">
    <nav class="space-y-1">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        :class="route.path === item.path ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'"
      >
        <svg v-if="item.icon === 'home'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        <svg v-if="item.icon === 'calendar'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <svg v-if="item.icon === 'list'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
        <svg v-if="item.icon === 'map'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        {{ item.label }}
      </router-link>

      <template v-if="authStore.isAdmin">
        <div class="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
          <p class="px-3 text-xs font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider mb-2">Admin</p>
          <router-link
            v-for="item in adminItems"
            :key="item.path"
            :to="item.path"
            class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            :class="route.path === item.path ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'"
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

  <!-- Mobile bottom tab bar -->
  <nav class="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 z-50 flex items-stretch">
    <router-link
      v-for="item in navItems"
      :key="item.path"
      :to="item.path"
      class="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors"
      :class="route.path === item.path ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'"
    >
      <svg v-if="item.icon === 'home'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
      <svg v-if="item.icon === 'calendar'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <svg v-if="item.icon === 'list'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
      <svg v-if="item.icon === 'map'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
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
        <div class="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-gray-900 shadow-xl flex flex-col">
          <!-- Drawer header -->
          <div class="h-14 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center gap-2">
              <svg class="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="font-semibold text-gray-900 dark:text-gray-100">Trip Planner</span>
            </div>
            <button @click="emit('close-drawer')" class="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- User info -->
          <div v-if="authStore.activeUser" class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center gap-3">
              <img v-if="authStore.activeUser.avatar_url" :src="authStore.activeUser.avatar_url" class="w-10 h-10 rounded-full" />
              <div v-else class="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-sm font-medium text-indigo-700 dark:text-indigo-300">
                {{ authStore.activeUser.first_name?.[0] }}{{ authStore.activeUser.last_name?.[0] }}
              </div>
              <div class="min-w-0">
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ authStore.activeUser.first_name }} {{ authStore.activeUser.last_name }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ authStore.activeUser.email }}</p>
              </div>
            </div>
          </div>

          <!-- Drawer nav -->
          <div class="flex-1 overflow-y-auto p-3 space-y-1">
            <!-- Admin section -->
            <template v-if="authStore.isAdmin">
              <p class="px-3 pt-2 pb-1 text-xs font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider">Admin</p>
              <router-link
                v-for="item in adminItems"
                :key="item.path"
                :to="item.path"
                class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                :class="route.path === item.path ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                {{ item.label }}
              </router-link>
              <div class="border-t border-gray-200 dark:border-gray-700 my-2"></div>
            </template>

            <!-- Dark mode toggle -->
            <button @click="toggleDark" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
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
          <div class="border-t border-gray-200 dark:border-gray-700 p-3">
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
