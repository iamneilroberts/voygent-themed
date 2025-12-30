/**
 * Cost Calculator Utility for VoyGent V3 E2E Tests
 *
 * Tracks API costs across test runs for informational reporting.
 * Per clarification #4: Cost tracking is informational only - tests NEVER fail based on cost thresholds.
 *
 * Cost estimates are based on typical API pricing as of 2025:
 * - Amadeus: $0.001 per flight search, $0.001 per hotel search
 * - Viator: $0.000 (free tier for partners)
 * - Serper: $0.001 per search (free tier: 2,500 searches/month)
 * - Tavily: $0.001 per search
 * - Z.AI: Variable pricing (~$0.10-0.30 per trip depending on model)
 * - OpenRouter: Variable pricing (~$0.10-0.30 per trip depending on model)
 */

export interface ApiCost {
  provider: 'amadeus' | 'viator' | 'serper' | 'tavily' | 'zai' | 'openrouter';
  operation: string;
  cost: number; // USD
  timestamp: Date;
  testId?: string;
}

export interface CostSummary {
  totalCost: number;
  costByProvider: Record<string, number>;
  costByTest: Record<string, number>;
  avgCostPerTrip: number;
  totalApiCalls: number;
}

/**
 * Cost estimation rates (USD)
 */
export const COST_RATES = {
  // Amadeus API
  amadeus: {
    flightSearch: 0.001,
    hotelSearch: 0.001,
    airportSearch: 0.0005,
  },

  // Viator API
  viator: {
    searchActivities: 0.0, // Free tier for partners
    getActivity: 0.0,
  },

  // Serper API
  serper: {
    search: 0.001,
  },

  // Tavily API
  tavily: {
    search: 0.001,
  },

  // Z.AI API (estimated)
  zai: {
    destinationResearch: 0.15, // ~150 tokens * $0.001/token
    tripBuilding: 0.25, // ~250 tokens * $0.001/token
  },

  // OpenRouter API (estimated, varies by model)
  openrouter: {
    destinationResearch: 0.12, // claude-3-sonnet estimated
    tripBuilding: 0.20, // claude-3-sonnet estimated
  },
} as const;

/**
 * Cost Calculator class
 * Tracks API costs throughout test execution
 */
export class CostCalculator {
  private costs: ApiCost[] = [];
  private tripCount: number = 0;

  /**
   * Record an API call cost
   */
  recordCost(
    provider: ApiCost['provider'],
    operation: string,
    cost: number,
    testId?: string
  ): void {
    this.costs.push({
      provider,
      operation,
      cost,
      timestamp: new Date(),
      testId,
    });
  }

  /**
   * Record a trip creation (for calculating avg cost per trip)
   */
  recordTrip(): void {
    this.tripCount++;
  }

  /**
   * Get total cost across all API calls
   */
  getTotalCost(): number {
    return this.costs.reduce((sum, cost) => sum + cost.cost, 0);
  }

  /**
   * Get cost breakdown by provider
   */
  getCostByProvider(): Record<string, number> {
    const byProvider: Record<string, number> = {};

    this.costs.forEach(cost => {
      if (!byProvider[cost.provider]) {
        byProvider[cost.provider] = 0;
      }
      byProvider[cost.provider] += cost.cost;
    });

    return byProvider;
  }

  /**
   * Get cost breakdown by test
   */
  getCostByTest(): Record<string, number> {
    const byTest: Record<string, number> = {};

    this.costs.forEach(cost => {
      if (cost.testId) {
        if (!byTest[cost.testId]) {
          byTest[cost.testId] = 0;
        }
        byTest[cost.testId] += cost.cost;
      }
    });

    return byTest;
  }

  /**
   * Get average cost per trip
   */
  getAvgCostPerTrip(): number {
    if (this.tripCount === 0) return 0;
    return this.getTotalCost() / this.tripCount;
  }

  /**
   * Get total number of API calls
   */
  getTotalApiCalls(): number {
    return this.costs.length;
  }

  /**
   * Get comprehensive cost summary
   */
  getSummary(): CostSummary {
    return {
      totalCost: this.getTotalCost(),
      costByProvider: this.getCostByProvider(),
      costByTest: this.getCostByTest(),
      avgCostPerTrip: this.getAvgCostPerTrip(),
      totalApiCalls: this.getTotalApiCalls(),
    };
  }

  /**
   * Reset all cost tracking
   */
  reset(): void {
    this.costs = [];
    this.tripCount = 0;
  }

  /**
   * Export costs to JSON for reporting
   */
  toJSON(): object {
    return {
      summary: this.getSummary(),
      details: this.costs,
      tripCount: this.tripCount,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Check if cost exceeds informational threshold
   * NOTE: This is for logging purposes only - tests never fail based on cost
   */
  exceedsThreshold(threshold: number): boolean {
    return this.getAvgCostPerTrip() > threshold;
  }

  /**
   * Log cost summary to console
   */
  logSummary(): void {
    const summary = this.getSummary();

    console.log('\n💰 Cost Summary (Informational Only)');
    console.log('=====================================');
    console.log(`Total Cost: $${summary.totalCost.toFixed(4)} USD`);
    console.log(`Total API Calls: ${summary.totalApiCalls}`);
    console.log(`Trips Created: ${this.tripCount}`);
    console.log(`Avg Cost/Trip: $${summary.avgCostPerTrip.toFixed(4)} USD`);
    console.log('\nCost by Provider:');

    Object.entries(summary.costByProvider)
      .sort(([, a], [, b]) => b - a)
      .forEach(([provider, cost]) => {
        console.log(`  ${provider}: $${cost.toFixed(4)} USD`);
      });

    // Informational warning if exceeds target (does not fail tests)
    const TARGET_COST_PER_TRIP = 0.50; // From success criteria SC-012
    if (this.exceedsThreshold(TARGET_COST_PER_TRIP)) {
      console.log(`\n⚠️  INFO: Average cost per trip ($${summary.avgCostPerTrip.toFixed(4)}) exceeds target of $${TARGET_COST_PER_TRIP}`);
      console.log('   This is informational only and does not affect test results.');
    } else {
      console.log(`\n✅ Average cost per trip is within target (<$${TARGET_COST_PER_TRIP})`);
    }

    console.log('');
  }
}

/**
 * Global cost calculator instance
 * Can be imported and used across tests
 */
export const globalCostCalculator = new CostCalculator();

/**
 * Helper function to estimate trip cost based on typical API usage
 * This is a rough estimate - actual costs depend on:
 * - Number of destinations researched
 * - Number of trip options generated
 * - AI model used
 * - Search complexity
 */
export function estimateTripCost(): number {
  // Typical trip uses:
  // - 1 destination research (AI + web search)
  // - 1 trip building (AI + flights + hotels + activities)

  const aiCost = COST_RATES.zai.destinationResearch + COST_RATES.zai.tripBuilding; // ~$0.40
  const searchCost = COST_RATES.serper.search * 3; // 3 searches ~$0.003
  const amadeusFlights = COST_RATES.amadeus.flightSearch * 2; // 2 flight searches ~$0.002
  const amadeusHotels = COST_RATES.amadeus.hotelSearch * 2; // 2 hotel searches ~$0.002
  const viatorActivities = 0; // Free tier

  return aiCost + searchCost + amadeusFlights + amadeusHotels + viatorActivities;
}
