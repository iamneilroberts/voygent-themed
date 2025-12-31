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

interface ViatorDestinationResult {
  destinationId: number;
  destinationName: string;
  destinationType: string;
  parentId?: number;
}

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
  private db: D1Database | null = null;

  constructor(
    private apiKey: string,
    private logger: Logger,
    db?: D1Database
  ) {
    this.db = db || null;
  }

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

      // Note: tags require integer IDs, not string names
      // Skip tags filtering for now - search by destination only
      // TODO: Look up tag IDs from /taxonomy/tags endpoint if needed

      const response = await fetch(`${this.baseUrl}/products/search`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json;version=2.0',
          'Accept-Language': 'en-US',
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
          'Accept': 'application/json;version=2.0',
          'Accept-Language': 'en-US',
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
   * Get destination ID from city name using cache-first pattern
   * 1. Check viator_destination_cache table
   * 2. If miss, call Viator /search/freetext API
   * 3. Cache result for future use
   */
  async getDestinationId(cityName: string): Promise<string> {
    const searchTerm = cityName.toLowerCase().trim();

    // Check cache first
    const cached = await this.getCachedDestination(searchTerm);
    if (cached) {
      this.logger.debug(`Viator cache hit for "${cityName}": ${cached}`);
      return cached;
    }

    // Search Viator API
    const result = await this.searchDestinationByName(cityName);
    if (result) {
      // Cache the result
      await this.cacheDestination(
        searchTerm,
        String(result.destinationId),
        result.destinationName,
        result.destinationType,
        result.parentId ? String(result.parentId) : null
      );
      this.logger.info(`Viator destination found for "${cityName}": ${result.destinationId} (${result.destinationName})`);
      return String(result.destinationId);
    }

    // Fallback: try extracting city name from complex destination
    // e.g., "Castletownbere & Beara Peninsula" -> try "Beara" or parent region
    const simplifiedName = this.extractCityFromDestination(cityName);
    if (simplifiedName !== cityName) {
      const simplifiedResult = await this.searchDestinationByName(simplifiedName);
      if (simplifiedResult) {
        await this.cacheDestination(
          searchTerm,
          String(simplifiedResult.destinationId),
          simplifiedResult.destinationName,
          simplifiedResult.destinationType,
          simplifiedResult.parentId ? String(simplifiedResult.parentId) : null
        );
        this.logger.info(`Viator destination found via simplified "${simplifiedName}": ${simplifiedResult.destinationId}`);
        return String(simplifiedResult.destinationId);
      }
    }

    this.logger.warn(`No Viator destination found for "${cityName}", using fallback`);
    return '684';  // Cork as last resort fallback
  }

  /**
   * Search Viator for destination by name using freetext API
   */
  private async searchDestinationByName(name: string): Promise<ViatorDestinationResult | null> {
    try {
      this.logger.debug(`Searching Viator destinations for: ${name}`);

      const response = await fetch(`${this.baseUrl}/search/freetext`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json;version=2.0',
          'Accept-Language': 'en-US',
          'Content-Type': 'application/json',
          'exp-api-key': this.apiKey,
        },
        body: JSON.stringify({
          searchTerm: name,
          searchTypes: [{
            searchType: 'DESTINATIONS',
            pagination: { start: 1, count: 10 }
          }],
          currency: 'USD',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.warn(`Viator destination search failed: ${response.status} - ${errorText}`);
        return null;
      }

      const data = await response.json() as any;
      this.logger.debug(`Viator freetext response: ${JSON.stringify(data).slice(0, 500)}`);

      // Response structure: { destinations: { results: [...], totalCount: N } }
      const destinationsData = data.destinations;
      const destinations = destinationsData?.results || destinationsData || [];

      if (!Array.isArray(destinations) || destinations.length === 0) {
        this.logger.debug(`No Viator destinations found for "${name}"`);
        return null;
      }

      // Return the first/best match - field names may vary
      const dest = destinations[0];
      const destId = dest.destinationId || dest.ref || dest.id;
      const destName = dest.destinationName || dest.name || dest.title;

      if (!destId) {
        this.logger.debug(`Viator destination missing ID: ${JSON.stringify(dest)}`);
        return null;
      }

      return {
        destinationId: destId,
        destinationName: destName,
        destinationType: dest.destinationType || dest.type || 'CITY',
        parentId: dest.parentId || dest.parent,
      };
    } catch (error) {
      this.logger.error(`Viator destination search error: ${error}`);
      return null;
    }
  }

  /**
   * Get cached destination ID from database
   */
  private async getCachedDestination(searchTerm: string): Promise<string | null> {
    if (!this.db) return null;

    try {
      const result = await this.db
        .prepare('SELECT destination_id FROM viator_destination_cache WHERE search_term = ?')
        .bind(searchTerm.toLowerCase())
        .first<{ destination_id: string }>();

      return result?.destination_id || null;
    } catch (error) {
      this.logger.debug(`Viator cache lookup error: ${error}`);
      return null;
    }
  }

  /**
   * Cache destination ID in database
   */
  private async cacheDestination(
    searchTerm: string,
    destinationId: string,
    destinationName: string | null,
    destinationType: string | null,
    parentId: string | null
  ): Promise<void> {
    if (!this.db) return;

    try {
      await this.db
        .prepare(`
          INSERT OR REPLACE INTO viator_destination_cache
          (search_term, destination_id, destination_name, destination_type, parent_id, cached_at)
          VALUES (?, ?, ?, ?, ?, unixepoch())
        `)
        .bind(searchTerm.toLowerCase(), destinationId, destinationName, destinationType, parentId)
        .run();

      this.logger.debug(`Cached Viator destination: ${searchTerm} -> ${destinationId}`);
    } catch (error) {
      this.logger.warn(`Failed to cache Viator destination: ${error}`);
    }
  }

  /**
   * Extract simpler city name from complex destination string
   * e.g., "Castletownbere & Beara Peninsula" -> "Beara"
   * e.g., "Cork City" -> "Cork"
   */
  private extractCityFromDestination(destination: string): string {
    // Remove common suffixes
    let simplified = destination
      .replace(/\s*(City|Town|Village|Peninsula|Region|County|Area)$/i, '')
      .trim();

    // If contains "&" or ",", try the last part (often more specific)
    if (simplified.includes('&')) {
      const parts = simplified.split('&').map(p => p.trim());
      simplified = parts[parts.length - 1];
    } else if (simplified.includes(',')) {
      const parts = simplified.split(',').map(p => p.trim());
      simplified = parts[0];  // First part is usually the city
    }

    return simplified;
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
export function createViatorClient(env: Env, logger: Logger, db?: D1Database): ViatorClient {
  if (!env.VIATOR_API_KEY) {
    throw new Error('Viator API key not configured');
  }

  return new ViatorClient(env.VIATOR_API_KEY, logger, db);
}
