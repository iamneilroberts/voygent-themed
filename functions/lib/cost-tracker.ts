/**
 * Cost Tracker
 * VoyGent V3 - API Cost Optimization
 *
 * Tracks AI provider costs and booking API costs to enforce <$0.50/trip target.
 * Implements Constitution principle V: API Cost Optimization.
 */

import { DatabaseClient } from './db';
import { Logger } from './logger';

export interface CostBreakdown {
  aiCostUsd: number;
  apiCostUsd: number;
  totalCostUsd: number;
}

export interface AIProviderCost {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface APICallCost {
  api: string;
  endpoint: string;
  costUsd: number;
}

/**
 * Cost Tracker Class
 */
export class CostTracker {
  private aiCosts: AIProviderCost[] = [];
  private apiCosts: APICallCost[] = [];

  constructor(
    private db: DatabaseClient,
    private logger: Logger,
    private tripId: string
  ) {}

  /**
   * Track AI provider cost
   *
   * @param provider - 'Z.AI', 'OpenRouter', etc.
   * @param model - Model name
   * @param inputTokens - Number of input tokens
   * @param outputTokens - Number of output tokens
   * @param costPer1kInputTokens - Cost per 1000 input tokens in USD
   * @param costPer1kOutputTokens - Cost per 1000 output tokens in USD
   */
  async trackAICost(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    costPer1kInputTokens: number,
    costPer1kOutputTokens: number
  ): Promise<number> {
    const inputCost = (inputTokens / 1000) * costPer1kInputTokens;
    const outputCost = (outputTokens / 1000) * costPer1kOutputTokens;
    const totalCost = inputCost + outputCost;

    const cost: AIProviderCost = {
      provider,
      model,
      inputTokens,
      outputTokens,
      costUsd: totalCost,
    };

    this.aiCosts.push(cost);

    // Update database
    await this.db.updateCosts(this.tripId, totalCost, 0);

    // Log telemetry
    await this.logger.logTelemetry(this.db, this.tripId, 'ai_call', {
      provider,
      model,
      tokens: inputTokens + outputTokens,
      cost: totalCost,
      details: { inputTokens, outputTokens },
    });

    this.logger.debug(
      `AI cost tracked: ${provider}/${model} - ${inputTokens + outputTokens} tokens = $${totalCost.toFixed(4)}`
    );

    return totalCost;
  }

  /**
   * Track booking API call cost
   *
   * @param api - 'Amadeus', 'Viator', etc.
   * @param endpoint - Endpoint called
   * @param costUsd - Estimated cost in USD
   */
  async trackAPICost(api: string, endpoint: string, costUsd: number): Promise<void> {
    const cost: APICallCost = {
      api,
      endpoint,
      costUsd,
    };

    this.apiCosts.push(cost);

    // Update database
    await this.db.updateCosts(this.tripId, 0, costUsd);

    // Log telemetry
    await this.logger.logTelemetry(this.db, this.tripId, 'api_call', {
      provider: api,
      cost: costUsd,
      details: { endpoint },
    });

    this.logger.debug(`API cost tracked: ${api} ${endpoint} = $${costUsd.toFixed(4)}`);
  }

  /**
   * Get current cost breakdown
   */
  getCostBreakdown(): CostBreakdown {
    const aiCostUsd = this.aiCosts.reduce((sum, cost) => sum + cost.costUsd, 0);
    const apiCostUsd = this.apiCosts.reduce((sum, cost) => sum + cost.costUsd, 0);

    return {
      aiCostUsd,
      apiCostUsd,
      totalCostUsd: aiCostUsd + apiCostUsd,
    };
  }

  /**
   * Check if cost exceeds target threshold
   */
  exceedsTarget(targetUsd: number = 0.5): boolean {
    const breakdown = this.getCostBreakdown();
    return breakdown.totalCostUsd > targetUsd;
  }

  /**
   * Get detailed cost report
   */
  getDetailedReport(): {
    aiCosts: AIProviderCost[];
    apiCosts: APICallCost[];
    breakdown: CostBreakdown;
    exceedsTarget: boolean;
  } {
    return {
      aiCosts: this.aiCosts,
      apiCosts: this.apiCosts,
      breakdown: this.getCostBreakdown(),
      exceedsTarget: this.exceedsTarget(),
    };
  }
}

/**
 * Create cost tracker instance
 */
export function createCostTracker(
  db: DatabaseClient,
  logger: Logger,
  tripId: string
): CostTracker {
  return new CostTracker(db, logger, tripId);
}

/**
 * AI Provider Cost Reference (per 1000 tokens)
 * Source: Provider pricing pages (as of 2025-01)
 */
export const AI_PROVIDER_COSTS = {
  'Z.AI': {
    'llama-3.3-70b': {
      input: 0.00006,  // $0.00006 per 1k input tokens
      output: 0.00006, // $0.00006 per 1k output tokens
    },
  },
  'OpenRouter': {
    'anthropic/claude-3-haiku': {
      input: 0.00025,
      output: 0.00125,
    },
    'meta-llama/llama-3.1-70b-instruct': {
      input: 0.00018,
      output: 0.00018,
    },
  },
  'OpenAI': {
    'gpt-3.5-turbo': {
      input: 0.0005,
      output: 0.0015,
    },
    'gpt-4o-mini': {
      input: 0.00015,
      output: 0.0006,
    },
  },
};

/**
 * Booking API Cost Estimates (per call)
 * These are rough estimates since most APIs don't charge per call
 */
export const API_CALL_COSTS = {
  Amadeus: {
    'Flight Offers Search': 0.001,  // Estimate
    'Hotel Search': 0.001,
  },
  Viator: {
    'Search Products': 0.0005,  // Estimate
    'Product Details': 0.0005,
  },
  Serper: {
    'Search': 0.002,  // $2 per 1000 queries = $0.002 per query
  },
  Tavily: {
    'Search': 0.001,  // Estimate
  },
  Firecrawl: {
    'Scrape': 0.01,  // ~$0.01 per page scrape
    'Search': 0.01,  // ~$0.01 per search query
  },
};
