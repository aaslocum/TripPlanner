<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useTripStore } from '../stores/trip';
import apiClient from '../api/client';

const tripStore = useTripStore();
const itinerary = ref({});
const members = ref([]);
const loading = ref(false);
const selectedDate = ref(null);

const HOUR_HEIGHT = 80; // px per hour
const MIN_EVENT_HEIGHT = 52; // min px so text stays readable

// ---- Data fetching ----

async function fetchItinerary() {
  if (!tripStore.selectedTripId) return;
  loading.value = true;
  try {
    const [itinRes, membersRes] = await Promise.all([
      apiClient.get(`/trips/${tripStore.selectedTripId}/itinerary`),
      apiClient.get(`/trips/${tripStore.selectedTripId}/members`),
    ]);
    itinerary.value = itinRes.data.data;
    members.value = membersRes.data.data;
  } finally {
    loading.value = false;
  }
}

function attendanceForDate(dateStr) {
  const confirmed = members.value.filter(m => m.rsvp_status === 'yes');
  const trip = tripStore.selectedTrip;
  return confirmed.filter(m => {
    const start = m.arrival_date || trip?.start_date;
    const end = m.departure_date || trip?.end_date;
    if (!start || !end) return true; // no dates set, assume full trip
    return dateStr >= start && dateStr <= end;
  }).length;
}

// ---- Day tabs ----

