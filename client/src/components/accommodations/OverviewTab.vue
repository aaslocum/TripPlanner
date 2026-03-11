<script setup>
import { ref } from 'vue';

const props = defineProps({
  accommodation: { type: Object, required: true },
  memberCount: { type: Number, default: 1 },
});

const imageIndex = ref(0);

function prevImage() {
  const total = props.accommodation.images?.length || 0;
  if (total <= 1) return;
  imageIndex.value = (imageIndex.value - 1 + total) % total;
}

function nextImage() {
  const total = props.accommodation.images?.length || 0;
  if (total <= 1) return;
  imageIndex.value = (imageIndex.value + 1) % total;
}

function formatDate(dt) {
  if (!dt) return 'N/A';
  return new Date(dt).toLocaleString();
}

function formatCost(cost) {
  if (!cost) return 'N/A';
  return `$${Number(cost).toLocaleString()}`;
}
</script>

<template>
  <div class="flex flex-col md:flex-row border border-warm-200 dark:border-dark-border rounded-xl overflow-hidden shadow-sm bg-surface dark:bg-dark-surface">
    <!-- Image carousel -->
    <div class="relative w-full h-48 md:w-80 md:h-auto shrink-0 bg-warm-100 dark:bg-dark-raised" style="min-height: 200px">
      <img
        v-if="accommodation.images?.length"
        :src="accommodation.images[imageIndex]?.image_url"
        class="w-full h-full object-cover"
      />
      <div v-else class="w-full h-full flex items-center justify-center text-warm-300">
        <svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />
        </svg>
      </div>
      <!-- Carousel arrows -->
      <template v-if="accommodation.images?.length > 1">
        <button
          @click="prevImage"
          class="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-white/70 dark:bg-dark-raised/70 hover:bg-white dark:hover:bg-dark-raised text-warm-700 dark:text-warm-200 shadow transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <button
          @click="nextImage"
          class="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-white/70 dark:bg-dark-raised/70 hover:bg-white dark:hover:bg-dark-raised text-warm-700 dark:text-warm-200 shadow transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
        </button>
        <!-- Image counter -->
        <div class="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
          {{ imageIndex + 1 }} / {{ accommodation.images.length }}
        </div>
      </template>
    </div>

    <!-- Stay info -->
    <div class="flex-1 p-4 md:p-6">
      <h3 class="text-lg font-semibold text-flag-black dark:text-warm-100 mb-4">{{ accommodation.description || 'Accommodation' }}</h3>

      <div class="space-y-3">
        <div class="flex gap-2">
          <span class="text-sm font-medium text-warm-500 dark:text-warm-400 w-20 md:w-28 shrink-0">Address:</span>
          <span class="text-sm text-flag-black dark:text-warm-100">{{ accommodation.address || 'N/A' }}</span>
        </div>
        <div class="flex gap-2">
          <span class="text-sm font-medium text-warm-500 dark:text-warm-400 w-28">Check-in:</span>
          <span class="text-sm text-flag-black dark:text-warm-100">{{ formatDate(accommodation.check_in_datetime) }}</span>
        </div>
        <div class="flex gap-2">
          <span class="text-sm font-medium text-warm-500 dark:text-warm-400 w-28">Check-out:</span>
          <span class="text-sm text-flag-black dark:text-warm-100">{{ formatDate(accommodation.check_out_datetime) }}</span>
        </div>
        <div class="flex gap-2">
          <span class="text-sm font-medium text-warm-500 dark:text-warm-400 w-28">Total Cost:</span>
          <span class="text-sm font-semibold text-flag-black dark:text-warm-100">{{ formatCost(accommodation.total_cost) }}</span>
        </div>
        <div v-if="accommodation.total_cost && memberCount > 1" class="flex gap-2">
          <span class="text-sm font-medium text-warm-500 dark:text-warm-400 w-28">Per Person:</span>
          <span class="text-sm font-semibold text-trip-accent dark:text-trip-accent">
            {{ formatCost(accommodation.total_cost / memberCount) }}
            <span class="text-xs font-normal text-warm-400">({{ memberCount }} people)</span>
          </span>
        </div>
      </div>

      <!-- Airbnb link -->
      <div v-if="accommodation.airbnb_url" class="mt-5 pt-4 border-t border-warm-100 dark:border-dark-raised">
        <a
          :href="accommodation.airbnb_url"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-2 text-sm font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-colors"
        >
          View on Airbnb
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
        </a>
      </div>
    </div>
  </div>
</template>
