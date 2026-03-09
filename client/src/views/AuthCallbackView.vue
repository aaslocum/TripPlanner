<script setup>
import { onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

onMounted(async () => {
  const token = route.query.token;
  if (token) {
    authStore.setToken(token);
    await authStore.fetchCurrentUser();
    router.push('/');
  } else {
    router.push('/login');
  }
});
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <p class="text-gray-500 dark:text-gray-400">Signing you in...</p>
  </div>
</template>
