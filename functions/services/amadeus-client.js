/**
 * Amadeus API Client
 * VoyGent V3 - Phase 2 Trip Building
 *
 * Integrates with Amadeus API for flights and hotels.
 * Used during Phase 2 to search for real booking options.
 *
 * Location codes are fetched from Amadeus Location API and cached in D1.
 */
import { API_CALL_COSTS } from '../lib/cost-tracker';
/**
 * Amadeus API Client
 */
export class AmadeusClient {
    apiKey;
    apiSecret;
    logger;
    db;
    baseUrl = 'https://test.api.amadeus.com'; // Use test API for development
    accessToken = null;
    tokenExpiry = 0;
    constructor(apiKey, apiSecret, logger, db) {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.logger = logger;
        this.db = db;
    }
    /**
     * Get OAuth2 access token
     */
    async getAccessToken() {
        // Return cached token if still valid
        if (this.accessToken && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }
        try {
            this.logger.debug('Requesting Amadeus access token...');
            const response = await fetch(`${this.baseUrl}/v1/security/oauth2/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: this.apiKey,
                    client_secret: this.apiSecret,
                }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Amadeus auth failed: ${response.status} - ${errorText}`);
            }
            const data = await response.json();
            this.accessToken = data.access_token;
            this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Expire 1 minute early
            this.logger.debug('Amadeus access token obtained');
            return this.accessToken;
        }
        catch (error) {
            this.logger.error(`Amadeus authentication failed: ${error}`);
            throw error;
        }
    }
    /**
     * Search for flights
     */
    async searchFlights(request, costTracker) {
        const token = await this.getAccessToken();
        try {
            this.logger.info(`Searching flights: ${request.originLocationCode} → ${request.destinationLocationCode}`);
            const params = new URLSearchParams({
                originLocationCode: request.originLocationCode,
                destinationLocationCode: request.destinationLocationCode,
                departureDate: request.departureDate,
                adults: request.adults.toString(),
                max: (request.max || 10).toString(),
                currencyCode: 'USD',
            });
            if (request.returnDate) {
                params.append('returnDate', request.returnDate);
            }
            if (request.travelClass) {
                params.append('travelClass', request.travelClass);
            }
            const response = await fetch(`${this.baseUrl}/v2/shopping/flight-offers?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Amadeus flight search failed: ${response.status} - ${errorText}`);
            }
            const data = await response.json();
            // Track cost
            if (costTracker) {
                await costTracker.trackAPICost('Amadeus', 'Flight Offers Search', API_CALL_COSTS.Amadeus['Flight Offers Search']);
            }
            this.logger.info(`Found ${data.data?.length || 0} flight offers`);
            return data.data || [];
        }
        catch (error) {
            this.logger.error(`Amadeus flight search failed: ${error}`);
            throw error;
        }
    }
    /**
     * Search for hotels
     */
    async searchHotels(request, costTracker) {
        const token = await this.getAccessToken();
        try {
            this.logger.info(`Searching hotels in ${request.cityCode}`);
            const params = new URLSearchParams({
                cityCode: request.cityCode,
                checkInDate: request.checkInDate,
                checkOutDate: request.checkOutDate,
                adults: request.adults.toString(),
                radius: (request.radius || 20).toString(),
                radiusUnit: request.radiusUnit || 'KM',
                currency: 'USD',
            });
            if (request.ratings && request.ratings.length > 0) {
                params.append('ratings', request.ratings.join(','));
            }
            const response = await fetch(`${this.baseUrl}/v3/shopping/hotel-offers?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Amadeus hotel search failed: ${response.status} - ${errorText}`);
            }
            const data = await response.json();
            // Track cost
            if (costTracker) {
                await costTracker.trackAPICost('Amadeus', 'Hotel Search', API_CALL_COSTS.Amadeus['Hotel Search']);
            }
            this.logger.info(`Found ${data.data?.length || 0} hotel offers`);
            return data.data || [];
        }
        catch (error) {
            this.logger.error(`Amadeus hotel search failed: ${error}`);
            throw error;
        }
    }
    /**
     * Search Amadeus Location API for city/airport codes
     */
    async searchLocation(keyword, subType = 'CITY') {
        const token = await this.getAccessToken();
        try {
            this.logger.info(`Searching Amadeus locations for: ${keyword} (${subType})`);
            const params = new URLSearchParams({
                keyword: keyword,
                subType: subType,
                'page[limit]': '1',
            });
            const response = await fetch(`${this.baseUrl}/v1/reference-data/locations?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                const errorText = await response.text();
                this.logger.warn(`Amadeus location search failed: ${response.status} - ${errorText}`);
                return null;
            }
            const data = await response.json();
            if (data.data && data.data.length > 0) {
                const result = data.data[0];
                this.logger.info(`Found location: ${result.name} (${result.iataCode})`);
                return result;
            }
            this.logger.warn(`No location found for: ${keyword}`);
            return null;
        }
        catch (error) {
            this.logger.error(`Amadeus location search error: ${error}`);
            return null;
        }
    }
    /**
     * Check D1 cache for location code
     */
    async getCachedLocation(searchTerm, locationType) {
        if (!this.db)
            return null;
        try {
            const result = await this.db
                .prepare('SELECT iata_code FROM location_cache WHERE search_term = ? AND location_type = ?')
                .bind(searchTerm.toLowerCase(), locationType)
                .first();
            if (result) {
                this.logger.debug(`Cache hit for ${searchTerm}: ${result.iata_code}`);
                return result.iata_code;
            }
        }
        catch (error) {
            this.logger.warn(`Cache lookup failed: ${error}`);
        }
        return null;
    }
    /**
     * Store location code in D1 cache
     */
    async cacheLocation(searchTerm, iataCode, locationType, locationName, countryCode) {
        if (!this.db)
            return;
        try {
            await this.db
                .prepare(`
          INSERT OR REPLACE INTO location_cache
          (search_term, iata_code, location_type, location_name, country_code, cached_at)
          VALUES (?, ?, ?, ?, ?, unixepoch())
        `)
                .bind(searchTerm.toLowerCase(), iataCode, locationType, locationName || null, countryCode || null)
                .run();
            this.logger.debug(`Cached location: ${searchTerm} -> ${iataCode}`);
        }
        catch (error) {
            this.logger.warn(`Cache store failed: ${error}`);
        }
    }
    /**
     * Get city code with caching - checks D1 cache first, then Amadeus API
     */
    async getCityCode(cityName) {
        const searchTerm = cityName.toLowerCase().trim();
        // Check cache first
        const cached = await this.getCachedLocation(searchTerm, 'CITY');
        if (cached)
            return cached;
        // Search Amadeus API
        const result = await this.searchLocation(cityName, 'CITY');
        if (result) {
            await this.cacheLocation(searchTerm, result.iataCode, 'CITY', result.name, result.address?.countryCode);
            return result.iataCode;
        }
        // Fallback: try airport search (some locations only have airport codes)
        const airportResult = await this.searchLocation(cityName, 'AIRPORT');
        if (airportResult) {
            await this.cacheLocation(searchTerm, airportResult.iataCode, 'CITY', airportResult.name, airportResult.address?.countryCode);
            return airportResult.iataCode;
        }
        // Last resort: return first 3 letters uppercase
        this.logger.warn(`No city code found for ${cityName}, using fallback`);
        return searchTerm.substring(0, 3).toUpperCase();
    }
    /**
     * Get airport code with caching - checks D1 cache first, then Amadeus API
     */
    async getAirportCode(cityName) {
        const searchTerm = cityName.toLowerCase().trim();
        // Check cache first
        const cached = await this.getCachedLocation(searchTerm, 'AIRPORT');
        if (cached)
            return cached;
        // Search Amadeus API for airports
        const result = await this.searchLocation(cityName, 'AIRPORT');
        if (result) {
            await this.cacheLocation(searchTerm, result.iataCode, 'AIRPORT', result.name, result.address?.countryCode);
            return result.iataCode;
        }
        // Fallback: try city search (might return a city with airport)
        const cityResult = await this.searchLocation(cityName, 'CITY');
        if (cityResult) {
            await this.cacheLocation(searchTerm, cityResult.iataCode, 'AIRPORT', cityResult.name, cityResult.address?.countryCode);
            return cityResult.iataCode;
        }
        // Last resort fallback
        this.logger.warn(`No airport code found for ${cityName}, using JFK fallback`);
        return 'JFK';
    }
}
/**
 * Create Amadeus client
 */
export function createAmadeusClient(env, logger) {
    if (!env.AMADEUS_API_KEY || !env.AMADEUS_API_SECRET) {
        throw new Error('Amadeus API credentials not configured');
    }
    return new AmadeusClient(env.AMADEUS_API_KEY, env.AMADEUS_API_SECRET, logger, env.DB);
}
