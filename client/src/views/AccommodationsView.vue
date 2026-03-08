<script setup>
import { ref, watch, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
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

function resetForm() {
  form.value = { description: '', address: '', airbnb_id: '', airbnb_url: '', check_in_datetime: '', check_out_datetime: '', total_cost: '' };
  airbnbUrl.value = '';
  scrapeError.value = '';
  scrapeSuccess.value = false;
  scrapedBedrooms.value = [];
  scrapedImages.value = [];
  editingId.value = null;
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
    const { data } = await apiClient.get(`/accommodations/trip/${tripStore.selectedTripId}`);
    accommodations.value = data.data;
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
  await apiClient.delete(`/accommodations/${id}`);
  if (selectedAccommodation.value?.accommodation_id === id) {
    selectedAccommodation.value = null;
  }
  await fetchAccommodations();
}

watch(() => tripStore.selectedTripId, fetchAccommodations);
onMounted(fetchAccommodations);
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-gray-900">Accommodations</h2>
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
    <div v-if="showForm" class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">{{ editingId ? 'Edit Accommodation' : 'New Accommodation' }}</h3>

      <!-- Airbnb URL paste section -->
      <div class="mb-5 pb-5 border-b border-gray-200">
        <label class="block text-sm font-medium text-gray-700 mb-1">Paste Airbnb Link</label>
        <div class="flex gap-2">
          <input
            v-model="airbnbUrl"
            class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
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
      <div v-if="scrapeSuccess" class="mb-5 pb-5 border-b border-gray-200 bg-green-50 -mx-6 px-6 py-4">
        <p class="text-sm font-medium text-green-800 mb-2">Auto-filled from Airbnb</p>
        <div class="text-sm text-green-700 space-y-1">
          <p v-if="form.description"><span class="font-medium">Description:</span> {{ form.description }}</p>
          <p v-if="form.address"><span class="font-medium">Address:</span> {{ form.address }}</p>
          <p v-if="form.check_in_datetime"><span class="font-medium">Check-in:</span> {{ form.check_in_datetime.replace('T', ' ') }}</p>
          <p v-if="form.check_out_datetime"><span class="font-medium">Check-out:</span> {{ form.check_out_datetime.replace('T', ' ') }}</p>
          <p v-if="scrapedImages.length"><span class="font-medium">Photos:</span> {{ scrapedImages.length }} images</p>
        </div>
        <div v-if="scrapedBedrooms.length" class="mt-3">
          <p class="text-sm font-medium text-green-800 mb-1">Bedrooms ({{ scrapedBedrooms.length }})</p>
          <div class="grid grid-cols-3 gap-2">
            <div v-for="(br, i) in scrapedBedrooms" :key="i" class="bg-white rounded-lg overflow-hidden border border-green-200">
              <img v-if="br.image_url" :src="br.image_url" class="w-full h-20 object-cover" />
              <div class="px-3 py-2">
                <p class="text-xs font-medium text-gray-800">{{ br.name }}</p>
                <p class="text-xs text-gray-500">{{ br.bed_description }}</p>
              </div>
            </div>
          </div>
          <p class="text-xs text-green-600 mt-2">Bedrooms, beds, and images will be created automatically on save.</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="col-span-2">
          <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <input v-model="form.description" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Cozy mountain cabin..." />
        </div>
        <div class="col-span-2">
          <label class="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <input v-model="form.address" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="123 Main St..." />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Airbnb ID</label>
          <input v-model="form.airbnb_id" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Total Cost</label>
          <input v-model="form.total_cost" type="number" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Check-in</label>
          <input v-model="form.check_in_datetime" type="datetime-local" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Check-out</label>
          <input v-model="form.check_out_datetime" type="datetime-local" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
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
        :class="selectedAccommodation?.accommodation_id === acc.accommodation_id ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'"
      >
        {{ acc.description || `Accommodation ${acc.accommodation_id}` }}
      </button>
    </div>

    <!-- Tabs -->
    <div v-if="selectedAccommodation" class="bg-white rounded-xl shadow-sm border border-gray-200">
      <div class="border-b border-gray-200">
        <div class="flex items-center justify-between px-4 pt-2">
          <nav class="flex gap-0">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              @click="activeTab = tab.id"
              class="px-6 py-3 text-sm font-medium border-b-2 transition-colors"
              :class="activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'"
            >
              {{ tab.label }}
            </button>
          </nav>
          <div v-if="authStore.isAdmin" class="flex gap-2 pb-1">
            <button @click="openEditForm(selectedAccommodation)" class="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded hover:bg-indigo-50">
              Edit
            </button>
            <button @click="deleteAccommodation(selectedAccommodation.accommodation_id)" class="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50">
              Delete
            </button>
          </div>
        </div>
      </div>

      <div class="p-6">
        <OverviewTab v-if="activeTab === 'living'" :accommodation="selectedAccommodation" />
        <BedroomsTab v-if="activeTab === 'bedrooms'" :accommodation="selectedAccommodation" @refresh="selectAccommodation(selectedAccommodation.accommodation_id)" />
        <AmenitiesTab v-if="activeTab === 'amenities'" :accommodation="selectedAccommodation" />
        <LocationTab v-if="activeTab === 'location'" :accommodation="selectedAccommodation" />
        <AttendeesTab v-if="activeTab === 'attendees'" />
      </div>
    </div>

    <div v-else-if="!loading" class="text-center py-16 text-gray-500">
      <p class="text-lg">No accommodations yet</p>
      <p class="text-sm mt-1">Add your first accommodation to get started</p>
    </div>
  </div>
</template>
