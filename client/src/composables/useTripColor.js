import { watch, computed } from 'vue';
import { useTripStore } from '../stores/trip';

export const COLOR_MAP = {
  green:  { label: 'Green',  accent: '#00843d', hover: '#006d32', light: '#e6f4ec' },
  red:    { label: 'Red',    accent: '#9c1a28', hover: '#891824', light: '#fde8ea' },
  yellow: { label: 'Gold',   accent: '#d97706', hover: '#b45309', light: '#fef3c7' },
  purple: { label: 'Purple', accent: '#800080', hover: '#6d006d', light: '#f5e6f5' },
};

export const COLOR_OPTIONS = Object.keys(COLOR_MAP);

// Preferred category colors — each gets its preferred unless the trip claims it,
// in which case it falls back to yellow (the remaining unused color).
const CATEGORY_PREFERRED = {
  stays: 'green',
  eats: 'red',
  activities: 'purple',
};

function applyCategoryColors(tripColorName) {
  const root = document.documentElement;
  for (const [category, preferred] of Object.entries(CATEGORY_PREFERRED)) {
    const colorName = preferred === tripColorName ? 'yellow' : preferred;
    const colors = COLOR_MAP[colorName];
    root.style.setProperty(`--color-cat-${category}`, colors.accent);
    root.style.setProperty(`--color-cat-${category}-hover`, colors.hover);
    root.style.setProperty(`--color-cat-${category}-light`, colors.light);
  }
}

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

  // Resolved category color names (reactive)
  const categoryColors = computed(() => {
    const tc = tripColor.value;
    return {
      stays: CATEGORY_PREFERRED.stays === tc ? 'yellow' : CATEGORY_PREFERRED.stays,
      eats: CATEGORY_PREFERRED.eats === tc ? 'yellow' : CATEGORY_PREFERRED.eats,
      activities: CATEGORY_PREFERRED.activities === tc ? 'yellow' : CATEGORY_PREFERRED.activities,
    };
  });

  watch(tripColor, (color) => {
    applyTripColor(color);
    applyCategoryColors(color);
  }, { immediate: true });

  return { tripColor, categoryColors, COLOR_MAP, COLOR_OPTIONS };
}
