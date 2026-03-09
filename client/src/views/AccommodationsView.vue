<script setup>
import { ref, watch, onMounted } from 'vue';
import { Loader } from '@googlemaps/js-api-loader';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { useAgentStore } from '../stores/agent';
import apiClient from '../api/client';

const authStore = useAuthStore();
import OverviewTab from '../components/accommodations/OverviewTab.vue';
import BedroomsTab from '../components/accommodations/BedroomsTab.vue';
import AmenitiesTab from '../components/accommodations/AmenitiesTab.vue';
import LocationTab from '../components/accommodations/LocationTab.vue';
import AttendeesTab from '../components/accommodations/AttendeesTab.vue';

const tripStore = useTripStore();
const accommodations = ref([]);
const selectedAccommodation = ref(null);
const activeTab = ref('living');
const loading = ref(false);
const memberCount = ref(1);
const showForm = ref(false);
const editingId = ref(null); // null = create, number = editing
const form = ref({ description: '', address: '', airbnb_id: '', airbnb_url: '', check_in_datetime: '', check_out_datetime: '', total_cost: '' });

// Airbnb URL scraping
const airbnbUrl = ref('');
const scraping = ref(false);
const scrapeError = ref('');
const scrapedBedrooms = ref([]);
const scrapedImages = ref([]);
const scrapeSuccess = ref(false);

// Google Places search for address
const addressQuery = ref('');
const addressPredictions = ref([]);
const addressSearching = ref(false);
const showAddressDropdown = ref(false);

let autocompleteService = null;
let placesService = null;
let sessionToken = null;
let addressDebounceTimer = null;

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

function onAddressInput() {
  clearTimeout(addressDebounceTimer);

  if (!addressQuery.value.trim()) {
    addressPredictions.value = [];
    showAddressDropdown.value = false;
    return;
  }

  addressDebounceTimer = setTimeout(async () => {
    if (!autocompleteService) await initPlaces();
    addressSearching.value = true;
    autocompleteService.getPlacePredictions(
      { input: addressQuery.value, sessionToken },
      (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          addressPredictions.value = results;
          showAddressDropdown.value = true;
        } else {
          addressPredictions.value = [];
          showAddressDropdown.value = false;
        }
        addressSearching.value = false;
      }
    );
  }, 300);
}

function selectAddressPrediction(prediction) {
  addressPredictions.value = [];
  showAddressDropdown.value = false;
  addressSearching.value = true;

  placesService.getDetails(
    {
      placeId: prediction.place_id,
      fields: ['formatted_address'],
      sessionToken,
    },
    (place, status) => {
      addressSearching.value = false;
      if (status === google.maps.places.PlacesServiceStatus.OK && place) {
        form.value.address = place.formatted_address || prediction.description;
        addressQuery.value = '';
      }
      sessionToken = new google.maps.places.AutocompleteSessionToken();
    }
  );
}

function resetForm() {
  form.value = { description: '', address: '', airbnb_id: '', airbnb_url: '', check_in_datetime: '', check_out_datetime: '', total_cost: '' };
  airbnbUrl.value = '';
  scrapeError.value = '';
  scrapeSuccess.value = false;
  scrapedBedrooms.value = [];
  scrapedImages.value = [];
  editingId.value = null;
  addressQuery.value = '';
  addressPredictions.value = [];
  showAddressDropdown.value = false;
}

function openAddForm() {
  resetForm();
  showForm.value = true;
}

function openEditForm(acc) {
  editingId.value = acc.accommodation_id;
  form.value = {
    description: acc.description || '',
    address: acc.address || '',
    airbnb_id: acc.airbnb_id || '',
    airbnb_url: acc.airbnb_url || '',
    check_in_datetime: acc.check_in_datetime || '',
    check_out_datetime: acc.check_out_datetime || '',
    total_cost: acc.total_cost || '',
  };
  airbnbUrl.value = '';
  scrapeError.value = '';
  scrapeSuccess.value = false;
  scrapedBedrooms.value = [];
  scrapedImages.value = [];
  addressQuery.value = '';
  addressPredictions.value = [];
  showAddressDropdown.value = false;
  showForm.value = true;
}

