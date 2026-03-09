<script setup>
import { ref, watch } from 'vue';
import { useAuthStore } from './stores/auth';
import { useTripStore } from './stores/trip';
import AppHeader from './components/layout/AppHeader.vue';
import AppSidebar from './components/layout/AppSidebar.vue';
import GlobalAgentPanel from './components/agent/GlobalAgentPanel.vue';

const authStore = useAuthStore();
const tripStore = useTripStore();
const drawerOpen = ref(false);

// Fetch trips when user becomes authenticated
watch(() => authStore.isAuthenticated, async (isAuth) => {
  if (isAuth) {
    await tripStore.fetchTrips();
  }
}, { immediate: true });
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
    <template v-if="authStore.isAuthenticated">
      <AppHeader @toggle-menu="drawerOpen = !drawerOpen" />
      <div class="flex">
        <AppSidebar :drawer-open="drawerOpen" @close-drawer="drawerOpen = false" />
        <main class="flex-1 p-4 md:p-6 md:ml-56 mt-14 md:mt-16 pb-20 md:pb-6">
          <router-view />
        </main>
      </div>
      <GlobalAgentPanel />
    </template>
    <template v-else>
      <router-view />
    </template>
  </div>
</template>
