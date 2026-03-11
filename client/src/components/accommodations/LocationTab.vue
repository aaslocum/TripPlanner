<script setup>
import { ref, onMounted, watch } from 'vue';
import { mapsLoader as loader } from '../../utils/mapsLoader';

const props = defineProps({
  accommodation: { type: Object, required: true },
});

const mapContainer = ref(null);
let map = null;
let marker = null;


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
    <h3 class="text-lg font-semibold text-flag-black dark:text-warm-100 mb-2">Location</h3>
    <p class="text-sm text-warm-500 dark:text-warm-400 mb-4">{{ accommodation.address || 'No address set' }}</p>
    <div v-if="accommodation.address" ref="mapContainer" class="w-full h-96 rounded-lg overflow-hidden border border-warm-200 dark:border-dark-border"></div>
    <p v-else class="text-sm text-warm-400">Add an address to see the location on the map.</p>
  </div>
</template>
