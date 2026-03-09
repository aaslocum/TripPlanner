<script setup>
import { useTripStore } from '../../stores/trip';

const tripStore = useTripStore();

function onSelect(event) {
  tripStore.selectTrip(Number(event.target.value));
}
</script>

<template>
  <div class="flex items-center gap-2">
    <label class="text-sm text-gray-500 dark:text-gray-400">Trip:</label>
    <select
      :value="tripStore.selectedTripId"
      @change="onSelect"
      class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
    >
      <option v-if="tripStore.trips.length === 0" disabled>No trips</option>
      <option v-for="trip in tripStore.trips" :key="trip.trip_id" :value="trip.trip_id">
        {{ trip.trip_name }}
      </option>
    </select>
  </div>
</template>
