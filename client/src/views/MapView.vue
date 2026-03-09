<script setup>
import { ref, watch, onMounted } from 'vue';
import { Loader } from '@googlemaps/js-api-loader';
import { useTripStore } from '../stores/trip';
import { useAgentStore } from '../stores/agent';
import apiClient from '../api/client';

const tripStore = useTripStore();
const mapContainer = ref(null);
const loading = ref(false);
let map = null;
let markers = [];

const loader = new Loader({
  apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  version: 'weekly',
  libraries: ['places', 'marker', 'geocoding'],
});

async function loadMap() {
  if (!tripStore.selectedTripId || !mapContainer.value) return;
  loading.value = true;

  try {
    const [accommodationsRes, activitiesRes] = await Promise.all([
      apiClient.get(`/accommodations/trip/${tripStore.selectedTripId}`),
      apiClient.get(`/activities/trip/${tripStore.selectedTripId}`),
    ]);

    const accommodations = accommodationsRes.data.data;
    const activities = activitiesRes.data.data;

    const { Map } = await loader.importLibrary('maps');
    const { Geocoder } = await loader.importLibrary('geocoding');
    const { AdvancedMarkerElement, PinElement } = await loader.importLibrary('marker');
    const geocoder = new Geocoder();

    // Clear existing markers
    markers.forEach(m => m.map = null);
    markers = [];

    map = new Map(mapContainer.value, {
      center: { lat: 40, lng: -100 },
      zoom: 4,
      mapId: 'trip-planner-overview',
    });

    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    // Geocode accommodations
    for (const acc of accommodations) {
      if (!acc.address) continue;
      try {
        const result = await geocoder.geocode({ address: acc.address });
        if (result.results.length > 0) {
          const pos = result.results[0].geometry.location;
          const pin = new PinElement({ background: '#4F46E5', borderColor: '#3730A3', glyphColor: '#fff' });
          const marker = new AdvancedMarkerElement({
            map,
            position: pos,
            title: acc.description || 'Accommodation',
            content: pin.element,
          });
          markers.push(marker);
          bounds.extend(pos);
          hasPoints = true;
        }
      } catch { /* skip failed geocodes */ }
    }

    // Geocode activities — try place_id first, fall back to address, then stored lat/lng
    for (const act of activities) {
      try {
        let pos = null;
        if (act.google_place_id) {
          const result = await geocoder.geocode({ placeId: act.google_place_id });
          if (result.results.length > 0) pos = result.results[0].geometry.location;
        }
        if (!pos && act.address) {
          const result = await geocoder.geocode({ address: act.address });
          if (result.results.length > 0) pos = result.results[0].geometry.location;
        }
        if (!pos && act.latitude && act.longitude) {
          pos = new google.maps.LatLng(act.latitude, act.longitude);
        }
        if (pos) {
          const pin = new PinElement({ background: '#059669', borderColor: '#047857', glyphColor: '#fff' });
          const marker = new AdvancedMarkerElement({ map, position: pos, title: act.title, content: pin.element });
          markers.push(marker);
          bounds.extend(pos);
          hasPoints = true;
        }
      } catch { /* skip failed geocodes */ }
    }

    if (hasPoints) {
      map.fitBounds(bounds, 50);
    }
  } finally {
    loading.value = false;
  }
}

watch(() => tripStore.selectedTripId, loadMap);
onMounted(loadMap);

// Global agent panel — handle center-map action
const agentStore = useAgentStore();
watch(() => agentStore.pendingAction, async (action) => {
  if (!action || action.type !== 'center-map') return;
  agentStore.clearAction();
  if (!map) return;
  try {
    const { Geocoder } = await loader.importLibrary('geocoding');
    const geocoder = new Geocoder();
    const result = await geocoder.geocode({ address: action.query });
    if (result.results.length > 0) {
      const pos = result.results[0].geometry.location;
      map.panTo(pos);
      map.setZoom(14);
    }
  } catch (err) {
    console.error('Failed to center map:', err.message);
  }
});
</script>

<template>
  <div>
    <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Map</h2>

    <div class="flex gap-4 mb-4">
      <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <span class="w-3 h-3 rounded-full bg-indigo-600"></span> Accommodations
      </div>
      <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <span class="w-3 h-3 rounded-full bg-emerald-600"></span> Activities
      </div>
    </div>

    <div ref="mapContainer" class="w-full h-[calc(100vh-13rem)] md:h-[600px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800"></div>
  </div>
</template>
