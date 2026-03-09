<script setup>
import { watch } from 'vue';
import { useAuthStore } from './stores/auth';
import { useTripStore } from './stores/trip';
import AppHeader from './components/layout/AppHeader.vue';
import AppSidebar from './components/layout/AppSidebar.vue';

const authStore = useAuthStore();
const tripStore = useTripStore();

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
      <AppHeader />
      <div class="flex">
        <AppSidebar />
        <main class="flex-1 p-6 ml-56 mt-16">
          <router-view />
        </main>
      </div>
    </template>
    <template v-else>
      <router-view />
    </template>
  </div>
</template>
