import { Loader } from '@googlemaps/js-api-loader';

// Singleton loader — shared across all views/components.
// Must declare the UNION of all libraries used anywhere in the app,
// because the Loader throws if re-constructed with different options.
export const mapsLoader = new Loader({
  apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  version: 'weekly',
  libraries: ['places', 'marker', 'geocoding'],
});
