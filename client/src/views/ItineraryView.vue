<script setup>
import { ref, watch, onMounted } from 'vue';
import { useTripStore } from '../stores/trip';
import apiClient from '../api/client';

const tripStore = useTripStore();
const itinerary = ref({});
const loading = ref(false);

async function fetchItinerary() {
  if (!tripStore.selectedTripId) return;
  loading.value = true;
  try {
    const { data } = await apiClient.get(`/trips/${tripStore.selectedTripId}/itinerary`);
    itinerary.value = data.data;
  } finally {
    loading.value = false;
  }
}

function formatTime(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatDay(dateStr) {
  if (dateStr === 'Unscheduled') return 'Unscheduled';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function eventColor(type) {
  switch (type) {
    case 'check_in': return 'bg-green-500';
    case 'check_out': return 'bg-red-500';
    case 'activity': return 'bg-indigo-500';
    default: return 'bg-gray-500';
  }
}

watch(() => tripStore.selectedTripId, fetchItinerary);
onMounted(fetchItinerary);
</script>

<template>
  <div>
    <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Itinerary</h2>

    <div v-if="Object.keys(itinerary).length" class="space-y-8">
      <div v-for="(events, date) in itinerary" :key="date">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {{ formatDay(date) }}
        </h3>

        <div class="relative ml-2 md:ml-4 border-l-2 border-gray-200 dark:border-gray-700 pl-4 md:pl-6 space-y-4">
          <div v-for="(event, idx) in events" :key="idx" class="relative">
            <!-- Timeline dot -->
            <div class="absolute -left-[31px] w-4 h-4 rounded-full border-2 border-white dark:border-gray-950" :class="eventColor(event.type)"></div>

            <div class="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div class="flex items-center gap-3">
                <span class="text-xs font-medium uppercase tracking-wider px-2 py-0.5 rounded-full text-white" :class="eventColor(event.type)">
                  {{ event.type === 'check_in' ? 'Check-in' : event.type === 'check_out' ? 'Check-out' : 'Activity' }}
                </span>
                <span v-if="event.datetime" class="text-sm text-gray-500 dark:text-gray-400">{{ formatTime(event.datetime) }}</span>
                <span v-if="event.end_datetime" class="text-sm text-gray-400">- {{ formatTime(event.end_datetime) }}</span>
              </div>
              <h4 class="mt-2 font-medium text-gray-900 dark:text-gray-100">{{ event.title }}</h4>
              <p v-if="event.details?.description" class="text-sm text-gray-600 dark:text-gray-400 mt-1">{{ event.details.description }}</p>
              <p v-if="event.details?.address" class="text-xs text-gray-400 mt-1">{{ event.details.address }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="!loading" class="text-center py-16 text-gray-500 dark:text-gray-400">
      <p class="text-lg">Nothing on the itinerary yet</p>
      <p class="text-sm mt-1">Add accommodations and activities to build your schedule</p>
    </div>
  </div>
</template>
