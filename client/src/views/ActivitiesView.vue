<script setup>
import { ref, watch, onMounted } from 'vue';
import { Loader } from '@googlemaps/js-api-loader';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import apiClient from '../api/client';

const authStore = useAuthStore();
const tripStore = useTripStore();
const activities = ref([]);
const loading = ref(false);
const showForm = ref(false);
const editingId = ref(null);
const emptyForm = { title: '', description: '', image_url: '', google_place_id: '', start_datetime: '', end_datetime: '', estimated_cost: '', address: '', latitude: null, longitude: null, rating: null, source_url: '' };
const form = ref({ ...emptyForm });

// Google Places search
const searchQuery = ref('');
const predictions = ref([]);
const searching = ref(false);
const placeSelected = ref(false);
const showDropdown = ref(false);

let autocompleteService = null;
let placesService = null;
let sessionToken = null;
let debounceTimer = null;

const loader = new Loader({
  apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  version: 'weekly',
  libraries: ['places'],
});

async function initPlaces() {
  await loader.importLibrary('places');
  autocompleteService = new google.maps.places.AutocompleteService();
  const div = document.createElement('div');
  placesService = new google.maps.places.PlacesService(div);
  sessionToken = new google.maps.places.AutocompleteSessionToken();
}

function onSearchInput() {
  clearTimeout(debounceTimer);
  placeSelected.value = false;

  if (!searchQuery.value.trim()) {
    predictions.value = [];
    showDropdown.value = false;
    return;
  }

  debounceTimer = setTimeout(async () => {
    if (!autocompleteService) await initPlaces();
    searching.value = true;
    autocompleteService.getPlacePredictions(
      { input: searchQuery.value, sessionToken },
      (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          predictions.value = results;
          showDropdown.value = true;
        } else {
          predictions.value = [];
          showDropdown.value = false;
        }
        searching.value = false;
      }
    );
  }, 300);
}

function selectPrediction(prediction) {
  predictions.value = [];
  showDropdown.value = false;
  searchQuery.value = prediction.description;
  searching.value = true;

  placesService.getDetails(
    {
      placeId: prediction.place_id,
      fields: ['name', 'formatted_address', 'geometry', 'rating', 'photos', 'editorial_summary', 'url', 'place_id'],
      sessionToken,
    },
    (place, status) => {
      searching.value = false;
      if (status === google.maps.places.PlacesServiceStatus.OK && place) {
        form.value.title = place.name || '';
        form.value.address = place.formatted_address || '';
        form.value.google_place_id = place.place_id || '';
        form.value.source_url = place.url || '';

        if (place.editorial_summary?.text) {
          form.value.description = place.editorial_summary.text;
        }

        if (place.geometry?.location) {
          form.value.latitude = place.geometry.location.lat();
          form.value.longitude = place.geometry.location.lng();
        }

        if (place.rating) {
          form.value.rating = place.rating;
        }

        if (place.photos?.length > 0) {
          form.value.image_url = place.photos[0].getUrl({ maxWidth: 800 });
        }

        placeSelected.value = true;
        sessionToken = new google.maps.places.AutocompleteSessionToken();
      }
    }
  );
}

function resetForm() {
  form.value = { ...emptyForm };
  editingId.value = null;
  searchQuery.value = '';
  predictions.value = [];
  placeSelected.value = false;
  showDropdown.value = false;
}

function openAddForm() {
  resetForm();
  showForm.value = true;
}

function openEditForm(activity) {
  editingId.value = activity.activity_id;
  form.value = {
    title: activity.title || '',
    description: activity.description || '',
    image_url: activity.image_url || '',
    google_place_id: activity.google_place_id || '',
    start_datetime: activity.start_datetime || '',
    end_datetime: activity.end_datetime || '',
    estimated_cost: activity.estimated_cost || '',
    address: activity.address || '',
    latitude: activity.latitude || null,
    longitude: activity.longitude || null,
    rating: activity.rating || null,
    source_url: activity.source_url || '',
  };
  searchQuery.value = '';
  placeSelected.value = false;
  showDropdown.value = false;
  showForm.value = true;
}

