/**
 * Firecrawl API Client
 * VoyGent V3 - Enhanced Research with Deep Content Extraction
 *
 * Integrates with Firecrawl API to scrape and extract content from web pages.
 * Used during Phase 1 to enrich search results with full page content.
 */

import { Env, DatabaseClient } from '../lib/db';
import { Logger } from '../lib/logger';
import { CostTracker } from '../lib/cost-tracker';

export interface FirecrawlTelemetryContext {
  db: DatabaseClient;
  tripId: string;
}

export interface ScrapeResult {
  url: string;
  markdown?: string;
  html?: string;
  metadata?: {
    title?: string;
    description?: string;
    language?: string;
    sourceURL?: string;
  };
  success: boolean;
  error?: string;
}

export interface SearchResult {
  url: string;
  title: string;
  description: string;
  markdown?: string;
}

export interface ScrapeOptions {
  formats?: ('markdown' | 'html')[];
  onlyMainContent?: boolean;
  waitFor?: number;
}

/**
 * Firecrawl API cost estimate (per scrape)
 * Firecrawl pricing: ~500 credits = $15, so roughly $0.03 per scrape
 * For our use case with onlyMainContent, estimate ~$0.01 per scrape
 */
const FIRECRAWL_COST_PER_SCRAPE = 0.01;

/**
 * Firecrawl API Client
 */
export class FirecrawlClient {
  private baseUrl = 'https://api.firecrawl.dev/v1';

  constructor(
    private apiKey: string,
    private logger: Logger
  ) {}

