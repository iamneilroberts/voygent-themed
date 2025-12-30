/**
 * Viator API Client
 * VoyGent V3 - Phase 2 Trip Building
 *
 * Integrates with Viator API for tours and activities.
 * Used during Phase 2 to search for experiences and guided tours.
 */

import { Env } from '../lib/db';
import { Logger } from '../lib/logger';
import { CostTracker, API_CALL_COSTS } from '../lib/cost-tracker';

export interface TourSearchRequest {
  destination: string;  // Destination name or ID
  startDate?: string;  // YYYY-MM-DD
  endDate?: string;  // YYYY-MM-DD
  categoryId?: string;  // Tour category
  tags?: string[];  // Tags like "heritage", "cultural", "food"
  currency?: string;
  count?: number;  // Max results
}

export interface TourProduct {
  productCode: string;
  title: string;
  description: string;
  duration: {
    fixedDurationInMinutes?: number;
    variableDurationFromMinutes?: number;
    variableDurationToMinutes?: number;
  };
  pricing: {
    summary: {
      fromPrice: number;
      fromPriceBeforeDiscount?: number;
    };
    currency: string;
  };
  rating: {
    average: number;
    count: number;
  };
  images: Array<{
    imageSource: string;
    caption?: string;
  }>;
  cancellationPolicy?: {
    type: string;
    description: string;
  };
  destinations: Array<{
    destinationId: number;
    destinationName: string;
  }>;
  categories: Array<{
    categoryId: number;
    categoryName: string;
  }>;
}

/**
 * Viator API Client
 */
export class ViatorClient {
  private baseUrl = 'https://api.viator.com/partner';

  constructor(
    private apiKey: string,
    private logger: Logger
  ) {}

  /**
   * Search for tours and activities
   */
  async searchTours(request: TourSearchRequest, costTracker?: CostTracker): Promise<TourProduct[]> {
    try {
      this.logger.info(`Searching tours in ${request.destination}`);

      // Build search request body
      const searchBody: any = {
        filtering: {
          destination: request.destination,
        },
        currency: request.currency || 'USD',
        pagination: {
          offset: 0,
          limit: request.count || 20,
        },
      };

      // Add date filtering if provided
      if (request.startDate || request.endDate) {
        searchBody.filtering.travelDate = {};
        if (request.startDate) {
          searchBody.filtering.travelDate.from = request.startDate;
        }
        if (request.endDate) {
          searchBody.filtering.travelDate.to = request.endDate;
        }
      }

      // Add tags/categories
      if (request.tags && request.tags.length > 0) {
        searchBody.filtering.tags = request.tags;
      }

      const response = await fetch(`${this.baseUrl}/products/search`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'exp-api-key': this.apiKey,
        },
        body: JSON.stringify(searchBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Viator search failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;

      // Track cost
      if (costTracker) {
        await costTracker.trackAPICost('Viator', 'Search Products', API_CALL_COSTS.Viator['Search Products']);
      }

      const products = data.products || [];
      this.logger.info(`Found ${products.length} tour products`);

      return products;
    } catch (error) {
      this.logger.error(`Viator tour search failed: ${error}`);
      throw error;
    }
  }

  /**
   * Get product details by product code
   */
  async getProductDetails(productCode: string, costTracker?: CostTracker): Promise<TourProduct> {
    try {
      this.logger.debug(`Fetching product details: ${productCode}`);

      const response = await fetch(`${this.baseUrl}/products/${productCode}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'exp-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Viator product details failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as TourProduct;

      // Track cost
      if (costTracker) {
        await costTracker.trackAPICost('Viator', 'Product Details', API_CALL_COSTS.Viator['Product Details']);
      }

      return data;
    } catch (error) {
      this.logger.error(`Viator product details failed: ${error}`);
      throw error;
    }
  }

  /**
   * Helper: Get destination ID from city name
   * This is simplified - in production, use Viator Destinations API
   */
  getDestinationId(cityName: string): string {
    const destinationMap: Record<string, string> = {
      'cork': '684',  // Cork, Ireland
      'dublin': '470',  // Dublin, Ireland
      'galway': '6033',  // Galway, Ireland
      'kinsale': '684',  // Use Cork
      'killarney': '6034',  // Killarney, Ireland
      'new york': '684',  // New York City
      'london': '684',  // London
      'paris': '479',  // Paris
      'rome': '684',  // Rome
      'barcelona': '684',  // Barcelona
      // Add more as needed
    };

    const normalized = cityName.toLowerCase().trim();
    return destinationMap[normalized] || '684';  // Default to Cork
  }

  /**
   * Helper: Get category tags for heritage/cultural tours
   */
  getHeritageTags(): string[] {
    return [
      'Cultural & Theme Tours',
      'Historical & Heritage Tours',
      'Walking & Biking Tours',
      'Private Tours',
      'Cultural Tours',
      'Historical Tours',
      'City Tours',
      'Private Sightseeing Tours',
    ];
  }

  /**
   * Helper: Format duration from minutes
   */
  formatDuration(minutes?: number): string {
    if (!minutes) return 'Duration varies';

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours === 0) {
      return `${mins} minutes`;
    } else if (mins === 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      return `${hours} hour${hours > 1 ? 's' : ''} ${mins} minutes`;
    }
  }
}

/**
 * Create Viator client
 */
export function createViatorClient(env: Env, logger: Logger): ViatorClient {
  if (!env.VIATOR_API_KEY) {
    throw new Error('Viator API key not configured');
  }

  return new ViatorClient(env.VIATOR_API_KEY, logger);
}