function cancelForm() {
  showForm.value = false;
  resetForm();
}

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

  if (editingId.value) {
    await apiClient.put(`/activities/${editingId.value}`, payload);
  } else {
    await apiClient.post('/activities', payload);
  }

  showForm.value = false;
  resetForm();
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
      <template v-if="authStore.isAdmin">
        <button v-if="!showForm" @click="openAddForm" class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          + Add Activity
        </button>
        <button v-else @click="cancelForm" class="bg-gray-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors">
          Cancel
        </button>
      </template>
    </div>

    <!-- Add/Edit form -->
    <div v-if="showForm" class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">{{ editingId ? 'Edit Activity' : 'New Activity' }}</h3>

      <!-- Google Places search -->
      <div class="mb-5 pb-5 border-b border-gray-200">
        <label class="block text-sm font-medium text-gray-700 mb-1">Search Google Places</label>
        <div class="relative">
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              v-model="searchQuery"
              @input="onSearchInput"
              @focus="showDropdown = predictions.length > 0"
              class="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 text-sm"
              placeholder="Search for a place, restaurant, attraction..."
            />
            <svg v-if="searching" class="absolute right-3 top-1/2 -translate-y-1/2 animate-spin w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
          </div>
          <!-- Predictions dropdown -->
          <div v-if="showDropdown && predictions.length > 0" class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
            <button
              v-for="p in predictions"
              :key="p.place_id"
              @click="selectPrediction(p)"
              class="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors border-b border-gray-100 last:border-b-0"
            >
              <p class="text-sm font-medium text-gray-900">{{ p.structured_formatting.main_text }}</p>
              <p class="text-xs text-gray-500">{{ p.structured_formatting.secondary_text }}</p>
            </button>
          </div>
        </div>
        <p class="text-xs text-gray-400 mt-1">Search for a Google Place to auto-populate fields below</p>
      </div>

      <!-- Place selected preview -->
      <div v-if="placeSelected" class="mb-5 pb-5 border-b border-gray-200 bg-green-50 -mx-6 px-6 py-4">
        <p class="text-sm font-medium text-green-800 mb-2">Auto-filled from Google Places</p>
        <div class="text-sm text-green-700 space-y-1">
          <p v-if="form.title"><span class="font-medium">Title:</span> {{ form.title }}</p>
          <p v-if="form.address"><span class="font-medium">Address:</span> {{ form.address }}</p>
          <p v-if="form.rating"><span class="font-medium">Rating:</span> {{ form.rating }} / 5</p>
          <p v-if="form.image_url"><span class="font-medium">Image:</span> Found</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="col-span-2">
          <label class="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input v-model="form.title" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Hiking at..." />
        </div>
        <div class="col-span-2">
          <label class="block text-sm font-medium text-gray-700 mb-1">Description <span class="text-gray-400 font-normal">(optional)</span></label>
          <textarea v-model="form.description" rows="3" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Details about the activity..."></textarea>
        </div>
        <div class="col-span-2">
          <label class="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <input v-model="form.address" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="123 Main St..." />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
          <input v-model="form.image_url" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Google Place ID</label>
          <input v-model="form.google_place_id" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" readonly />
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
      <button @click="saveActivity" class="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
        {{ editingId ? 'Update' : 'Save' }}
      </button>
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
              <p v-if="activity.address" class="text-sm text-gray-500 mt-0.5">{{ activity.address }}</p>
              <p v-if="activity.start_datetime" class="text-sm text-indigo-600 mt-1">
                {{ formatDate(activity.start_datetime) }}
                <span v-if="activity.end_datetime"> - {{ formatDate(activity.end_datetime) }}</span>
              </p>
            </div>
            <div v-if="authStore.isAdmin" class="flex gap-1">
              <button @click="openEditForm(activity)" class="text-gray-400 hover:text-indigo-600 transition-colors p-1">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button @click="deleteActivity(activity.activity_id)" class="text-gray-400 hover:text-red-500 transition-colors p-1">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
          <p v-if="activity.description" class="text-sm text-gray-600 mt-3">{{ activity.description }}</p>
          <div class="flex items-center gap-3 mt-3">
            <span v-if="activity.estimated_cost" class="text-sm bg-green-50 text-green-700 px-2 py-1 rounded-full">${{ activity.estimated_cost }}</span>
            <span v-if="activity.rating" class="text-sm bg-yellow-50 text-yellow-700 px-2 py-1 rounded-full">{{ activity.rating }} stars</span>
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
