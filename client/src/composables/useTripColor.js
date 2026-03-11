import { watch, computed } from 'vue';
import { useTripStore } from '../stores/trip';

export const COLOR_MAP = {
  green:  { label: 'Green',  accent: '#00843d', hover: '#006d32', light: '#e6f4ec' },
  red:    { label: 'Red',    accent: '#9c1a28', hover: '#891824', light: '#fde8ea' },
  yellow: { label: 'Gold',   accent: '#d97706', hover: '#b45309', light: '#fef3c7' },
  purple: { label: 'Purple', accent: '#800080', hover: '#6d006d', light: '#f5e6f5' },
};

export const COLOR_OPTIONS = Object.keys(COLOR_MAP);

function applyTripColor(colorName) {
  const colors = COLOR_MAP[colorName] || COLOR_MAP.green;
  const root = document.documentElement;
  root.style.setProperty('--color-trip-accent', colors.accent);
  root.style.setProperty('--color-trip-accent-hover', colors.hover);
  root.style.setProperty('--color-trip-accent-light', colors.light);
}

export function useTripColor() {
  const tripStore = useTripStore();

  const tripColor = computed(() => tripStore.selectedTrip?.color || 'green');

  watch(tripColor, (color) => {
    applyTripColor(color);
  }, { immediate: true });

  return { tripColor, COLOR_MAP, COLOR_OPTIONS };
}
