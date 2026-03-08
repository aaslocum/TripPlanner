<script setup>
import { ref, watch, onMounted } from 'vue';
import { useTripStore } from '../stores/trip';
import apiClient from '../api/client';

const tripStore = useTripStore();
const activities = ref([]);
const loading = ref(false);
const showForm = ref(false);
const form = ref({ title: '', description: '', image_url: '', google_place_id: '', start_datetime: '', end_datetime: '', estimated_cost: '' });

async function fetchActivities() {
  if (!tripStore.selectedTripId) return;
  loading.value = true;
  try {
    const { data } = await apiClient.get(`/activities/trip/${tripStore.selectedTripId}`);
    activities.value = data.data;
  } finally {
    loading.value = false;
  }
}

async function saveActivity() {
  const payload = {
    ...form.value,
    trip_id: tripStore.selectedTripId,
    estimated_cost: form.value.estimated_cost ? Number(form.value.estimated_cost) : null,
  };
  await apiClient.post('/activities', payload);
  showForm.value = false;
  form.value = { title: '', description: '', image_url: '', google_place_id: '', start_datetime: '', end_datetime: '', estimated_cost: '' };
  await fetchActivities();
}

async function deleteActivity(id) {
  await apiClient.delete(`/activities/${id}`);
  await fetchActivities();
}

function formatDate(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

watch(() => tripStore.selectedTripId, fetchActivities);
onMounted(fetchActivities);
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-gray-900">Activities</h2>
      <button @click="showForm = !showForm" class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
        {{ showForm ? 'Cancel' : '+ Add Activity' }}
      </button>
    </div>

    <!-- Add form -->
    <div v-if="showForm" class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      <div class="grid grid-cols-2 gap-4">
        <div class="col-span-2">
          <label class="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input v-model="form.title" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Hiking at..." />
        </div>
        <div class="col-span-2">
          <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea v-model="form.description" rows="3" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Details about the activity..."></textarea>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
          <input v-model="form.image_url" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Google Place ID</label>
          <input v-model="form.google_place_id" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Start</label>
          <input v-model="form.start_datetime" type="datetime-local" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">End</label>
          <input v-model="form.end_datetime" type="datetime-local" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Estimated Cost</label>
          <input v-model="form.estimated_cost" type="number" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <button @click="saveActivity" class="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">Save</button>
    </div>

    <!-- Activity panels -->
    <div class="space-y-4">
      <div v-for="activity in activities" :key="activity.activity_id" class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex">
        <div v-if="activity.image_url" class="w-64 flex-shrink-0">
          <img :src="activity.image_url" class="w-full h-full object-cover" />
        </div>
        <div v-else class="w-64 flex-shrink-0 bg-gradient-to-br from-indigo-100 to-blue-50 flex items-center justify-center">
          <svg class="w-12 h-12 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div class="flex-1 p-6">
          <div class="flex items-start justify-between">
            <div>
              <h3 class="text-lg font-semibold text-gray-900">{{ activity.title }}</h3>
              <p v-if="activity.start_datetime" class="text-sm text-indigo-600 mt-1">
                {{ formatDate(activity.start_datetime) }}
                <span v-if="activity.end_datetime"> - {{ formatDate(activity.end_datetime) }}</span>
              </p>
            </div>
            <button @click="deleteActivity(activity.activity_id)" class="text-gray-400 hover:text-red-500 transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
          <p v-if="activity.description" class="text-sm text-gray-600 mt-3">{{ activity.description }}</p>
          <div v-if="activity.estimated_cost" class="mt-3">
            <span class="text-sm bg-green-50 text-green-700 px-2 py-1 rounded-full">${{ activity.estimated_cost }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!loading && activities.length === 0" class="text-center py-16 text-gray-500">
      <p class="text-lg">No activities planned yet</p>
      <p class="text-sm mt-1">Add activities to build your trip itinerary</p>
    </div>
  </div>
</template>
