<script setup>
import { ref, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { mapsLoader as loader } from '../utils/mapsLoader';
import { useTripStore } from '../stores/trip';
import { useAgentStore } from '../stores/agent';
import { useDarkMode } from '../composables/useDarkMode';
import { useTripColor, COLOR_MAP } from '../composables/useTripColor';
import apiClient from '../api/client';

const route = useRoute();
const tripStore = useTripStore();
const { isDark } = useDarkMode();
const { categoryColors } = useTripColor();
const mapContainer = ref(null);
const loading = ref(false);
let map = null;
let markers = [];
let infoWindow = null;

function makeInfoContent(title, address, typeLabel, color, imageUrl) {
  return `<div style="padding:4px 2px;min-width:180px;max-width:260px">
    ${imageUrl ? `<img src="${imageUrl}" alt="" style="width:100%;height:120px;object-fit:cover;border-radius:6px;margin-bottom:6px" />` : ''}
    <div style="font-weight:600;font-size:14px;color:#111">${title}</div>
    ${address ? `<div style="font-size:12px;color:#555;margin-top:3px">${address}</div>` : ''}
    <div style="font-size:11px;color:${color};margin-top:3px;font-weight:500">${typeLabel}</div>
  </div>`;
}

async function loadMap() {
  if (!tripStore.selectedTripId || !mapContainer.value) return;
  loading.value = true;

  try {
    const [accommodationsRes, activitiesRes, eatsRes] = await Promise.all([
      apiClient.get(`/accommodations/trip/${tripStore.selectedTripId}`),
      apiClient.get(`/activities/trip/${tripStore.selectedTripId}`),
      apiClient.get(`/eats/trip/${tripStore.selectedTripId}`),
    ]);

    const accommodations = accommodationsRes.data.data;
    const activities = activitiesRes.data.data;
    const eats = eatsRes.data.data;

    const { Map, InfoWindow } = await loader.importLibrary('maps');
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
      colorScheme: isDark.value ? 'DARK' : 'LIGHT',
    });

    infoWindow = new InfoWindow();

    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;
    let focusMarker = null;
    const focusLat = route.query.lat ? parseFloat(route.query.lat) : null;
    const focusLng = route.query.lng ? parseFloat(route.query.lng) : null;

    function addMarkerWithInfo(pos, title, address, typeLabel, color, pinOpts, imageUrl) {
      const pin = new PinElement(pinOpts);
      const marker = new AdvancedMarkerElement({ map, position: pos, title, content: pin.element });
      const content = makeInfoContent(title, address || '', typeLabel, color, imageUrl);

      marker.addEventListener('click', () => {
        infoWindow.close();
        infoWindow.setContent(content);
        infoWindow.open({ anchor: marker, map });
      });

      markers.push(marker);
      bounds.extend(pos);

      // Check if this is the focused marker from query params
      if (focusLat && focusLng) {
        const lat = typeof pos.lat === 'function' ? pos.lat() : pos.lat;
        const lng = typeof pos.lng === 'function' ? pos.lng() : pos.lng;
        if (Math.abs(lat - focusLat) < 0.001 && Math.abs(lng - focusLng) < 0.001) {
          focusMarker = { marker, content };
        }
      }

      return marker;
    }

    // Resolve category colors for markers
    const staysC = COLOR_MAP[categoryColors.value.stays];
    const activitiesC = COLOR_MAP[categoryColors.value.activities];
    const eatsC = COLOR_MAP[categoryColors.value.eats];

    // Geocode accommodations
    for (const acc of accommodations) {
      if (!acc.address) continue;
      try {
        const result = await geocoder.geocode({ address: acc.address });
        if (result.results.length > 0) {
          addMarkerWithInfo(
            result.results[0].geometry.location,
            acc.description || 'Accommodation',
            acc.address,
            'Accommodation',
            staysC.accent,
            { background: staysC.accent, borderColor: staysC.hover, glyphColor: '#fff' },
            acc.image_url
          );
          hasPoints = true;
        }
      } catch { /* skip failed geocodes */ }
    }

    // Geocode activities
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
          addMarkerWithInfo(pos, act.title, act.address, 'Activity', activitiesC.accent,
            { background: activitiesC.accent, borderColor: activitiesC.hover, glyphColor: '#fff' },
            act.image_url);
          hasPoints = true;
        }
      } catch { /* skip failed geocodes */ }
    }

    // Geocode eats
    for (const eat of eats) {
      try {
        let pos = null;
        if (eat.google_place_id) {
          const result = await geocoder.geocode({ placeId: eat.google_place_id });
          if (result.results.length > 0) pos = result.results[0].geometry.location;
        }
        if (!pos && eat.address) {
          const result = await geocoder.geocode({ address: eat.address });
          if (result.results.length > 0) pos = result.results[0].geometry.location;
        }
        if (!pos && eat.latitude && eat.longitude) {
          pos = new google.maps.LatLng(eat.latitude, eat.longitude);
        }
        if (pos) {
          addMarkerWithInfo(pos, eat.title, eat.address, 'Dining', eatsC.accent,
            { background: eatsC.accent, borderColor: eatsC.hover, glyphColor: '#fff' },
            eat.image_url);
          hasPoints = true;
        }
      } catch { /* skip failed geocodes */ }
    }

    if (hasPoints) {
      map.fitBounds(bounds, 50);
    }

    // If navigated here with focus query params, zoom in and open info window
    if (focusMarker) {
      setTimeout(() => {
        map.panTo(focusMarker.marker.position);
        map.setZoom(15);
        infoWindow.setContent(focusMarker.content);
        infoWindow.open({ anchor: focusMarker.marker, map });
      }, 300);
    } else if (focusLat && focusLng) {
      // Marker not found but we have coords — just center and show title
      setTimeout(() => {
        const pos = new google.maps.LatLng(focusLat, focusLng);
        map.panTo(pos);
        map.setZoom(15);
        if (route.query.title) {
          infoWindow.setContent(makeInfoContent(route.query.title, route.query.address || '', 'Dining', eatsC.accent));
          infoWindow.setPosition(pos);
          infoWindow.open(map);
        }
      }, 300);
    }
  } finally {
    loading.value = false;
  }
}

watch(() => tripStore.selectedTripId, loadMap);
onMounted(loadMap);

// Reload map when dark mode toggles to apply new colorScheme
watch(isDark, () => {
  if (map) loadMap();
});

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
    <h2 class="text-2xl font-display font-black uppercase tracking-wide text-flag-black dark:text-warm-100 mb-6">Map</h2>

    <div class="flex gap-4 mb-4">
      <div class="flex items-center gap-2 text-sm text-warm-700 dark:text-warm-400">
        <span class="w-3 h-3 rounded-full bg-cat-stays"></span> Stays
      </div>
      <div class="flex items-center gap-2 text-sm text-warm-700 dark:text-warm-400">
        <span class="w-3 h-3 rounded-full bg-cat-activities"></span> Activities
      </div>
      <div class="flex items-center gap-2 text-sm text-warm-700 dark:text-warm-400">
        <span class="w-3 h-3 rounded-full bg-cat-eats"></span> Eats
      </div>
    </div>

    <div ref="mapContainer" class="w-full h-[calc(100vh-13rem)] md:h-[600px] rounded-xl overflow-hidden border border-warm-200 dark:border-dark-border bg-warm-200 dark:bg-dark-raised"></div>
  </div>
</template>
