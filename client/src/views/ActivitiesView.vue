<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { mapsLoader as loader } from '../utils/mapsLoader';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { useAgentStore } from '../stores/agent';
import apiClient from '../api/client';

const authStore = useAuthStore();
const tripStore = useTripStore();
const activities = ref([]);
const loading = ref(false);
const showForm = ref(false);
const editingId = ref(null);
const emptyForm = { title: '', description: '', image_url: '', google_place_id: '', start_datetime: '', duration: '', estimated_cost: '', address: '', latitude: null, longitude: null, rating: null, source_url: '' };
const form = ref({ ...emptyForm });

function onAgentFill(data) {
  if (data.title) form.value.title = data.title;
  if (data.description) form.value.description = data.description;
  if (data.address) form.value.address = data.address;
  if (data.estimated_cost != null) form.value.estimated_cost = data.estimated_cost;
  if (data.duration != null) form.value.duration = data.duration;
}

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
  if (tripStore.selectedTrip?.start_date) {
    form.value.start_datetime = `${tripStore.selectedTrip.start_date}T09:00`;
  }
  showForm.value = true;
}

function durationFromDatetimes(start, end) {
  if (!start || !end) return '';
  const hours = (new Date(end) - new Date(start)) / 3600000;
  return hours > 0 ? hours : '';
}

