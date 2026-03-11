<script setup>
import { ref, onMounted } from 'vue';
import { useTripStore } from '../stores/trip';
import { COLOR_MAP, COLOR_OPTIONS } from '../composables/useTripColor';
import apiClient from '../api/client';

const tripStore = useTripStore();
const trips = ref([]);
const loading = ref(false);
const showForm = ref(false);
const editingId = ref(null);
const generatingId = ref(null);

const emptyForm = { trip_name: '', start_date: '', end_date: '', color: 'green', image_url: '' };
const form = ref({ ...emptyForm });

async function fetchTrips() {
  loading.value = true;
  try {
    const { data } = await apiClient.get('/trips/all');
    trips.value = data.data;
  } finally {
    loading.value = false;
  }
}

function startEdit(trip) {
  editingId.value = trip.trip_id;
  form.value = {
    trip_name: trip.trip_name,
    start_date: trip.start_date,
    end_date: trip.end_date,
    color: trip.color || 'green',
    image_url: trip.image_url || '',
  };
  showForm.value = true;
}

function cancelForm() {
  showForm.value = false;
  editingId.value = null;
  form.value = { ...emptyForm };
}

async function saveTrip() {
  if (editingId.value) {
    await tripStore.updateTrip(editingId.value, form.value);
  } else {
    await tripStore.createTrip(form.value);
  }
  cancelForm();
  await Promise.all([fetchTrips(), tripStore.fetchTrips()]);
}

async function deleteTrip(tripId) {
  if (!confirm('Are you sure you want to delete this trip? This cannot be undone.')) return;
  await tripStore.deleteTrip(tripId);
  await Promise.all([fetchTrips(), tripStore.fetchTrips()]);
}

