<script setup>
import { onMounted } from 'vue';
import { useAuthStore } from './stores/auth';
import { useTripStore } from './stores/trip';
import AppHeader from './components/layout/AppHeader.vue';
import AppSidebar from './components/layout/AppSidebar.vue';

const authStore = useAuthStore();
const tripStore = useTripStore();

onMounted(async () => {
  await authStore.fetchCurrentUser();
  if (authStore.isAuthenticated) {
    await tripStore.fetchTrips();
  }
});
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <template v-if="authStore.isAuthenticated">
      <AppHeader />
      <div class="flex">
        <AppSidebar />
        <main class="flex-1 p-6 ml-56">
          <router-view />
        </main>
      </div>
    </template>
    <template v-else>
      <router-view />
    </template>
  </div>
</template>
