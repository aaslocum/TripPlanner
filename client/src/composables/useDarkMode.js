import { ref, watch } from 'vue';

const STORAGE_KEY = 'tripplanner-dark-mode';

function getInitialValue() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored !== null) return stored === 'true';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

const isDark = ref(getInitialValue());

function applyToDocument(dark) {
  document.documentElement.classList.toggle('dark', dark);
}

applyToDocument(isDark.value);

watch(isDark, (val) => {
  localStorage.setItem(STORAGE_KEY, String(val));
  applyToDocument(val);
});

export function useDarkMode() {
  function toggle() {
    isDark.value = !isDark.value;
  }
  return { isDark, toggle };
}
