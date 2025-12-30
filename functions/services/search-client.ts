/**
 * Web Search Client
 * VoyGent V3 - Phase 1 Destination Research
 *
 * Integrates with Serper and Tavily APIs for web search.
 * Used during Phase 1 to research potential trip destinations.
 */

import { Env } from '../lib/db';
import { Logger } from '../lib/logger';
import { CostTracker, API_CALL_COSTS } from '../lib/cost-tracker';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  position?: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  provider: string;
  totalResults?: number;
}

/**
 * Search Provider Interface
 */
export interface SearchProvider {
  name: string;

  /**
   * Perform web search
   */
  search(query: string, numResults?: number): Promise<SearchResponse>;

  /**
   * Check if provider is available (has API key configured)
   */
  isAvailable(): boolean;
}

/**
 * Serper Provider
 */
export class SerperProvider implements SearchProvider {
  name = 'Serper';

  constructor(private apiKey: string, private logger: Logger) {}

  async search(query: string, numResults: number = 10): Promise<SearchResponse> {
    try {
      this.logger.debug(`Serper search: "${query}" (${numResults} results)`);

      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': this.apiKey,
        },
        body: JSON.stringify({
          q: query,
          num: numResults,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Serper API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;

      const results: SearchResult[] = (data.organic || []).map((item: any, index: number) => ({
        title: item.title || '',
        url: item.link || '',
        snippet: item.snippet || '',
        position: index + 1,
      }));

      this.logger.debug(`Serper returned ${results.length} results`);

      return {
        query,
        results,
        provider: this.name,
        totalResults: data.searchInformation?.totalResults,
      };
    } catch (error) {
      this.logger.error(`Serper search failed: ${error}`);
      throw error;
    }
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }
}

/**
 * Tavily Provider
 */
export class TavilyProvider implements SearchProvider {
  name = 'Tavily';

  constructor(private apiKey: string, private logger: Logger) {}

  async search(query: string, numResults: number = 10): Promise<SearchResponse> {
    try {
      this.logger.debug(`Tavily search: "${query}" (${numResults} results)`);

      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: this.apiKey,
          query,
          max_results: numResults,
          search_depth: 'basic',
          include_answer: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Tavily API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;

      const results: SearchResult[] = (data.results || []).map((item: any, index: number) => ({
        title: item.title || '',
        url: item.url || '',
        snippet: item.content || '',
        position: index + 1,
      }));

      this.logger.debug(`Tavily returned ${results.length} results`);

      return {
        query,
        results,
        provider: this.name,
        totalResults: results.length,
      };
    } catch (error) {
      this.logger.error(`Tavily search failed: ${error}`);
      throw error;
    }
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }
}

/**
 * Search Client with Provider Fallback
 */
export class SearchClient {
  private providers: SearchProvider[] = [];

  constructor(env: Env, private logger: Logger) {
    // Build provider chain
    if (env.SERPER_API_KEY) {
      this.providers.push(new SerperProvider(env.SERPER_API_KEY, logger));
    }
    if (env.TAVILY_API_KEY) {
      this.providers.push(new TavilyProvider(env.TAVILY_API_KEY, logger));
    }

    if (this.providers.length === 0) {
      logger.warn('No search providers configured! Add SERPER_API_KEY or TAVILY_API_KEY to environment.');
    } else {
      logger.info(`Search providers configured: ${this.providers.map(p => p.name).join(', ')}`);
    }
  }

  /**
   * Perform web search with automatic fallback
   */
  async search(query: string, numResults: number = 10, costTracker?: CostTracker): Promise<SearchResponse> {
    const errors: Error[] = [];

    for (const provider of this.providers) {
      if (!provider.isAvailable()) {
        this.logger.debug(`Skipping ${provider.name}: not available`);
        continue;
      }

      try {
        this.logger.info(`Attempting search with ${provider.name}...`);
        const response = await provider.search(query, numResults);

        // Track cost if tracker provided
        if (costTracker) {
          const providerCosts = API_CALL_COSTS[provider.name as keyof typeof API_CALL_COSTS];
          const cost = (providerCosts && 'Search' in providerCosts) ? (providerCosts as any).Search : 0.001;
          await costTracker.trackAPICost(provider.name, 'Search', cost);
        }

        this.logger.info(`✓ ${provider.name} succeeded - ${response.results.length} results`);
        return response;
      } catch (error) {
        this.logger.warn(`✗ ${provider.name} failed: ${error}`);
        errors.push(error as Error);
        // Continue to next provider
      }
    }

    // All providers failed
    const errorMsg = `All search providers failed: ${errors.map(e => e.message).join('; ')}`;
    this.logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  /**
   * Perform multiple searches in parallel
   */
  async searchMultiple(queries: string[], numResults: number = 10, costTracker?: CostTracker): Promise<SearchResponse[]> {
    this.logger.info(`Performing ${queries.length} searches in parallel...`);

    const searchPromises = queries.map(query => this.search(query, numResults, costTracker));
    const responses = await Promise.all(searchPromises);

    this.logger.info(`Completed ${responses.length} searches`);
    return responses;
  }

  /**
   * Get list of available providers
   */
  getAvailableProviders(): string[] {
    return this.providers.filter(p => p.isAvailable()).map(p => p.name);
  }
}

/**
 * Create search client
 */
export function createSearchClient(env: Env, logger: Logger): SearchClient {
  return new SearchClient(env, logger);
}
