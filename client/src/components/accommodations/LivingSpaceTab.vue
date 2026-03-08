<script setup>
defineProps({
  accommodation: { type: Object, required: true },
});

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
  <div>
    <div class="grid grid-cols-3 gap-6">
      <div class="col-span-2">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">{{ accommodation.description || 'Accommodation' }}</h3>

        <div class="space-y-3">
          <div class="flex gap-2">
            <span class="text-sm font-medium text-gray-500 w-28">Address:</span>
            <span class="text-sm text-gray-900">{{ accommodation.address || 'N/A' }}</span>
          </div>
          <div class="flex gap-2">
            <span class="text-sm font-medium text-gray-500 w-28">Airbnb ID:</span>
            <span class="text-sm text-gray-900">{{ accommodation.airbnb_id || 'N/A' }}</span>
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
      </div>

      <!-- Images -->
      <div v-if="accommodation.images?.length">
        <div class="grid gap-2">
          <img
            v-for="img in accommodation.images.slice(0, 4)"
            :key="img.image_id"
            :src="img.image_url"
            class="w-full h-32 object-cover rounded-lg"
          />
        </div>
      </div>
    </div>
  </div>
</template>