async function generateDescription(tripId) {
  generatingId.value = tripId;
  try {
    await tripStore.generateDescription(tripId);
    await fetchTrips();
  } catch (err) {
    alert('Failed to generate description: ' + (err.response?.data?.error?.message || err.message));
  } finally {
    generatingId.value = null;
  }
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

onMounted(fetchTrips);
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-display font-black uppercase tracking-wide text-flag-black dark:text-warm-100">Trips</h2>
      <button @click="showForm ? cancelForm() : (showForm = true)" class="bg-trip-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-trip-accent-hover transition-colors">
        {{ showForm ? 'Cancel' : '+ Create Trip' }}
      </button>
    </div>

    <!-- Create/Edit Form -->
    <div v-if="showForm" class="bg-surface dark:bg-dark-surface rounded-xl shadow-sm border border-warm-200 dark:border-dark-border p-6 mb-6">
      <h3 class="text-sm font-display font-bold uppercase tracking-wider text-warm-500 dark:text-warm-400 mb-4">
        {{ editingId ? 'Edit Trip' : 'New Trip' }}
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-warm-700 dark:text-warm-300 mb-1">Trip Name</label>
          <input v-model="form.trip_name" class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100" placeholder="Weekend Getaway" />
        </div>
        <div>
          <label class="block text-sm font-medium text-warm-700 dark:text-warm-300 mb-1">Start Date</label>
          <input v-model="form.start_date" type="date" class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100" />
        </div>
        <div>
          <label class="block text-sm font-medium text-warm-700 dark:text-warm-300 mb-1">End Date</label>
          <input v-model="form.end_date" type="date" class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100" />
        </div>
        <div>
          <label class="block text-sm font-medium text-warm-700 dark:text-warm-300 mb-1">Theme Color</label>
          <div class="flex items-center gap-3 mt-1">
            <button
              v-for="c in COLOR_OPTIONS"
              :key="c"
              @click="form.color = c"
              class="w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center"
              :class="form.color === c ? 'border-flag-black dark:border-white scale-110' : 'border-warm-300 dark:border-dark-border hover:scale-105'"
              :style="{ backgroundColor: COLOR_MAP[c].accent }"
              :title="COLOR_MAP[c].label"
            >
              <svg v-if="form.color === c" class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-warm-700 dark:text-warm-300 mb-1">Image URL</label>
          <input v-model="form.image_url" type="url" class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100" placeholder="https://example.com/trip-photo.jpg" />
        </div>
      </div>
      <!-- Image preview -->
      <div v-if="form.image_url" class="mt-3">
        <img :src="form.image_url" class="w-full max-w-sm h-32 object-cover rounded-lg border border-warm-200 dark:border-dark-border" @error="$event.target.style.display='none'" />
      </div>
      <div class="flex gap-2 mt-4">
        <button @click="saveTrip" :disabled="!form.trip_name || !form.start_date || !form.end_date" class="bg-trip-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-trip-accent-hover transition-colors disabled:opacity-50">
          {{ editingId ? 'Update Trip' : 'Create Trip' }}
        </button>
        <button @click="cancelForm" class="text-sm text-warm-500 dark:text-warm-400 hover:text-warm-700 dark:hover:text-warm-200 px-4 py-2">Cancel</button>
      </div>
    </div>

    <!-- Trips Table -->
    <div class="bg-surface dark:bg-dark-surface rounded-xl shadow-sm border border-warm-200 dark:border-dark-border overflow-x-auto">
      <table class="w-full min-w-[600px]">
        <thead class="bg-warm-50 dark:bg-dark-raised">
          <tr>
            <th class="text-left px-6 py-3 text-xs font-medium text-warm-500 dark:text-warm-400 uppercase tracking-wider">Trip</th>
            <th class="text-left px-6 py-3 text-xs font-medium text-warm-500 dark:text-warm-400 uppercase tracking-wider">Dates</th>
            <th class="text-left px-6 py-3 text-xs font-medium text-warm-500 dark:text-warm-400 uppercase tracking-wider">Members</th>
            <th class="text-left px-6 py-3 text-xs font-medium text-warm-500 dark:text-warm-400 uppercase tracking-wider">Description</th>
            <th class="text-right px-6 py-3 text-xs font-medium text-warm-500 dark:text-warm-400 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-warm-200 dark:divide-dark-border">
          <tr v-for="trip in trips" :key="trip.trip_id" class="hover:bg-warm-50 dark:hover:bg-dark-raised">
            <td class="px-6 py-4">
              <div class="flex items-center gap-3">
                <span class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: COLOR_MAP[trip.color]?.accent || COLOR_MAP.green.accent }"></span>
                <div>
                  <span class="text-sm font-medium text-flag-black dark:text-warm-100">{{ trip.trip_name }}</span>
                  <span v-if="trip.image_url" class="ml-2 text-warm-400 text-xs" title="Has banner image">🖼️</span>
                </div>
              </div>
            </td>
            <td class="px-6 py-4 text-sm text-warm-500 dark:text-warm-400">
              {{ formatDate(trip.start_date) }} – {{ formatDate(trip.end_date) }}
            </td>
            <td class="px-6 py-4 text-sm text-warm-500 dark:text-warm-400">
              {{ trip.member_count || 0 }}
            </td>
            <td class="px-6 py-4">
              <button
                v-if="!trip.description"
                @click="generateDescription(trip.trip_id)"
                :disabled="generatingId === trip.trip_id"
                class="text-xs text-trip-accent hover:text-trip-accent-hover font-medium disabled:opacity-50 flex items-center gap-1"
              >
                <svg v-if="generatingId === trip.trip_id" class="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                {{ generatingId === trip.trip_id ? 'Generating...' : '✨ Generate' }}
              </button>
              <div v-else class="flex items-center gap-2">
                <span class="text-xs text-green-600 dark:text-green-400">✓ Generated</span>
                <button
                  @click="generateDescription(trip.trip_id)"
                  :disabled="generatingId === trip.trip_id"
                  class="text-xs text-warm-400 hover:text-warm-600 dark:hover:text-warm-300 disabled:opacity-50"
                >
                  <svg v-if="generatingId === trip.trip_id" class="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  <span v-else>↻ Redo</span>
                </button>
              </div>
            </td>
            <td class="px-6 py-4 text-right">
              <div class="flex items-center justify-end gap-3">
                <button @click="startEdit(trip)" class="text-sm text-trip-accent hover:text-trip-accent-hover">Edit</button>
                <button @click="deleteTrip(trip.trip_id)" class="text-sm text-red-400 hover:text-red-600">Delete</button>
              </div>
            </td>
          </tr>
          <tr v-if="!trips.length && !loading">
            <td colspan="5" class="px-6 py-8 text-center text-warm-400 dark:text-warm-500 text-sm">No trips yet. Create one to get started.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