  /**
   * Scrape a single URL and extract content
   */
  async scrape(
    url: string,
    options: ScrapeOptions = {},
    costTracker?: CostTracker,
    telemetryCtx?: FirecrawlTelemetryContext
  ): Promise<ScrapeResult> {
    const startTime = Date.now();

    try {
      this.logger.debug(`Firecrawl scraping: ${url}`);

      const response = await fetch(`${this.baseUrl}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          url,
          formats: options.formats || ['markdown'],
          onlyMainContent: options.onlyMainContent ?? true,
          waitFor: options.waitFor,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Firecrawl API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;
      const elapsed = Date.now() - startTime;

      // Track cost
      if (costTracker) {
        await costTracker.trackAPICost('Firecrawl', 'Scrape', FIRECRAWL_COST_PER_SCRAPE);
      }

      this.logger.info(`Firecrawl scraped ${url} in ${elapsed}ms`);

      if (data.success && data.data) {
        const contentLength = data.data.markdown?.length || 0;

        // Log detailed telemetry for each scrape
        if (telemetryCtx) {
          await this.logger.logTelemetry(telemetryCtx.db, telemetryCtx.tripId, 'firecrawl_scrape', {
            provider: 'Firecrawl',
            duration_ms: elapsed,
            cost: FIRECRAWL_COST_PER_SCRAPE,
            details: {
              url,
              success: true,
              content_length: contentLength,
              title: data.data.metadata?.title || 'Unknown',
            },
          });
        }

        return {
          url,
          markdown: data.data.markdown,
          html: data.data.html,
          metadata: data.data.metadata,
          success: true,
        };
      }

      // Log failed scrape
      if (telemetryCtx) {
        await this.logger.logTelemetry(telemetryCtx.db, telemetryCtx.tripId, 'firecrawl_scrape', {
          provider: 'Firecrawl',
          duration_ms: elapsed,
          cost: FIRECRAWL_COST_PER_SCRAPE,
          details: {
            url,
            success: false,
            error: data.error || 'Unknown error',
          },
        });
      }

      return {
        url,
        success: false,
        error: data.error || 'Unknown error',
      };
    } catch (error) {
      const elapsed = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Firecrawl scrape failed for ${url} after ${elapsed}ms: ${error}`);

      // Log error telemetry
      if (telemetryCtx) {
        await this.logger.logTelemetry(telemetryCtx.db, telemetryCtx.tripId, 'firecrawl_scrape', {
          provider: 'Firecrawl',
          duration_ms: elapsed,
          cost: 0, // Don't charge for failed requests
          details: {
            url,
            success: false,
            error: errorMsg,
          },
        });
      }

      return {
        url,
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Scrape multiple URLs in parallel with concurrency limit
   */
  async scrapeMultiple(
    urls: string[],
    options: ScrapeOptions = {},
    costTracker?: CostTracker,
    concurrency: number = 3,
    telemetryCtx?: FirecrawlTelemetryContext
  ): Promise<ScrapeResult[]> {
    this.logger.info(`Firecrawl scraping ${urls.length} URLs (concurrency: ${concurrency})...`);

    const results: ScrapeResult[] = [];

    // Process in batches to respect concurrency
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(url => this.scrape(url, options, costTracker, telemetryCtx))
      );
      results.push(...batchResults);
    }

    const successCount = results.filter(r => r.success).length;
    this.logger.info(`Firecrawl completed: ${successCount}/${urls.length} successful`);

    return results;
  }

  /**
   * Search the web and return URLs with optional content
   * Uses Firecrawl's search endpoint
   */
  async search(
    query: string,
    options: { limit?: number; scrapeContent?: boolean } = {},
    costTracker?: CostTracker,
    telemetryCtx?: FirecrawlTelemetryContext
  ): Promise<SearchResult[]> {
    const startTime = Date.now();
    const limit = options.limit || 5;

    try {
      this.logger.debug(`Firecrawl searching: "${query}" (limit: ${limit})`);

      const response = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          query,
          limit,
          scrapeOptions: options.scrapeContent ? {
            formats: ['markdown'],
            onlyMainContent: true,
          } : undefined,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Firecrawl search API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;
      const elapsed = Date.now() - startTime;

      // Track cost - search is roughly same as scrape
      if (costTracker) {
        await costTracker.trackAPICost('Firecrawl', 'Search', FIRECRAWL_COST_PER_SCRAPE);
      }

      this.logger.info(`Firecrawl search completed in ${elapsed}ms: ${data.data?.length || 0} results`);

      // Log telemetry
      if (telemetryCtx) {
        await this.logger.logTelemetry(telemetryCtx.db, telemetryCtx.tripId, 'firecrawl_search', {
          provider: 'Firecrawl',
          duration_ms: elapsed,
          cost: FIRECRAWL_COST_PER_SCRAPE,
          details: {
            query,
            results_count: data.data?.length || 0,
          },
        });
      }

      if (data.success && data.data) {
        return data.data.map((item: any) => ({
          url: item.url,
          title: item.title || item.metadata?.title || '',
          description: item.description || item.metadata?.description || '',
          markdown: item.markdown,
        }));
      }

      return [];
    } catch (error) {
      const elapsed = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Firecrawl search failed after ${elapsed}ms: ${errorMsg}`);

      // Log error telemetry
      if (telemetryCtx) {
        await this.logger.logTelemetry(telemetryCtx.db, telemetryCtx.tripId, 'firecrawl_search', {
          provider: 'Firecrawl',
          duration_ms: elapsed,
          cost: 0,
          details: {
            query,
            success: false,
            error: errorMsg,
          },
        });
      }

      return [];
    }
  }

  /**
   * Find a booking URL for a hotel or tour
   * Searches for the item and returns the best matching URL
   */
  async findBookingUrl(
    itemName: string,
    city: string,
    type: 'hotel' | 'tour',
    costTracker?: CostTracker,
    telemetryCtx?: FirecrawlTelemetryContext
  ): Promise<string | null> {
    // Build search query based on type
    const searchSuffix = type === 'hotel'
      ? 'hotel booking official site'
      : 'tour booking viator tripadvisor';

    const query = `${itemName} ${city} ${searchSuffix}`;

    const results = await this.search(query, { limit: 3 }, costTracker, telemetryCtx);

    if (results.length === 0) {
      return null;
    }

    // Prioritize official hotel sites over booking aggregators
    const preferredDomains = type === 'hotel'
      ? [
          // Official hotel chains first
          'marriott.com', 'hilton.com', 'ihg.com', 'hyatt.com', 'accor.com',
          'fourseasons.com', 'ritzcarlton.com', 'starwoodhotels.com', 'wyndhamhotels.com',
          'choicehotels.com', 'bestwestern.com', 'radissonhotels.com',
          // Booking aggregators as fallback
          'booking.com', 'hotels.com', 'expedia.com',
        ]
      : ['viator.com', 'getyourguide.com', 'tripadvisor.com', 'klook.com'];

    // First try to find a result from preferred domains
    for (const result of results) {
      const domain = new URL(result.url).hostname.replace('www.', '');
      if (preferredDomains.some(pd => domain.includes(pd))) {
        return result.url;
      }
    }

    // Fall back to first result if no preferred domain found
    return results[0]?.url || null;
  }

  /**
   * Extract a summary/snippet from scraped markdown content
   * Limits content to first N characters to avoid overwhelming AI context
   */
  static extractSummary(markdown: string, maxLength: number = 2000): string {
    if (!markdown) return '';

    // Remove images and links markup but keep text
    let text = markdown
      .replace(/!\[.*?\]\(.*?\)/g, '')  // Remove images
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Keep link text, remove URL
      .replace(/#{1,6}\s*/g, '')  // Remove headers
      .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove bold
      .replace(/\*([^*]+)\*/g, '$1')  // Remove italic
      .replace(/`([^`]+)`/g, '$1')  // Remove code
      .replace(/\n{3,}/g, '\n\n')  // Collapse multiple newlines
      .trim();

    if (text.length > maxLength) {
      // Cut at word boundary
      text = text.substring(0, maxLength);
      const lastSpace = text.lastIndexOf(' ');
      if (lastSpace > maxLength * 0.8) {
        text = text.substring(0, lastSpace);
      }
      text += '...';
    }

    return text;
  }
}

/**
 * Create Firecrawl client (returns null if API key not configured)
 */
export function createFirecrawlClient(env: Env, logger: Logger): FirecrawlClient | null {
  if (!env.FIRECRAWL_API_KEY) {
    logger.debug('Firecrawl API key not configured, content enrichment disabled');
    return null;
  }

  return new FirecrawlClient(env.FIRECRAWL_API_KEY, logger);
}
