<script setup>
import AttendeesTab from '../components/accommodations/AttendeesTab.vue';
</script>

<template>
  <div class="min-w-0 overflow-hidden">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-display font-black uppercase tracking-wide text-flag-black dark:text-warm-100">Guests</h2>
    </div>
    <div class="bg-surface dark:bg-dark-surface rounded-xl shadow-sm border border-warm-200 dark:border-dark-border p-3 md:p-6 overflow-hidden">
      <AttendeesTab />
    </div>
  </div>
</template>
