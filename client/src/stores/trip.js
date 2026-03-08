import { defineStore } from 'pinia';
import apiClient from '../api/client';

export const useTripStore = defineStore('trip', {
  state: () => ({
    trips: [],
    selectedTripId: null,
    loading: false,
  }),

  getters: {
    selectedTrip: (state) =>
      state.trips.find((t) => t.trip_id === state.selectedTripId) || null,
  },

  actions: {
    async fetchTrips() {
      this.loading = true;
      try {
        const { data } = await apiClient.get('/trips');
        this.trips = data.data;
        // Auto-select first trip if none selected
        if (!this.selectedTripId && this.trips.length > 0) {
          this.selectedTripId = this.trips[0].trip_id;
        }
      } finally {
        this.loading = false;
      }
    },

    selectTrip(tripId) {
      this.selectedTripId = tripId;
    },

    async createTrip(tripData) {
      const { data } = await apiClient.post('/trips', tripData);
      this.trips.push(data.data);
      return data.data;
    },

    async updateTrip(tripId, tripData) {
      const { data } = await apiClient.put(`/trips/${tripId}`, tripData);
      const index = this.trips.findIndex((t) => t.trip_id === tripId);
      if (index !== -1) this.trips[index] = data.data;
      return data.data;
    },

    async deleteTrip(tripId) {
      await apiClient.delete(`/trips/${tripId}`);
      this.trips = this.trips.filter((t) => t.trip_id !== tripId);
      if (this.selectedTripId === tripId) {
        this.selectedTripId = this.trips[0]?.trip_id || null;
      }
    },
  },

  persist: {
    pick: ['selectedTripId'],
  },
});
