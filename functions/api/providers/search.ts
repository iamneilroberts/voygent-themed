/**
 * Search Provider Endpoint
 * GET /api/providers/search
 * Feature: 001-web-search-integration
 *
 * Returns web search results with Serper.dev primary, Tavily fallback.
 * Results cached for 7 days.
 */

import * as serper from '../lib/serper';
import * as tavily from '../lib/tavily';

interface Env {
  DB: any;
  SERPER_API_KEY: string;
  SERPER_API_URL: string;
  TAVILY_API_KEY: string;
  TAVILY_API_URL: string;
}

export async function onRequest(context: { request: Request; env: Env }) {
  const { request, env } = context;

  // Only allow GET
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Parse query params
    const url = new URL(request.url);
    const q = url.searchParams.get('q');
    const city = url.searchParams.get('city') || undefined;
    const month = url.searchParams.get('month') || undefined;
    const max_results = parseInt(url.searchParams.get('max_results') || '10');

    // Validate required params
    if (!q) {
      return new Response(
        JSON.stringify({
          error: 'Missing required parameter',
          details: 'q (query) is required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate query length
    if (q.length < 3 || q.length > 200) {
      return new Response(
        JSON.stringify({
          error: 'Invalid query',
          details: 'Query must be 3-200 characters',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Try Serper.dev first
    let result;
    try {
      result = await serper.webSearch(env, { q, city, month, max_results });
    } catch (error) {
      console.error('Serper search failed:', error);

      // Fallback to Tavily
      try {
        result = await tavily.webSearch(env, { q, city, month, max_results });
      } catch (tavilyError) {
        console.error('Tavily search failed:', tavilyError);

        return new Response(
          JSON.stringify({
            error: 'Provider unavailable',
            details: 'Both Serper and Tavily APIs failed',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Search error:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
