// Geolocation and airport detection

const AIRPORTS = [
  // US airports
  { code: 'ATL', name: 'Atlanta', lat: 33.6407, lon: -84.4277 },
  { code: 'LAX', name: 'Los Angeles', lat: 33.9416, lon: -118.4085 },
  { code: 'ORD', name: 'Chicago', lat: 41.9742, lon: -87.9073 },
  { code: 'DFW', name: 'Dallas', lat: 32.8998, lon: -97.0403 },
  { code: 'JFK', name: 'New York JFK', lat: 40.6413, lon: -73.7781 },
  { code: 'DEN', name: 'Denver', lat: 39.8561, lon: -104.6737 },
  { code: 'SFO', name: 'San Francisco', lat: 37.6213, lon: -122.3790 },
  { code: 'SEA', name: 'Seattle', lat: 47.4502, lon: -122.3088 },
  { code: 'MIA', name: 'Miami', lat: 25.7959, lon: -80.2870 },
  { code: 'BOS', name: 'Boston', lat: 42.3656, lon: -71.0096 },
  { code: 'PHX', name: 'Phoenix', lat: 33.4352, lon: -112.0101 },
  { code: 'IAH', name: 'Houston', lat: 29.9902, lon: -95.3368 },
  { code: 'LAS', name: 'Las Vegas', lat: 36.0840, lon: -115.1537 },
  { code: 'MSP', name: 'Minneapolis', lat: 44.8848, lon: -93.2223 },
  { code: 'DTW', name: 'Detroit', lat: 42.2162, lon: -83.3554 },
  { code: 'PHL', name: 'Philadelphia', lat: 39.8744, lon: -75.2424 },
  { code: 'CLT', name: 'Charlotte', lat: 35.2144, lon: -80.9473 },
  { code: 'EWR', name: 'Newark', lat: 40.6895, lon: -74.1745 },
  { code: 'SLC', name: 'Salt Lake City', lat: 40.7899, lon: -111.9791 },
  { code: 'PDX', name: 'Portland', lat: 45.5898, lon: -122.5951 },
  // Major international airports
  { code: 'YYZ', name: 'Toronto', lat: 43.6777, lon: -79.6248 },
  { code: 'YVR', name: 'Vancouver', lat: 49.1967, lon: -123.1815 },
  { code: 'LHR', name: 'London Heathrow', lat: 51.4700, lon: -0.4543 },
  { code: 'CDG', name: 'Paris CDG', lat: 49.0097, lon: 2.5479 },
];

function distance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function getNearestAirport(lat, lon) {
  let nearest = AIRPORTS[0];
  let minDist = distance(lat, lon, nearest.lat, nearest.lon);

  for (const airport of AIRPORTS) {
    const dist = distance(lat, lon, airport.lat, airport.lon);
    if (dist < minDist) {
      minDist = dist;
      nearest = airport;
    }
  }

  return nearest;
}

export function initLocationDetection() {
  const airportInput = document.getElementById('airport');

  // Set default to ATL
  airportInput.value = 'ATL';

  // Try to detect user location silently (no prompts if denied)
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const airport = getNearestAirport(latitude, longitude);
        airportInput.value = airport.code;
        airportInput.placeholder = `Detected: ${airport.name}`;
      },
      () => {
        // Silently fail - keep ATL default
        airportInput.placeholder = 'Default: Atlanta (ATL)';
      },
      { timeout: 5000, enableHighAccuracy: false }
    );
  }
}
