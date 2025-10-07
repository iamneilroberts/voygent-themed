/**
 * Mock web search implementations for testing
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Create mock Serper web search function
 */
export function mockSerperWebSearch(fixtures: Record<string, SearchResult[]>) {
  return async (env: any, params: { q: string; max_results?: number }): Promise<any> => {
    const results = fixtures[params.q] || fixtures['default'] || [];

    return {
      provider: 'serper',
      query: params.q,
      results: results.map(r => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet
      })),
      cached: false,
      search_date: new Date().toISOString()
    };
  };
}

/**
 * Create mock Tavily web search function
 */
export function mockTavilyWebSearch(fixtures: Record<string, SearchResult[]>) {
  return async (env: any, params: { q: string; max_results?: number }): Promise<any> => {
    const results = fixtures[params.q] || fixtures['default'] || [];

    return {
      provider: 'tavily',
      query: params.q,
      results: results.map(r => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet
      })),
      cached: false,
      search_date: new Date().toISOString()
    };
  };
}
