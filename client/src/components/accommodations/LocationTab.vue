<script setup>
import { ref, onMounted, watch } from 'vue';
import { Loader } from '@googlemaps/js-api-loader';

const props = defineProps({
  accommodation: { type: Object, required: true },
});

const mapContainer = ref(null);
let map = null;
let marker = null;

const loader = new Loader({
  apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  version: 'weekly',
  libraries: ['places', 'marker'],
});

async function initMap() {
  if (!props.accommodation.address || !mapContainer.value) return;

  const { Map } = await loader.importLibrary('maps');
  const { Geocoder } = await loader.importLibrary('geocoding');

  const geocoder = new Geocoder();

  try {
    const result = await geocoder.geocode({ address: props.accommodation.address });
    if (result.results.length > 0) {
      const location = result.results[0].geometry.location;

      map = new Map(mapContainer.value, {
        center: location,
        zoom: 15,
        mapId: 'trip-planner-map',
      });

      const { AdvancedMarkerElement } = await loader.importLibrary('marker');
      marker = new AdvancedMarkerElement({
        map,
        position: location,
        title: props.accommodation.description || 'Accommodation',
      });
    }
  } catch (err) {
    console.error('Geocoding failed:', err);
  }
}

onMounted(initMap);
watch(() => props.accommodation.address, initMap);
</script>

<template>
  <div>
    <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Location</h3>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">{{ accommodation.address || 'No address set' }}</p>
    <div v-if="accommodation.address" ref="mapContainer" class="w-full h-96 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"></div>
    <p v-else class="text-sm text-gray-400">Add an address to see the location on the map.</p>
  </div>
</template>