// All dates in the trip range (even days with nothing scheduled)
const allDates = computed(() => {
  const trip = tripStore.selectedTrip;
  if (trip?.start_date && trip?.end_date) {
    const dates = [];
    const start = new Date(trip.start_date + 'T00:00:00');
    const end = new Date(trip.end_date + 'T00:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  }
  // Fallback: use whatever dates came from the API
  return Object.keys(itinerary.value).filter(d => d !== 'Unscheduled').sort();
});

const hasUnscheduled = computed(() => (itinerary.value['Unscheduled']?.length || 0) > 0);

// Auto-select first tab
watch(allDates, (dates) => {
  if (dates.length && (!selectedDate.value || !dates.includes(selectedDate.value))) {
    selectedDate.value = dates[0];
  }
}, { immediate: true });

// ---- Events for the selected day ----

const dayEvents = computed(() => {
  if (!selectedDate.value || selectedDate.value === 'Unscheduled') return [];
  return itinerary.value[selectedDate.value] || [];
});

const scheduledEvents = computed(() => dayEvents.value.filter(e => e.datetime));

// ---- Timeline range ----

const timeRange = computed(() => {
  const events = scheduledEvents.value;
  if (!events.length) return { startHour: 8, endHour: 20 };

  let minH = 24;
  let maxH = 0;
  events.forEach(e => {
    const d = new Date(e.datetime);
    minH = Math.min(minH, d.getHours());

    let endH;
    if (e.end_datetime) {
      const end = new Date(e.end_datetime);
      endH = end.getHours() + (end.getMinutes() > 0 ? 1 : 0);
    } else if (e.details?.duration) {
      endH = d.getHours() + Math.ceil(e.details.duration);
    } else {
      endH = d.getHours() + 1;
    }
    maxH = Math.max(maxH, endH);
  });

  return {
    startHour: Math.max(0, minH - 1),
    endHour: Math.min(24, maxH + 1),
  };
});

const hourLabels = computed(() => {
  const labels = [];
  for (let h = timeRange.value.startHour; h <= timeRange.value.endHour; h++) labels.push(h);
  return labels;
});

const timelineHeight = computed(() =>
  (timeRange.value.endHour - timeRange.value.startHour) * HOUR_HEIGHT
);

// ---- Overlap detection & column layout (Google Calendar style) ----

function getEventTimes(event) {
  const start = new Date(event.datetime).getTime();
  let end;
  if (event.end_datetime) end = new Date(event.end_datetime).getTime();
  else if (event.details?.duration) end = start + event.details.duration * 3.6e6;
  else end = start + ((event.type === 'activity' || event.type === 'eat') ? 3.6e6 : 1.8e6);
  return { start, end };
}

const eventLayout = computed(() => {
  const events = scheduledEvents.value;
  if (!events.length) return [];

  // Build items with start/end ms
  const items = events.map((event, idx) => ({
    idx, event, col: 0, totalCols: 1, ...getEventTimes(event),
  }));
  items.sort((a, b) => a.start - b.start || b.end - a.end);

  // Group connected overlapping events
  const groups = [];
  let cur = [items[0]];
  let groupEnd = items[0].end;

  for (let i = 1; i < items.length; i++) {
    if (items[i].start < groupEnd) {
      cur.push(items[i]);
      groupEnd = Math.max(groupEnd, items[i].end);
    } else {
      groups.push(cur);
      cur = [items[i]];
      groupEnd = items[i].end;
    }
  }
  groups.push(cur);

  // Within each group, assign columns
  groups.forEach(group => {
    const cols = [];
    group.forEach(item => {
      let placed = false;
      for (let c = 0; c < cols.length; c++) {
        if (cols[c][cols[c].length - 1].end <= item.start) {
          item.col = c;
          cols[c].push(item);
          placed = true;
          break;
        }
      }
      if (!placed) {
        item.col = cols.length;
        cols.push([item]);
      }
    });
    const tc = cols.length;
    group.forEach(item => { item.totalCols = tc; });
  });

  return items;
});

// ---- Event positioning ----

function eventPositionStyle(item) {
  const d = new Date(item.event.datetime);
  const startFrac = d.getHours() + d.getMinutes() / 60;
  const top = (startFrac - timeRange.value.startHour) * HOUR_HEIGHT;

  let durH;
  if (item.event.end_datetime) durH = (new Date(item.event.end_datetime) - d) / 3.6e6;
  else if (item.event.details?.duration) durH = item.event.details.duration;
  else durH = (item.event.type === 'activity' || item.event.type === 'eat') ? 1 : 0.5;

  const height = Math.max(durH * HOUR_HEIGHT - 4, MIN_EVENT_HEIGHT);
  const widthPct = 100 / item.totalCols;
  const leftPct = item.col * widthPct;
  const gap = item.totalCols > 1 ? 3 : 0;

  return {
    top: `${top}px`,
    height: `${height}px`,
    left: `${leftPct}%`,
    width: `calc(${widthPct}% - ${gap}px)`,
  };
}

// ---- Formatters ----

function formatHour(h) {
  if (h === 0 || h === 24) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function formatTime(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatTabDay(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' });
}

function formatTabDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function eventCount(dateStr) {
  return (itinerary.value[dateStr] || []).length;
}

function borderColor(type) {
  return type === 'check_in' ? 'border-l-green-500'
       : type === 'check_out' ? 'border-l-red-500'
       : type === 'eat' ? 'border-l-orange-500'
       : 'border-l-trip-accent';
}

function bgColor(type) {
  return type === 'check_in' ? 'bg-green-50 dark:bg-green-950/50'
       : type === 'check_out' ? 'bg-red-50 dark:bg-red-950/50'
       : type === 'eat' ? 'bg-orange-50 dark:bg-orange-950/50'
       : 'bg-surface dark:bg-dark-surface';
}

function typeLabel(type) {
  return type === 'check_in' ? 'Check-in'
       : type === 'check_out' ? 'Check-out'
       : type === 'eat' ? 'Dining'
       : '';
}

function typeLabelColor(type) {
  return type === 'check_in' ? 'text-green-600 dark:text-green-400'
       : type === 'check_out' ? 'text-red-600 dark:text-red-400'
       : type === 'eat' ? 'text-orange-600 dark:text-orange-400'
       : '';
}

watch(() => tripStore.selectedTripId, fetchItinerary);
onMounted(fetchItinerary);
</script>

<template>
  <div>
    <h2 class="text-2xl font-display font-black uppercase tracking-wide text-flag-black dark:text-warm-100 mb-5">Itinerary</h2>

    <!-- ===== Day Tabs ===== -->
    <div class="flex items-end gap-3 overflow-x-auto scrollbar-hide border-b border-warm-200 dark:border-dark-border mb-6">
      <button
        v-for="date in allDates"
        :key="date"
        @click="selectedDate = date"
        class="relative flex flex-col items-center px-5 py-2.5 shrink-0 transition-colors border-b-2 -mb-px"
        :class="selectedDate === date
          ? 'border-trip-accent text-trip-accent dark:text-trip-accent'
          : 'border-transparent text-warm-400 dark:text-warm-500 hover:text-warm-700 dark:hover:text-warm-400'"
      >
        <span class="text-[10px] uppercase tracking-widest font-semibold"
              :class="selectedDate === date ? 'text-trip-accent dark:text-trip-accent' : ''">
          {{ formatTabDay(date) }}
        </span>
        <span class="text-sm font-semibold mt-0.5">{{ formatTabDate(date) }}</span>
        <span v-if="attendanceForDate(date)" class="text-[9px] text-warm-400 dark:text-warm-500 mt-0.5">
          {{ attendanceForDate(date) }} attending
        </span>
        <!-- event count dot -->
        <span v-if="eventCount(date)"
              class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1"
              :class="selectedDate === date
                ? 'bg-trip-accent text-white'
                : 'bg-warm-200 dark:bg-dark-raised text-warm-700 dark:text-warm-300'">
          {{ eventCount(date) }}
        </span>
      </button>

      <!-- Unscheduled tab -->
      <button
        v-if="hasUnscheduled"
        @click="selectedDate = 'Unscheduled'"
        class="flex items-center gap-1.5 px-5 py-2.5 shrink-0 text-sm font-medium border-b-2 -mb-px transition-colors"
        :class="selectedDate === 'Unscheduled'
          ? 'border-amber-500 text-amber-700 dark:text-amber-400'
          : 'border-transparent text-warm-400 dark:text-warm-500 hover:text-warm-700 dark:hover:text-warm-400'"
      >
        Unscheduled
        <span class="min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1"
              :class="selectedDate === 'Unscheduled'
                ? 'bg-amber-500 text-white'
                : 'bg-warm-200 dark:bg-dark-raised text-warm-700 dark:text-warm-300'">
          {{ itinerary['Unscheduled']?.length || 0 }}
        </span>
      </button>
    </div>

    <!-- ===== Loading ===== -->
    <div v-if="loading" class="py-16 text-center text-warm-400 dark:text-warm-500">Loading...</div>

    <!-- ===== Timeline (scheduled day) ===== -->
    <template v-else-if="selectedDate && selectedDate !== 'Unscheduled'">

      <!-- Empty day -->
      <div v-if="scheduledEvents.length === 0" class="py-16 text-center">
        <svg class="w-12 h-12 mx-auto text-warm-400 dark:text-warm-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        <p class="text-sm text-warm-500 dark:text-warm-400">Nothing planned for this day</p>
        <p class="text-xs text-warm-400 dark:text-warm-500 mt-1">Head to Activities to start filling it in</p>
      </div>

      <!-- Timeline grid -->
      <div v-else class="relative ml-1" :style="{ height: timelineHeight + 'px' }">

        <!-- Hour grid lines -->
        <div
          v-for="hour in hourLabels"
          :key="hour"
          class="absolute left-0 right-0 flex items-start"
          :style="{ top: (hour - timeRange.startHour) * HOUR_HEIGHT + 'px' }"
        >
          <span class="w-14 shrink-0 text-[11px] font-medium text-warm-400 dark:text-warm-500 text-right pr-3 -translate-y-2 select-none">
            {{ formatHour(hour) }}
          </span>
          <div class="flex-1 border-t border-dashed border-warm-200 dark:border-dark-border"></div>
        </div>

        <!-- Half-hour subtle lines -->
        <div
          v-for="hour in hourLabels.slice(0, -1)"
          :key="'half-' + hour"
          class="absolute right-0 border-t border-dotted border-warm-200/50 dark:border-dark-border/50"
          :style="{ top: (hour - timeRange.startHour) * HOUR_HEIGHT + HOUR_HEIGHT / 2 + 'px', left: '3.5rem' }"
        ></div>

        <!-- Event area (overlap-aware columns) -->
        <div class="absolute top-0 bottom-0" style="left: 4rem; right: 0.5rem;">
          <div
            v-for="(item, idx) in eventLayout"
            :key="idx"
            class="absolute rounded-lg border-l-4 shadow-sm overflow-hidden hover:shadow-md hover:z-20 transition-shadow"
            :class="[borderColor(item.event.type), bgColor(item.event.type), 'border border-warm-200 dark:border-dark-border']"
            :style="eventPositionStyle(item)"
          >
            <div class="px-3 py-2 h-full overflow-hidden">
              <!-- Row 1: time + type badge + cost -->
              <div class="flex items-center gap-2 text-xs flex-wrap">
                <span class="text-warm-500 dark:text-warm-400 whitespace-nowrap">
                  {{ formatTime(item.event.datetime) }}<template v-if="item.event.end_datetime"> — {{ formatTime(item.event.end_datetime) }}</template>
                </span>
                <span v-if="typeLabel(item.event.type)" class="font-semibold" :class="typeLabelColor(item.event.type)">
                  {{ typeLabel(item.event.type) }}
                </span>
                <span v-if="item.event.details?.is_suggested"
                      class="text-[10px] bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-medium">
                  Suggested
                </span>
                <span v-if="item.event.details?.estimated_cost"
                      class="ml-auto text-warm-400 dark:text-warm-500 whitespace-nowrap">
                  ~${{ item.event.details.estimated_cost }}
                </span>
              </div>
              <!-- Row 2: title -->
              <h4 class="text-sm font-semibold text-flag-black dark:text-warm-100 mt-1 line-clamp-1">{{ item.event.title }}</h4>
              <!-- Row 3: description (clips if card is short) -->
              <p v-if="item.event.details?.description"
                 class="text-xs text-warm-500 dark:text-warm-400 mt-1 line-clamp-2">
                {{ item.event.details.description }}
              </p>
              <!-- Row 4: address -->
              <p v-if="item.event.details?.address"
                 class="text-[11px] text-warm-400 dark:text-warm-500 mt-1 truncate">
                {{ item.event.details.address }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ===== Unscheduled list ===== -->
    <template v-else-if="selectedDate === 'Unscheduled'">
      <div class="space-y-3">
        <div
          v-for="(event, idx) in itinerary['Unscheduled']"
          :key="idx"
          class="rounded-lg border border-warm-200 dark:border-dark-border border-l-4 p-4"
          :class="[borderColor(event.type), bgColor(event.type)]"
        >
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold uppercase tracking-wider"
                  :class="typeLabelColor(event.type) || 'text-trip-accent dark:text-trip-accent'">
              {{ typeLabel(event.type) || 'Activity' }}
            </span>
            <span v-if="event.details?.is_suggested"
                  class="text-xs bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-medium">
              Suggested
            </span>
            <span v-if="event.details?.estimated_cost" class="ml-auto text-xs text-warm-400">
              ~${{ event.details.estimated_cost }}
            </span>
          </div>
          <h4 class="mt-2 font-medium text-flag-black dark:text-warm-100">{{ event.title }}</h4>
          <p v-if="event.details?.description" class="text-sm text-warm-700 dark:text-warm-400 mt-1">{{ event.details.description }}</p>
          <p v-if="event.details?.address" class="text-xs text-warm-400 dark:text-warm-500 mt-1">{{ event.details.address }}</p>
        </div>
      </div>
    </template>

    <!-- ===== Global empty state ===== -->
    <div v-else-if="!loading && !Object.keys(itinerary).length" class="text-center py-16 text-warm-500 dark:text-warm-400">
      <p class="text-lg">Nothing on the itinerary yet</p>
      <p class="text-sm mt-1">Add accommodations and activities to build your schedule</p>
    </div>
  </div>
</template>