function cancelForm() {
  showForm.value = false;
  resetForm();
}

async function scrapeUrl() {
  if (!airbnbUrl.value.trim()) return;
  scraping.value = true;
  scrapeError.value = '';
  scrapeSuccess.value = false;
  scrapedBedrooms.value = [];
  scrapedImages.value = [];
  try {
    const { data } = await apiClient.post('/scrape', { url: airbnbUrl.value.trim() });
    const d = data.data;
    if (d.description) form.value.description = d.description;
    if (d.address) form.value.address = d.address;
    if (d.airbnb_id) form.value.airbnb_id = d.airbnb_id;
    if (d.check_in) form.value.check_in_datetime = d.check_in + 'T15:00';
    if (d.check_out) form.value.check_out_datetime = d.check_out + 'T11:00';
    if (d.bedrooms?.length) scrapedBedrooms.value = d.bedrooms;
    if (d.images?.length) scrapedImages.value = d.images;
    form.value.airbnb_url = airbnbUrl.value.trim();
    scrapeSuccess.value = true;
  } catch (err) {
    scrapeError.value = err.response?.data?.error || 'Failed to fetch listing details';
  } finally {
    scraping.value = false;
  }
}

const tabs = [
  { id: 'living', label: 'Overview' },
  { id: 'bedrooms', label: 'Bedrooms' },
  { id: 'amenities', label: 'Amenities' },
  { id: 'location', label: 'Location' },
  { id: 'attendees', label: 'Attendees' },
];

async function fetchAccommodations() {
  if (!tripStore.selectedTripId) return;
  loading.value = true;
  try {
    const [accRes, membersRes] = await Promise.all([
      apiClient.get(`/accommodations/trip/${tripStore.selectedTripId}`),
      apiClient.get(`/trips/${tripStore.selectedTripId}/members`),
    ]);
    accommodations.value = accRes.data.data;
    memberCount.value = membersRes.data.data?.length || 1;
    if (accommodations.value.length > 0 && !selectedAccommodation.value) {
      await selectAccommodation(accommodations.value[0].accommodation_id);
    }
  } finally {
    loading.value = false;
  }
}

async function selectAccommodation(id) {
  const { data } = await apiClient.get(`/accommodations/${id}`);
  selectedAccommodation.value = data.data;
}

async function saveScrapedData(accId) {
  // Clear old accommodation-level images (no bedroom_id) before re-adding
  if (scrapedImages.value.length > 0) {
    const { data: existing } = await apiClient.get(`/images/accommodation/${accId}`);
    for (const img of existing.data.filter(i => !i.bedroom_id)) {
      await apiClient.delete(`/images/${img.image_id}`);
    }
    const images = scrapedImages.value.map((url, i) => ({
      accommodation_id: accId,
      image_url: url,
      sort_order: i,
    }));
    await apiClient.post('/images/bulk', { images });
  }

  // Upsert bedrooms (dedup by name), re-create beds and bedroom images
  if (scrapedBedrooms.value.length > 0) {
    for (const br of scrapedBedrooms.value) {
      const { data: brData } = await apiClient.post('/bedrooms/upsert', {
        accommodation_id: accId,
        name: br.name,
      });
      const bedroomId = brData.data.bedroom_id;
      for (const bed of br.beds) {
        await apiClient.post('/beds', {
          bedroom_id: bedroomId,
          bed_type: bed.bed_type,
        });
      }
      // Save bedroom image
      if (br.image_url) {
        await apiClient.post('/images', {
          accommodation_id: accId,
          bedroom_id: bedroomId,
          image_url: br.image_url,
        });
      }
    }
  }
}

async function saveAccommodation() {
  const payload = {
    ...form.value,
    trip_id: tripStore.selectedTripId,
    total_cost: form.value.total_cost ? Number(form.value.total_cost) : null,
  };

  let accId;
  if (editingId.value) {
    // Update existing
    await apiClient.put(`/accommodations/${editingId.value}`, payload);
    accId = editingId.value;
  } else {
    // Create new
    const { data } = await apiClient.post('/accommodations', payload);
    accId = data.data.accommodation_id;
  }

  // Save scraped bedrooms/images if any
  await saveScrapedData(accId);

  showForm.value = false;
  resetForm();
  await fetchAccommodations();
  await selectAccommodation(accId);
}

