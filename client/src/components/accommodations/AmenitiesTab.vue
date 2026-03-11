<script setup>
defineProps({
  accommodation: { type: Object, required: true },
});

// Placeholder amenities - in a full implementation these would come from the DB
const defaultAmenities = [
  { icon: 'wifi', label: 'WiFi' },
  { icon: 'parking', label: 'Free Parking' },
  { icon: 'kitchen', label: 'Kitchen' },
  { icon: 'washer', label: 'Washer/Dryer' },
  { icon: 'ac', label: 'Air Conditioning' },
  { icon: 'pool', label: 'Pool' },
  { icon: 'hot-tub', label: 'Hot Tub' },
  { icon: 'grill', label: 'BBQ Grill' },
];
</script>

<template>
  <div>
    <h3 class="text-lg font-semibold text-flag-black dark:text-warm-100 mb-4">Amenities</h3>
    <p class="text-sm text-warm-500 dark:text-warm-400 mb-4">Amenities can be customized per accommodation in a future update.</p>
    <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
      <div v-for="amenity in defaultAmenities" :key="amenity.icon" class="flex items-center gap-3 bg-warm-50 dark:bg-dark-raised rounded-lg px-4 py-3">
        <svg class="w-5 h-5 text-warm-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <span class="text-sm text-warm-700 dark:text-warm-300">{{ amenity.label }}</span>
      </div>
    </div>
  </div>
</template>