function openEditForm(activity) {
  editingId.value = activity.activity_id;
  form.value = {
    title: activity.title || '',
    description: activity.description || '',
    image_url: activity.image_url || '',
    google_place_id: activity.google_place_id || '',
    start_datetime: activity.start_datetime || '',
    duration: durationFromDatetimes(activity.start_datetime, activity.end_datetime),
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
  let end_datetime = null;
  if (form.value.start_datetime && form.value.duration) {
    const endDate = new Date(new Date(form.value.start_datetime).getTime() + Number(form.value.duration) * 3600000);
    // Format as local datetime to match start_datetime (avoid toISOString which converts to UTC)
    const y = endDate.getFullYear();
    const mo = String(endDate.getMonth() + 1).padStart(2, '0');
    const d = String(endDate.getDate()).padStart(2, '0');
    const h = String(endDate.getHours()).padStart(2, '0');
    const mi = String(endDate.getMinutes()).padStart(2, '0');
    end_datetime = `${y}-${mo}-${d}T${h}:${mi}`;
  }
  const { duration, ...rest } = form.value;
  const payload = {
    ...rest,
    trip_id: tripStore.selectedTripId,
    estimated_cost: form.value.estimated_cost ? Number(form.value.estimated_cost) : null,
    end_datetime,
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
  if (!confirm('Are you sure you want to delete this activity?')) return;
  await apiClient.delete(`/activities/${id}`);
  await fetchActivities();
}

function formatDate(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatDayHeader(dateStr) {
  return new Date(dateStr + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

// Group activities by date for organized display
const groupedActivities = computed(() => {
  const groups = {};
  for (const act of activities.value) {
    const date = act.start_datetime ? act.start_datetime.split('T')[0] : 'unscheduled';
    if (!groups[date]) groups[date] = [];
    groups[date].push(act);
  }
  return Object.entries(groups)
    .sort(([a], [b]) => {
      if (a === 'unscheduled') return 1;
      if (b === 'unscheduled') return -1;
      return a.localeCompare(b);
    });
});

watch(() => tripStore.selectedTripId, fetchActivities);
onMounted(fetchActivities);

// Global agent panel — handle add-activity and edit-activity actions
const agentStore = useAgentStore();
watch(() => agentStore.pendingAction, (action) => {
  if (!action) return;

  if (action.type === 'add-activity') {
    agentStore.clearAction();
    try {
      editingId.value = null;
      form.value = { ...emptyForm };
      onAgentFill(action.formData || {});
      showForm.value = true;
      agentStore.setResult({ success: true, message: 'Activity form pre-filled! Review and save when ready.' });
    } catch (err) {
      agentStore.setResult({ success: false, message: 'Failed to fill activity form.' });
    }
  }

  if (action.type === 'edit-activity') {
    agentStore.clearAction();
    try {
      const existing = activities.value.find(a => a.activity_id === action.activityId);
      if (!existing) {
        agentStore.setResult({ success: false, message: `Activity #${action.activityId} not found.` });
        return;
      }
      // Open edit form with existing data
      openEditForm(existing);
      // Overlay agent's changes
      const fd = action.formData || {};
      if (fd.title) form.value.title = fd.title;
      if (fd.description) form.value.description = fd.description;
      if (fd.address) form.value.address = fd.address;
      if (fd.estimated_cost != null) form.value.estimated_cost = fd.estimated_cost;
      if (fd.duration != null) form.value.duration = fd.duration;
      if (fd.start_datetime) form.value.start_datetime = fd.start_datetime;
      agentStore.setResult({ success: true, message: 'Edit form loaded with changes — review and save when ready.' });
    } catch (err) {
      agentStore.setResult({ success: false, message: 'Failed to load edit form.' });
    }
  }
});
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6 gap-3">
      <h2 class="text-2xl font-display font-black uppercase tracking-wide text-flag-black dark:text-warm-100">Activities</h2>
      <div v-if="!showForm">
        <button @click="openAddForm" class="bg-flag-purple text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-flag-purple-hover transition-colors">
          + Add Activity
        </button>
      </div>
      <div v-else class="flex items-center gap-2 flex-wrap justify-end">
        <button @click="saveActivity" class="bg-flag-purple text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-flag-purple-hover transition-colors">
          {{ editingId ? 'Update' : 'Save' }}
        </button>
        <button @click="cancelForm" class="bg-warm-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-warm-600 transition-colors">
          Cancel
        </button>
      </div>
    </div>

    <!-- Add/Edit form -->
    <div v-if="showForm" class="bg-surface dark:bg-dark-surface rounded-xl shadow-sm border border-warm-200 dark:border-dark-border p-6 mb-6">
      <h3 class="text-lg font-semibold text-flag-black dark:text-warm-100 mb-4">{{ editingId ? 'Edit Activity' : 'New Activity' }}</h3>

      <!-- Google Places search -->
      <div class="mb-5 pb-5 border-b border-warm-200 dark:border-dark-border">
        <label class="block text-sm font-medium text-warm-700 dark:text-warm-300 mb-1">Search Google Places</label>
        <div class="relative">
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              v-model="searchQuery"
              @input="onSearchInput"
              @focus="showDropdown = predictions.length > 0"
              class="w-full border border-warm-300 dark:border-dark-border rounded-lg pl-10 pr-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100"
              placeholder="Search for a place, restaurant, attraction..."
            />
            <svg v-if="searching" class="absolute right-3 top-1/2 -translate-y-1/2 animate-spin w-4 h-4 text-warm-400" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
          </div>
          <!-- Predictions dropdown -->
          <div v-if="showDropdown && predictions.length > 0" class="absolute z-10 w-full mt-1 bg-surface dark:bg-dark-raised border border-warm-200 dark:border-dark-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
            <button
              v-for="p in predictions"
              :key="p.place_id"
              @click="selectPrediction(p)"
              class="w-full text-left px-4 py-3 hover:bg-flag-purple-light dark:hover:bg-flag-purple/10 transition-colors border-b border-warm-100 dark:border-dark-border last:border-b-0"
            >
              <p class="text-sm font-medium text-flag-black dark:text-warm-100">{{ p.structured_formatting.main_text }}</p>
              <p class="text-xs text-warm-500 dark:text-warm-400">{{ p.structured_formatting.secondary_text }}</p>
            </button>
          </div>
        </div>
        <p class="text-xs text-warm-400 mt-1">Search for a Google Place to auto-populate fields below</p>
      </div>

      <!-- Place selected preview -->
      <div v-if="placeSelected" class="mb-5 pb-5 border-b border-warm-200 dark:border-dark-border bg-flag-purple-light dark:bg-purple-950 -mx-6 px-6 py-4">
        <p class="text-sm font-medium text-purple-800 dark:text-purple-300 mb-2">Auto-filled from Google Places</p>
        <div class="text-sm text-purple-700 dark:text-purple-300 space-y-1">
          <p v-if="form.title"><span class="font-medium">Title:</span> {{ form.title }}</p>
          <p v-if="form.address"><span class="font-medium">Address:</span> {{ form.address }}</p>
          <p v-if="form.rating"><span class="font-medium">Rating:</span> {{ form.rating }} / 5</p>
          <p v-if="form.image_url"><span class="font-medium">Image:</span> Found</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-warm-700 dark:text-warm-300 mb-1">Title</label>
          <input v-model="form.title" class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100" placeholder="Hiking at..." />
        </div>
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-warm-700 dark:text-warm-300 mb-1">Description <span class="text-warm-400 font-normal">(optional)</span></label>
          <textarea v-model="form.description" rows="3" class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100" placeholder="Details about the activity..."></textarea>
        </div>
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-warm-700 dark:text-warm-300 mb-1">Address</label>
          <input v-model="form.address" class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100" placeholder="123 Main St..." />
        </div>
        <div>
          <label class="block text-sm font-medium text-warm-700 dark:text-warm-300 mb-1">Image URL</label>
          <input v-model="form.image_url" class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100" />
        </div>
        <div>
          <label class="block text-sm font-medium text-warm-700 dark:text-warm-300 mb-1">Google Place ID</label>
          <input v-model="form.google_place_id" class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100" readonly />
        </div>
        <div>
          <label class="block text-sm font-medium text-warm-700 dark:text-warm-300 mb-1">Start</label>
          <input v-model="form.start_datetime" type="datetime-local" class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100" />
        </div>
        <div>
          <label class="block text-sm font-medium text-warm-700 dark:text-warm-300 mb-1">Duration (hours)</label>
          <input v-model="form.duration" type="number" min="0.5" step="0.5" class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100" placeholder="e.g. 2 or 1.5" />
        </div>
        <div>
          <label class="block text-sm font-medium text-warm-700 dark:text-warm-300 mb-1">Estimated Cost</label>
          <input v-model="form.estimated_cost" type="number" class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100" />
        </div>
      </div>
    </div>

    <!-- Activity panels grouped by date -->
    <div v-for="[date, dayActivities] in groupedActivities" :key="date">
      <h3 class="text-sm font-semibold text-warm-500 dark:text-warm-400 uppercase tracking-wide border-b border-warm-200 dark:border-dark-border pb-2 mt-6 first:mt-0 mb-4">
        {{ date === 'unscheduled' ? 'Unscheduled' : formatDayHeader(date) }}
      </h3>
      <div class="space-y-3">
      <div v-for="activity in dayActivities" :key="activity.activity_id" class="bg-surface dark:bg-dark-surface rounded-lg shadow-sm border border-warm-200 dark:border-dark-border overflow-hidden flex flex-col md:flex-row">
        <div v-if="activity.image_url" class="w-full h-36 md:w-44 md:h-auto flex-shrink-0">
          <img :src="activity.image_url" class="w-full h-full object-cover" />
        </div>
        <div v-else class="w-full h-24 md:w-44 md:h-auto flex-shrink-0 bg-gradient-to-br from-flag-purple-light to-purple-50 dark:from-flag-purple/20 dark:to-dark-raised flex items-center justify-center">
          <svg class="w-8 h-8 text-flag-purple/40 dark:text-flag-purple/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div class="flex-1 p-3 md:p-4">
          <div class="flex items-start justify-between">
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="text-base font-semibold text-flag-black dark:text-warm-100">{{ activity.title }}</h3>
                <span v-if="activity.is_suggested" class="text-xs bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
                  Suggested
                </span>
              </div>
              <p v-if="activity.address" class="text-xs text-warm-500 dark:text-warm-400 mt-0.5">{{ activity.address }}</p>
              <p v-if="activity.start_datetime" class="text-xs text-flag-purple dark:text-flag-purple mt-1">
                {{ formatDate(activity.start_datetime) }}
                <span v-if="activity.end_datetime"> - {{ formatDate(activity.end_datetime) }}</span>
              </p>
            </div>
            <div v-if="authStore.isAdmin" class="flex gap-1">
              <button @click="openEditForm(activity)" class="text-warm-400 hover:text-flag-purple dark:hover:text-flag-purple transition-colors p-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button @click="deleteActivity(activity.activity_id)" class="text-warm-400 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
          <p v-if="activity.description" class="text-xs text-warm-600 dark:text-warm-400 mt-2 line-clamp-2">{{ activity.description }}</p>
          <div class="flex items-center gap-2 mt-2">
            <span v-if="activity.estimated_cost" class="text-xs bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">${{ activity.estimated_cost }}</span>
            <span v-if="activity.rating" class="text-xs bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded-full">{{ activity.rating }} stars</span>
          </div>
        </div>
      </div>
      </div>
    </div>

    <div v-if="!loading && activities.length === 0" class="text-center py-16 text-warm-500 dark:text-warm-400">
      <p class="text-lg">No activities planned yet</p>
      <p class="text-sm mt-1">Add activities to build your trip itinerary</p>
    </div>
  </div>
</template>