async function deleteAccommodation(id) {
  if (!confirm('Are you sure you want to delete this accommodation? All bedrooms, images, and claims will also be removed.')) return;
  await apiClient.delete(`/accommodations/${id}`);
  if (selectedAccommodation.value?.accommodation_id === id) {
    selectedAccommodation.value = null;
  }
  await fetchAccommodations();
}

watch(() => tripStore.selectedTripId, fetchAccommodations);
onMounted(fetchAccommodations);

// Global agent panel — handle claim-bed action
const agentStore = useAgentStore();
watch(() => agentStore.pendingAction, async (action) => {
  if (!action || action.type !== 'claim-bed') return;
  agentStore.clearAction();
  try {
    await apiClient.post(`/beds/${action.bedId}/claim`);
    if (selectedAccommodation.value) {
      await selectAccommodation(selectedAccommodation.value.accommodation_id);
    }
    agentStore.setResult({ success: true, message: "Bed claimed! You're all set." });
  } catch (err) {
    const msg = err.response?.data?.error?.message || 'Failed to claim bed';
    agentStore.setResult({ success: false, message: msg });
  }
});
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Accommodations</h2>
      <template v-if="authStore.isAdmin">
        <button v-if="!showForm" @click="openAddForm" class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          + Add Accommodation
        </button>
        <button v-else @click="cancelForm" class="bg-gray-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors">
          Cancel
        </button>
      </template>
    </div>

    <!-- Add/Edit form -->
    <div v-if="showForm" class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{{ editingId ? 'Edit Accommodation' : 'New Accommodation' }}</h3>

      <!-- Airbnb URL paste section -->
      <div class="mb-5 pb-5 border-b border-gray-200 dark:border-gray-700">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Paste Airbnb Link</label>
        <div class="flex gap-2">
          <input
            v-model="airbnbUrl"
            class="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:text-gray-100"
            placeholder="https://www.airbnb.com/rooms/..."
            @keyup.enter="scrapeUrl"
          />
          <button
            @click="scrapeUrl"
            :disabled="scraping || !airbnbUrl.trim()"
            class="bg-rose-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-rose-600 transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
          >
            <svg v-if="scraping" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            {{ scraping ? 'Fetching...' : 'Auto-fill' }}
          </button>
        </div>
        <p v-if="scrapeError" class="text-xs text-red-500 mt-1">{{ scrapeError }}</p>
        <p class="text-xs text-gray-400 mt-1">Paste an Airbnb URL to auto-populate fields below</p>
      </div>

      <!-- Scrape preview -->
      <div v-if="scrapeSuccess" class="mb-5 pb-5 border-b border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-950 -mx-6 px-6 py-4">
        <p class="text-sm font-medium text-green-800 dark:text-green-300 mb-2">Auto-filled from Airbnb</p>
        <div class="text-sm text-green-700 dark:text-green-300 space-y-1">
          <p v-if="form.description"><span class="font-medium">Description:</span> {{ form.description }}</p>
          <p v-if="form.address"><span class="font-medium">Address:</span> {{ form.address }}</p>
          <p v-if="form.check_in_datetime"><span class="font-medium">Check-in:</span> {{ form.check_in_datetime.replace('T', ' ') }}</p>
          <p v-if="form.check_out_datetime"><span class="font-medium">Check-out:</span> {{ form.check_out_datetime.replace('T', ' ') }}</p>
          <p v-if="scrapedImages.length"><span class="font-medium">Photos:</span> {{ scrapedImages.length }} images</p>
        </div>
        <div v-if="scrapedBedrooms.length" class="mt-3">
          <p class="text-sm font-medium text-green-800 dark:text-green-300 mb-1">Bedrooms ({{ scrapedBedrooms.length }})</p>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
            <div v-for="(br, i) in scrapedBedrooms" :key="i" class="bg-white dark:bg-gray-900 rounded-lg overflow-hidden border border-green-200 dark:border-green-800">
              <img v-if="br.image_url" :src="br.image_url" class="w-full h-20 object-cover" />
              <div class="px-3 py-2">
                <p class="text-xs font-medium text-gray-800 dark:text-gray-200">{{ br.name }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ br.bed_description }}</p>
              </div>
            </div>
          </div>
          <p class="text-xs text-green-600 dark:text-green-400 mt-2">Bedrooms, beds, and images will be created automatically on save.</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
          <input v-model="form.description" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:text-gray-100" placeholder="Cozy mountain cabin..." />
        </div>
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
          <div class="relative">
            <input v-model="form.address" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:text-gray-100" placeholder="123 Main St..." />
            <!-- Google Places address search -->
            <div class="mt-2 relative">
              <div class="relative">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  v-model="addressQuery"
                  @input="onAddressInput"
                  @focus="showAddressDropdown = addressPredictions.length > 0"
                  class="w-full border border-gray-200 dark:border-gray-600 rounded-lg pl-10 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 dark:text-gray-100"
                  placeholder="Search for an address..."
                />
                <svg v-if="addressSearching" class="absolute right-3 top-1/2 -translate-y-1/2 animate-spin w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              </div>
              <div v-if="showAddressDropdown && addressPredictions.length > 0" class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                <button
                  v-for="p in addressPredictions"
                  :key="p.place_id"
                  @click="selectAddressPrediction(p)"
                  class="w-full text-left px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                >
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ p.structured_formatting.main_text }}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ p.structured_formatting.secondary_text }}</p>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Airbnb ID</label>
          <input v-model="form.airbnb_id" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:text-gray-100" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total Cost</label>
          <input v-model="form.total_cost" type="number" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:text-gray-100" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Check-in</label>
          <input v-model="form.check_in_datetime" type="datetime-local" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:text-gray-100" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Check-out</label>
          <input v-model="form.check_out_datetime" type="datetime-local" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:text-gray-100" />
        </div>
      </div>
      <button @click="saveAccommodation" class="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
        {{ editingId ? 'Update' : 'Save' }}
      </button>
    </div>

    <!-- Accommodation selector -->
    <div v-if="accommodations.length > 1" class="flex gap-2 mb-4 flex-wrap">
      <button
        v-for="acc in accommodations"
        :key="acc.accommodation_id"
        @click="selectAccommodation(acc.accommodation_id)"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        :class="selectedAccommodation?.accommodation_id === acc.accommodation_id ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'"
      >
        {{ acc.description || `Accommodation ${acc.accommodation_id}` }}
      </button>
    </div>

    <!-- Tabs -->
    <div v-if="selectedAccommodation" class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div class="border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between px-2 md:px-4 pt-2 overflow-hidden">
          <nav class="flex gap-0 overflow-x-auto min-w-0 -mb-px scrollbar-hide">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              @click="activeTab = tab.id"
              class="px-2.5 md:px-6 py-3 text-xs md:text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0"
              :class="activeTab === tab.id ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'"
            >
              {{ tab.label }}
            </button>
          </nav>
          <div v-if="authStore.isAdmin" class="hidden md:flex gap-2 pb-1 shrink-0 ml-2">
            <button @click="openEditForm(selectedAccommodation)" class="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium px-2 py-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950">
              Edit
            </button>
            <button @click="deleteAccommodation(selectedAccommodation.accommodation_id)" class="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950">
              Delete
            </button>
          </div>
        </div>
      </div>

      <div class="p-3 md:p-6">
        <OverviewTab v-if="activeTab === 'living'" :accommodation="selectedAccommodation" :member-count="memberCount" />
        <BedroomsTab v-if="activeTab === 'bedrooms'" :accommodation="selectedAccommodation" @refresh="selectAccommodation(selectedAccommodation.accommodation_id)" />
        <AmenitiesTab v-if="activeTab === 'amenities'" :accommodation="selectedAccommodation" />
        <LocationTab v-if="activeTab === 'location'" :accommodation="selectedAccommodation" />
        <AttendeesTab v-if="activeTab === 'attendees'" />
      </div>
    </div>

    <div v-else-if="!loading" class="text-center py-16 text-gray-500 dark:text-gray-400">
      <p class="text-lg">No accommodations yet</p>
      <p class="text-sm mt-1">Add your first accommodation to get started</p>
    </div>
  </div>
</template>
