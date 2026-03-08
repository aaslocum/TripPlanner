<script setup>
import { ref } from 'vue';

const props = defineProps({
  accommodation: { type: Object, required: true },
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
  <div class="flex border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
    <!-- Image carousel -->
    <div class="relative w-80 shrink-0 bg-gray-100" style="min-height: 280px">
      <img
        v-if="accommodation.images?.length"
        :src="accommodation.images[imageIndex]?.image_url"
        class="w-full h-full object-cover"
      />
      <div v-else class="w-full h-full flex items-center justify-center text-gray-300">
        <svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />
        </svg>
      </div>
      <!-- Carousel arrows -->
      <template v-if="accommodation.images?.length > 1">
        <button
          @click="prevImage"
          class="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-white/70 hover:bg-white text-gray-700 shadow transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <button
          @click="nextImage"
          class="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-white/70 hover:bg-white text-gray-700 shadow transition-colors"
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
    <div class="flex-1 p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">{{ accommodation.description || 'Accommodation' }}</h3>

      <div class="space-y-3">
        <div class="flex gap-2">
          <span class="text-sm font-medium text-gray-500 w-28">Address:</span>
          <span class="text-sm text-gray-900">{{ accommodation.address || 'N/A' }}</span>
        </div>
        <div class="flex gap-2">
          <span class="text-sm font-medium text-gray-500 w-28">Check-in:</span>
          <span class="text-sm text-gray-900">{{ formatDate(accommodation.check_in_datetime) }}</span>
        </div>
        <div class="flex gap-2">
          <span class="text-sm font-medium text-gray-500 w-28">Check-out:</span>
          <span class="text-sm text-gray-900">{{ formatDate(accommodation.check_out_datetime) }}</span>
        </div>
        <div class="flex gap-2">
          <span class="text-sm font-medium text-gray-500 w-28">Total Cost:</span>
          <span class="text-sm font-semibold text-gray-900">{{ formatCost(accommodation.total_cost) }}</span>
        </div>
      </div>

      <!-- Airbnb link -->
      <div v-if="accommodation.airbnb_url" class="mt-5 pt-4 border-t border-gray-100">
        <a
          :href="accommodation.airbnb_url"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-2 text-sm font-medium text-rose-600 hover:text-rose-700 transition-colors"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm5.5 17.4c-.3.6-.8 1-1.4 1.2-.2 0-.3.1-.5.1-.4 0-.8-.1-1.2-.4-1-.6-1.9-1.7-2.8-3-.4-.6-.8-1.2-1.1-1.8-.7 1.8-1.5 3.2-2.4 4-.5.5-1.1.8-1.7.8h-.2c-.7-.1-1.3-.5-1.6-1.2-.3-.6-.3-1.3-.1-2.1.5-1.7 1.6-3.5 3.2-5.3-.3-.8-.5-1.6-.6-2.4-.2-1.2-.1-2.2.3-3 .3-.6.8-1 1.4-1.1h.3c.5 0 1 .2 1.3.7.3.4.4 1 .4 1.6 0 .9-.2 2-.7 3.3.5.9 1.1 1.8 1.7 2.5.4.5.8.9 1.2 1.3.7-.2 1.3-.3 1.9-.3.9 0 1.6.2 2 .7.3.4.4.8.3 1.3-.1.4-.2.8-.4 1.1z"/>
          </svg>
          View on Airbnb
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
        </a>
      </div>
    </div>
  </div>
</template>
