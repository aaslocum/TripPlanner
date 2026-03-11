<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { mapsLoader as loader } from '../utils/mapsLoader';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { useAgentStore } from '../stores/agent';
import apiClient from '../api/client';

const router = useRouter();
const authStore = useAuthStore();
const tripStore = useTripStore();
const agentStore = useAgentStore();
const eats = ref([]);
const loading = ref(false);
const showForm = ref(false);
const editingId = ref(null);
const emptyForm = { title: '', description: '', image_url: '', google_place_id: '', start_datetime: '', duration: '', estimated_cost: '', address: '', latitude: null, longitude: null, rating: null, source_url: '' };
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
      {
        input: searchQuery.value,
        types: ['restaurant', 'cafe', 'bar', 'meal_takeaway', 'bakery'],
        sessionToken,
      },
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
      fields: ['name', 'formatted_address', 'geometry', 'rating', 'photos', 'editorial_summary', 'url', 'place_id', 'price_level'],
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
    form.value.start_datetime = `${tripStore.selectedTrip.start_date}T12:00`;
  }
  showForm.value = true;
}

function durationFromDatetimes(start, end) {
  if (!start || !end) return '';
  const hours = (new Date(end) - new Date(start)) / 3600000;
  return hours > 0 ? hours : '';
}

