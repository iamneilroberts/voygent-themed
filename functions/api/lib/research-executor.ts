// Research execution orchestrator for themed trip generation

import { interpolateResearchQuery } from './research-utils';
import * as serper from './serper';
import * as tavily from './tavily';
import { selectProvider, callProvider } from './provider';
import type { TripTemplate } from './trip-templates';

export interface ResearchStep {
  step: string;
  query: string;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  analysis: string;
  timestamp: number;
}

/**
 * Executes theme-specific research for a trip
 * Returns array of research steps (typically 1 step per trip)
 */
export async function executeResearch(
  template: TripTemplate,
  intakeJson: any,
  env: any
): Promise<ResearchStep[]> {
  // Skip research if template doesn't define it
  if (!template.researchQueryTemplate || !template.researchSynthesisPrompt) {
    console.log('[Research] Skipping - no research config in template');
    return [];
  }

  const researchSteps: ResearchStep[] = [];

  try {
    console.log(`[Research] Starting for theme: ${template.id}`);

    // Step 1: Interpolate query template
    const query = interpolateResearchQuery(template.researchQueryTemplate, intakeJson);
    console.log(`[Research] Query: ${query}`);

    if (!query || query.includes('{')) {
      // Query still has unreplaced placeholders or is empty
      console.warn('[Research] Query interpolation incomplete, skipping research');
      return [];
    }

    // Step 2: Execute web search (try Serper first, fallback to Tavily)
    let searchResults;
    try {
      searchResults = await serper.webSearch(env, { q: query, max_results: 5 });
      console.log(`[Research] Serper returned ${searchResults.results.length} results`);
    } catch (serperError) {
      console.warn('[Research] Serper failed, trying Tavily:', serperError);
      try {
        searchResults = await tavily.webSearch(env, { q: query, max_results: 5 });
        console.log(`[Research] Tavily returned ${searchResults.results.length} results`);
      } catch (tavilyError) {
        console.error('[Research] Both search providers failed:', tavilyError);
        // Return empty research rather than failing the entire trip
        return [];
      }
    }

    // Extract top 3-5 results
    const topResults = searchResults.results.slice(0, 5);

    if (topResults.length === 0) {
      console.warn('[Research] No search results found');
      return [];
    }

    // Step 3: Format results for AI synthesis
    const formattedResults = topResults
      .map((result, idx) =>
        `${idx + 1}. ${result.title}\n   URL: ${result.url}\n   ${result.snippet}`
      )
      .join('\n\n');

    const synthesisPrompt = `${template.researchSynthesisPrompt}\n\nWeb search results:\n${formattedResults}\n\nProvide your analysis:`;

    // Step 4: Call AI for synthesis (cheap model)
    const providerConfig = selectProvider(500, env, 'cheap'); // Force cheap for research
    const synthesisResponse = await callProvider(providerConfig, {
      systemPrompt: 'You are a travel research assistant analyzing web search results to provide insights for trip planning.',
      userPrompt: synthesisPrompt,
      maxTokens: 1000,
      temperature: 0.7
    });

    console.log(`[Research] Synthesis completed, analysis length: ${synthesisResponse.content.length} chars`);

    // Step 5: Format research step
    const researchStep: ResearchStep = {
      step: `${template.id}_research`,
      query,
      results: topResults,
      analysis: synthesisResponse.content,
      timestamp: Date.now()
    };

    researchSteps.push(researchStep);
    console.log('[Research] Successfully completed 1 research step');

    return researchSteps;

  } catch (error) {
    console.error('[Research] Failed:', error instanceof Error ? error.message : error);
    // Return empty array on failure - graceful degradation
    return [];
  }
}
