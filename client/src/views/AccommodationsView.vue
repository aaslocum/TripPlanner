<script setup>
import { ref, watch, onMounted } from 'vue';
import { useTripStore } from '../stores/trip';
import apiClient from '../api/client';
import LivingSpaceTab from '../components/accommodations/LivingSpaceTab.vue';
import BedroomsTab from '../components/accommodations/BedroomsTab.vue';
import AmenitiesTab from '../components/accommodations/AmenitiesTab.vue';
import LocationTab from '../components/accommodations/LocationTab.vue';

const tripStore = useTripStore();
const accommodations = ref([]);
const selectedAccommodation = ref(null);
const activeTab = ref('living');
const loading = ref(false);
const showForm = ref(false);
const form = ref({ description: '', address: '', airbnb_id: '', check_in_datetime: '', check_out_datetime: '', total_cost: '' });

const tabs = [
  { id: 'living', label: 'Living Space' },
  { id: 'bedrooms', label: 'Bedrooms' },
  { id: 'amenities', label: 'Amenities' },
  { id: 'location', label: 'Location' },
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

async function saveAccommodation() {
  const payload = {
    ...form.value,
    trip_id: tripStore.selectedTripId,
    total_cost: form.value.total_cost ? Number(form.value.total_cost) : null,
  };
  await apiClient.post('/accommodations', payload);
  showForm.value = false;
  form.value = { description: '', address: '', airbnb_id: '', check_in_datetime: '', check_out_datetime: '', total_cost: '' };
  await fetchAccommodations();
}

watch(() => tripStore.selectedTripId, fetchAccommodations);
onMounted(fetchAccommodations);
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-gray-900">Accommodations</h2>
      <button @click="showForm = !showForm" class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
        {{ showForm ? 'Cancel' : '+ Add Accommodation' }}
      </button>
    </div>

    <!-- Add form -->
    <div v-if="showForm" class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
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
      <button @click="saveAccommodation" class="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">Save</button>
    </div>

    <!-- Accommodation selector -->
    <div v-if="accommodations.length > 1" class="flex gap-2 mb-4">
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
      </div>

      <div class="p-6">
        <LivingSpaceTab v-if="activeTab === 'living'" :accommodation="selectedAccommodation" />
        <BedroomsTab v-if="activeTab === 'bedrooms'" :accommodation="selectedAccommodation" @refresh="selectAccommodation(selectedAccommodation.accommodation_id)" />
        <AmenitiesTab v-if="activeTab === 'amenities'" :accommodation="selectedAccommodation" />
        <LocationTab v-if="activeTab === 'location'" :accommodation="selectedAccommodation" />
      </div>
    </div>

    <div v-else-if="!loading" class="text-center py-16 text-gray-500">
      <p class="text-lg">No accommodations yet</p>
      <p class="text-sm mt-1">Add your first accommodation to get started</p>
    </div>
  </div>
</template>