function openEditForm(eat) {
  editingId.value = eat.eat_id;
  form.value = {
    title: eat.title || '',
    description: eat.description || '',
    image_url: eat.image_url || '',
    google_place_id: eat.google_place_id || '',
    start_datetime: eat.start_datetime || '',
    duration: durationFromDatetimes(eat.start_datetime, eat.end_datetime),
    estimated_cost: eat.estimated_cost || '',
    address: eat.address || '',
    latitude: eat.latitude || null,
    longitude: eat.longitude || null,
    rating: eat.rating || null,
    source_url: eat.source_url || '',
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

async function fetchEats() {
  if (!tripStore.selectedTripId) return;
  loading.value = true;
  try {
    const { data } = await apiClient.get(`/eats/trip/${tripStore.selectedTripId}`);
    eats.value = data.data;
  } finally {
    loading.value = false;
  }
}

async function saveEat() {
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
    await apiClient.put(`/eats/${editingId.value}`, payload);
  } else {
    await apiClient.post('/eats', payload);
  }

  showForm.value = false;
  resetForm();
  await fetchEats();
}

async function deleteEat(id) {
  if (!confirm('Are you sure you want to remove this dining option?')) return;
  await apiClient.delete(`/eats/${id}`);
  await fetchEats();
}

function formatDate(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatDayHeader(dateStr) {
  return new Date(dateStr + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function priceLabel(cost) {
  if (!cost) return '';
  if (cost <= 15) return '$';
  if (cost <= 30) return '$$';
  if (cost <= 60) return '$$$';
  return '$$$$';
}

function viewOnMap(eat) {
  router.push({
    path: '/map',
    query: {
      lat: eat.latitude,
      lng: eat.longitude,
      title: eat.title,
      address: eat.address || '',
    },
  });
}

// Group eats by date for organized display
const groupedEats = computed(() => {
  const groups = {};
  for (const eat of eats.value) {
    const date = eat.start_datetime ? eat.start_datetime.split('T')[0] : 'unscheduled';
    if (!groups[date]) groups[date] = [];
    groups[date].push(eat);
  }
  return Object.entries(groups)
    .sort(([a], [b]) => {
      if (a === 'unscheduled') return 1;
      if (b === 'unscheduled') return -1;
      return a.localeCompare(b);
    });
});

watch(() => tripStore.selectedTripId, fetchEats);
onMounted(fetchEats);

// Helper to apply agent formData to the eat form
function applyAgentFormData(fd) {
  if (fd.title) form.value.title = fd.title;
  if (fd.description) form.value.description = fd.description;
  if (fd.address) form.value.address = fd.address;
  if (fd.estimated_cost) form.value.estimated_cost = fd.estimated_cost;
  if (fd.duration) form.value.duration = fd.duration;
  if (fd.start_datetime) form.value.start_datetime = fd.start_datetime;
  if (fd.image_url) form.value.image_url = fd.image_url;
  if (fd.google_place_id) form.value.google_place_id = fd.google_place_id;
  if (fd.latitude) form.value.latitude = fd.latitude;
  if (fd.longitude) form.value.longitude = fd.longitude;
  if (fd.rating) form.value.rating = fd.rating;
  if (fd.source_url) form.value.source_url = fd.source_url;
}

// Agent action handler — add-eat and edit-eat
watch(() => agentStore.pendingAction, async (action) => {
  if (!action) return;

  if (action.type === 'add-eat') {
    agentStore.clearAction();
    resetForm();
    if (tripStore.selectedTrip?.start_date) {
      form.value.start_datetime = `${tripStore.selectedTrip.start_date}T12:00`;
    }
    applyAgentFormData(action.formData || {});
    showForm.value = true;
    agentStore.setResult({ success: true, message: 'Form pre-filled with restaurant suggestion — review and save when ready!' });
  }

  if (action.type === 'edit-eat') {
    agentStore.clearAction();
    const existing = eats.value.find(e => e.eat_id === action.eatId);
    if (!existing) {
      agentStore.setResult({ success: false, message: `Dining entry #${action.eatId} not found.` });
      return;
    }
    openEditForm(existing);
    applyAgentFormData(action.formData || {});
    agentStore.setResult({ success: true, message: 'Edit form loaded with changes — review and save when ready.' });
  }
});
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6 gap-3">
      <div>
        <h2 class="text-2xl font-display font-black uppercase tracking-wide text-flag-black dark:text-warm-100">Eats</h2>
        <p class="text-sm text-warm-500 dark:text-warm-400 mt-0.5">Restaurants, cafes & dining plans</p>
      </div>
      <div v-if="!showForm">
        <button @click="openAddForm" class="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors">
          + Add Restaurant
        </button>
      </div>
      <div v-else class="flex items-center gap-2 flex-wrap justify-end">
        <button @click="saveEat" class="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors">
          {{ editingId ? 'Update' : 'Save' }}
        </button>
        <button @click="cancelForm" class="bg-warm-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-warm-600 transition-colors">
          Cancel
        </button>
      </div>
    </div>

    <!-- Add/Edit form -->
    <div v-if="showForm" class="bg-surface dark:bg-dark-surface rounded-xl shadow-sm border border-warm-200 dark:border-dark-border p-6 mb-6">
      <h3 class="text-lg font-semibold text-flag-black dark:text-warm-100 mb-4">{{ editingId ? 'Edit Restaurant' : 'New Restaurant' }}</h3>

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
              placeholder="Search for a restaurant, cafe, bar..."
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
              class="w-full text-left px-4 py-3 hover:bg-orange-50 dark:hover:bg-orange-950 transition-colors border-b border-warm-100 dark:border-dark-border last:border-b-0"
            >
              <p class="text-sm font-medium text-flag-black dark:text-warm-100">{{ p.structured_formatting.main_text }}</p>
              <p class="text-xs text-warm-500 dark:text-warm-400">{{ p.structured_formatting.secondary_text }}</p>
            </button>
          </div>
        </div>
        <p class="text-xs text-warm-400 mt-1">Search for a restaurant to auto-populate fields below</p>
      </div>

      <!-- Place selected preview -->
      <div v-if="placeSelected" class="mb-5 pb-5 border-b border-warm-200 dark:border-dark-border bg-orange-50 dark:bg-orange-950 -mx-6 px-6 py-4">
        <p class="text-sm font-medium text-orange-800 dark:text-orange-300 mb-2">Auto-filled from Google Places</p>
        <div class="text-sm text-orange-700 dark:text-orange-300 space-y-1">
          <p v-if="form.title"><span class="font-medium">Name:</span> {{ form.title }}</p>
          <p v-if="form.address"><span class="font-medium">Address:</span> {{ form.address }}</p>
          <p v-if="form.rating"><span class="font-medium">Rating:</span> {{ form.rating }} / 5</p>
          <p v-if="form.image_url"><span class="font-medium">Photo:</span> Found</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-warm-700 dark:text-warm-300 mb-1">Name</label>
          <input v-model="form.title" class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100" placeholder="Restaurant name..." />
        </div>
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-warm-700 dark:text-warm-300 mb-1">Description <span class="text-warm-400 font-normal">(optional)</span></label>
          <textarea v-model="form.description" rows="2" class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100" placeholder="Cuisine type, vibe, must-try dishes..."></textarea>
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
          <label class="block text-sm font-medium text-warm-700 dark:text-warm-300 mb-1">Reservation Time</label>
          <input v-model="form.start_datetime" type="datetime-local" class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100" />
        </div>
        <div>
          <label class="block text-sm font-medium text-warm-700 dark:text-warm-300 mb-1">Duration (hours)</label>
          <input v-model="form.duration" type="number" min="0.5" step="0.5" class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100" placeholder="e.g. 1.5" />
        </div>
        <div>
          <label class="block text-sm font-medium text-warm-700 dark:text-warm-300 mb-1">Estimated Cost (per person)</label>
          <input v-model="form.estimated_cost" type="number" class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100" />
        </div>
      </div>
    </div>

    <!-- Eat panels grouped by date -->
    <div v-for="[date, dayEats] in groupedEats" :key="date">
      <h3 class="text-sm font-semibold text-warm-500 dark:text-warm-400 uppercase tracking-wide border-b border-warm-200 dark:border-dark-border pb-2 mt-6 first:mt-0 mb-4">
        {{ date === 'unscheduled' ? 'Unscheduled' : formatDayHeader(date) }}
      </h3>
      <div class="space-y-3">
        <div v-for="eat in dayEats" :key="eat.eat_id" class="bg-surface dark:bg-dark-surface rounded-lg shadow-sm border border-warm-200 dark:border-dark-border overflow-hidden flex flex-col md:flex-row">
          <div v-if="eat.image_url" class="w-full h-36 md:w-44 md:h-auto flex-shrink-0">
            <img :src="eat.image_url" class="w-full h-full object-cover" />
          </div>
          <div v-else class="w-full h-24 md:w-44 md:h-auto flex-shrink-0 bg-gradient-to-br from-orange-100 to-amber-50 dark:from-orange-950 dark:to-amber-950 flex items-center justify-center">
            <svg class="w-8 h-8 text-orange-300 dark:text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
          </div>
          <div class="flex-1 p-3 md:p-4">
            <div class="flex items-start justify-between">
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="text-base font-semibold text-flag-black dark:text-warm-100">{{ eat.title }}</h3>
                  <span v-if="eat.is_suggested" class="text-xs bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
                    Suggested
                  </span>
                </div>
                <p v-if="eat.address" class="text-xs text-warm-500 dark:text-warm-400 mt-0.5">{{ eat.address }}</p>
                <p v-if="eat.start_datetime" class="text-xs text-orange-600 dark:text-orange-400 mt-1">
                  {{ formatDate(eat.start_datetime) }}
                  <span v-if="eat.end_datetime"> - {{ formatDate(eat.end_datetime) }}</span>
                </p>
              </div>
              <div v-if="authStore.isAdmin" class="flex gap-1">
                <button @click="openEditForm(eat)" class="text-warm-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors p-1">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button @click="deleteEat(eat.eat_id)" class="text-warm-400 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
            <p v-if="eat.description" class="text-xs text-warm-600 dark:text-warm-400 mt-2 line-clamp-2">{{ eat.description }}</p>
            <div class="flex items-center gap-2 mt-2">
              <span v-if="eat.estimated_cost" class="text-xs bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                {{ priceLabel(eat.estimated_cost) }} · ${{ eat.estimated_cost }}/pp
              </span>
              <span v-if="eat.rating" class="text-xs bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded-full">{{ eat.rating }} stars</span>
              <button v-if="eat.latitude && eat.longitude" @click="viewOnMap(eat)" class="text-xs text-orange-600 dark:text-orange-400 hover:underline cursor-pointer">View on Map</button>
              <a v-else-if="eat.source_url" :href="eat.source_url" target="_blank" class="text-xs text-orange-600 dark:text-orange-400 hover:underline">View on Maps ↗</a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!loading && eats.length === 0" class="text-center py-16 text-warm-500 dark:text-warm-400">
      <svg class="w-16 h-16 mx-auto text-warm-300 dark:text-warm-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
      </svg>
      <p class="text-lg">No dining options yet</p>
      <p class="text-sm mt-1">Add restaurants and cafes to plan your meals</p>
    </div>
  </div>
</template>
