import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();
vi.mock('../../api/client.js', () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
    put: (...args) => mockPut(...args),
    delete: (...args) => mockDelete(...args),
  },
}));

const { useTripStore } = await import('../trip.js');

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
});

describe('trip store', () => {
  describe('initial state', () => {
    it('starts with empty trips and no selection', () => {
      const store = useTripStore();
      expect(store.trips).toEqual([]);
      expect(store.selectedTripId).toBeNull();
      expect(store.loading).toBe(false);
    });
  });

  describe('fetchTrips', () => {
    it('loads trips and sets loading state', async () => {
      const trips = [
        { trip_id: 1, trip_name: 'Trip A' },
        { trip_id: 2, trip_name: 'Trip B' },
      ];
      mockGet.mockResolvedValue({ data: { data: trips } });

      const store = useTripStore();
      await store.fetchTrips();

      expect(store.trips).toEqual(trips);
      expect(store.loading).toBe(false);
    });

    it('auto-selects first trip if none selected', async () => {
      mockGet.mockResolvedValue({ data: { data: [{ trip_id: 5, trip_name: 'Auto' }] } });

      const store = useTripStore();
      await store.fetchTrips();

      expect(store.selectedTripId).toBe(5);
    });

    it('preserves existing selection', async () => {
      mockGet.mockResolvedValue({ data: { data: [
        { trip_id: 1, trip_name: 'A' },
        { trip_id: 2, trip_name: 'B' },
      ] } });

      const store = useTripStore();
      store.selectedTripId = 2;
      await store.fetchTrips();

      expect(store.selectedTripId).toBe(2);
    });

    it('sets loading to false even on error', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      const store = useTripStore();
      await expect(store.fetchTrips()).rejects.toThrow('Network error');
      expect(store.loading).toBe(false);
    });
  });

  describe('selectTrip', () => {
    it('updates selectedTripId', () => {
      const store = useTripStore();
      store.selectTrip(42);
      expect(store.selectedTripId).toBe(42);
    });
  });

  describe('selectedTrip getter', () => {
    it('returns the matching trip', () => {
      const store = useTripStore();
      store.trips = [{ trip_id: 1, trip_name: 'A' }, { trip_id: 2, trip_name: 'B' }];
      store.selectedTripId = 2;
      expect(store.selectedTrip).toEqual({ trip_id: 2, trip_name: 'B' });
    });

    it('returns null when no trip selected', () => {
      const store = useTripStore();
      store.trips = [{ trip_id: 1 }];
      expect(store.selectedTrip).toBeNull();
    });
  });

  describe('createTrip', () => {
    it('adds trip to local array', async () => {
      const newTrip = { trip_id: 3, trip_name: 'New' };
      mockPost.mockResolvedValue({ data: { data: newTrip } });

      const store = useTripStore();
      const result = await store.createTrip({ trip_name: 'New' });

      expect(result).toEqual(newTrip);
      expect(store.trips).toContainEqual(newTrip);
    });
  });

  describe('updateTrip', () => {
    it('updates trip in local array', async () => {
      const updated = { trip_id: 1, trip_name: 'Updated' };
      mockPut.mockResolvedValue({ data: { data: updated } });

      const store = useTripStore();
      store.trips = [{ trip_id: 1, trip_name: 'Original' }];

      const result = await store.updateTrip(1, { trip_name: 'Updated' });

      expect(result).toEqual(updated);
      expect(store.trips[0].trip_name).toBe('Updated');
    });
  });

  describe('deleteTrip', () => {
    it('removes trip from local array', async () => {
      mockDelete.mockResolvedValue({});

      const store = useTripStore();
      store.trips = [{ trip_id: 1 }, { trip_id: 2 }];
      store.selectedTripId = 1;

      await store.deleteTrip(1);

      expect(store.trips).toEqual([{ trip_id: 2 }]);
    });

    it('updates selection when deleted trip was selected', async () => {
      mockDelete.mockResolvedValue({});

      const store = useTripStore();
      store.trips = [{ trip_id: 1 }, { trip_id: 2 }];
      store.selectedTripId = 1;

      await store.deleteTrip(1);

      expect(store.selectedTripId).toBe(2);
    });

    it('sets selection to null when last trip deleted', async () => {
      mockDelete.mockResolvedValue({});

      const store = useTripStore();
      store.trips = [{ trip_id: 1 }];
      store.selectedTripId = 1;

      await store.deleteTrip(1);

      expect(store.selectedTripId).toBeNull();
    });
  });
});
