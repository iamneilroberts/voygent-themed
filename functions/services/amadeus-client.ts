/**
 * Amadeus API Client
 * VoyGent V3 - Phase 2 Trip Building
 *
 * Integrates with Amadeus API for flights and hotels.
 * Used during Phase 2 to search for real booking options.
 */

import { Env } from '../lib/db';
import { Logger } from '../lib/logger';
import { CostTracker, API_CALL_COSTS } from '../lib/cost-tracker';

export interface FlightSearchRequest {
  originLocationCode: string;  // e.g., "JFK"
  destinationLocationCode: string;  // e.g., "ORK"
  departureDate: string;  // YYYY-MM-DD
  returnDate?: string;  // YYYY-MM-DD (for round-trip)
  adults: number;
  travelClass?: 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';
  max?: number;  // Max results
}

export interface FlightOffer {
  id: string;
  price: {
    total: string;
    currency: string;
  };
  itineraries: Array<{
    duration: string;
    segments: Array<{
      departure: {
        iataCode: string;
        at: string;
      };
      arrival: {
        iataCode: string;
        at: string;
      };
      carrierCode: string;
      number: string;
      aircraft?: {
        code: string;
      };
    }>;
  }>;
  validatingAirlineCodes: string[];
}

export interface HotelSearchRequest {
  cityCode: string;  // e.g., "NYC"
  checkInDate: string;  // YYYY-MM-DD
  checkOutDate: string;  // YYYY-MM-DD
  adults: number;
  radius?: number;  // Search radius in km
  radiusUnit?: 'KM' | 'MILE';
  ratings?: string[];  // e.g., ["3", "4", "5"]
  amenities?: string[];
}

export interface HotelOffer {
  hotel: {
    hotelId: string;
    name: string;
    rating?: string;
    cityCode: string;
  };
  offers: Array<{
    id: string;
    checkInDate: string;
    checkOutDate: string;
    price: {
      total: string;
      currency: string;
    };
    room: {
      type: string;
      typeEstimated?: {
        category: string;
        beds: number;
        bedType: string;
      };
    };
  }>;
}

/**
 * Amadeus API Client
 */
export class AmadeusClient {
  private baseUrl = 'https://test.api.amadeus.com';  // Use test API for development
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(
    private apiKey: string,
    private apiSecret: string,
    private logger: Logger
  ) {}

  /**
   * Get OAuth2 access token
   */
  private async getAccessToken(): Promise<string> {
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

      const data = await response.json() as any;
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Expire 1 minute early

      this.logger.debug('Amadeus access token obtained');
      return this.accessToken;
    } catch (error) {
      this.logger.error(`Amadeus authentication failed: ${error}`);
      throw error;
    }
  }

  /**
   * Search for flights
   */
  async searchFlights(request: FlightSearchRequest, costTracker?: CostTracker): Promise<FlightOffer[]> {
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

      const response = await fetch(
        `${this.baseUrl}/v2/shopping/flight-offers?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Amadeus flight search failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;

      // Track cost
      if (costTracker) {
        await costTracker.trackAPICost('Amadeus', 'Flight Offers Search', API_CALL_COSTS.Amadeus['Flight Offers Search']);
      }

      this.logger.info(`Found ${data.data?.length || 0} flight offers`);
      return data.data || [];
    } catch (error) {
      this.logger.error(`Amadeus flight search failed: ${error}`);
      throw error;
    }
  }

  /**
   * Search for hotels
   */
  async searchHotels(request: HotelSearchRequest, costTracker?: CostTracker): Promise<HotelOffer[]> {
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

      const response = await fetch(
        `${this.baseUrl}/v3/shopping/hotel-offers?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Amadeus hotel search failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;

      // Track cost
      if (costTracker) {
        await costTracker.trackAPICost('Amadeus', 'Hotel Search', API_CALL_COSTS.Amadeus['Hotel Search']);
      }

      this.logger.info(`Found ${data.data?.length || 0} hotel offers`);
      return data.data || [];
    } catch (error) {
      this.logger.error(`Amadeus hotel search failed: ${error}`);
      throw error;
    }
  }

  /**
   * Helper: Convert city name to IATA city code
   * This is a simplified version - in production, use Amadeus Location API
   */
  getCityCode(cityName: string): string {
    const cityCodeMap: Record<string, string> = {
      'cork': 'ORK',
      'dublin': 'DUB',
      'galway': 'GWY',
      'kinsale': 'ORK',  // Use Cork airport
      'killarney': 'KIR',
      'new york': 'NYC',
      'london': 'LON',
      'paris': 'PAR',
      'rome': 'ROM',
      'barcelona': 'BCN',
      // Add more as needed
    };

    const normalized = cityName.toLowerCase().trim();
    return cityCodeMap[normalized] || 'NYC';  // Default to NYC if not found
  }

  /**
   * Helper: Get airport code from city
   */
  getAirportCode(cityName: string): string {
    const airportCodeMap: Record<string, string> = {
      'cork': 'ORK',
      'dublin': 'DUB',
      'galway': 'SNN',  // Shannon is closest
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
export function createAmadeusClient(env: Env, logger: Logger): AmadeusClient {
  if (!env.AMADEUS_API_KEY || !env.AMADEUS_API_SECRET) {
    throw new Error('Amadeus API credentials not configured');
  }

  return new AmadeusClient(env.AMADEUS_API_KEY, env.AMADEUS_API_SECRET, logger);
}
