/**
 * Amadeus API Client
 * VoyGent V3 - Phase 2 Trip Building
 *
 * Integrates with Amadeus API for flights and hotels.
 * Used during Phase 2 to search for real booking options.
 */
import { API_CALL_COSTS } from '../lib/cost-tracker';
/**
 * Amadeus API Client
 */
export class AmadeusClient {
    apiKey;
    apiSecret;
    logger;
    baseUrl = 'https://test.api.amadeus.com'; // Use test API for development
    accessToken = null;
    tokenExpiry = 0;
    constructor(apiKey, apiSecret, logger) {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.logger = logger;
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
     * Helper: Convert city name to IATA city code
     * This is a simplified version - in production, use Amadeus Location API
     */
    getCityCode(cityName) {
        const cityCodeMap = {
            'cork': 'ORK',
            'dublin': 'DUB',
            'galway': 'GWY',
            'kinsale': 'ORK', // Use Cork airport
            'killarney': 'KIR',
            'new york': 'NYC',
            'london': 'LON',
            'paris': 'PAR',
            'rome': 'ROM',
            'barcelona': 'BCN',
            // Add more as needed
        };
        const normalized = cityName.toLowerCase().trim();
        return cityCodeMap[normalized] || 'NYC'; // Default to NYC if not found
    }
    /**
     * Helper: Get airport code from city
     */
    getAirportCode(cityName) {
        const airportCodeMap = {
            'cork': 'ORK',
            'dublin': 'DUB',
            'galway': 'SNN', // Shannon is closest
            'kinsale': 'ORK',
            'killarney': 'KIR',
            'new york': 'JFK',
            'london': 'LHR',
            'paris': 'CDG',
            'rome': 'FCO',
            'barcelona': 'BCN',
            // Add more as needed
        };
        const normalized = cityName.toLowerCase().trim();
        return airportCodeMap[normalized] || 'JFK';
    }
}
/**
 * Create Amadeus client
 */
export function createAmadeusClient(env, logger) {
    if (!env.AMADEUS_API_KEY || !env.AMADEUS_API_SECRET) {
        throw new Error('Amadeus API credentials not configured');
    }
    return new AmadeusClient(env.AMADEUS_API_KEY, env.AMADEUS_API_SECRET, logger);
}
