// POST /api/research - Do intake normalization and theme-specific research only
// Returns research results without generating trip options

import { selectProvider, callProvider } from '../lib/provider';
import { INTAKE_NORMALIZER } from '../lib/prompts';
import { validateIntake } from '../lib/schemas';
import { extractTextFromImage, isImageFile } from '../lib/ocr';
import { getTemplate } from '../lib/trip-templates';

interface Env {
  DB: D1Database;
  AI?: any;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  SERPER_API_KEY?: string;
  TAVILY_API_KEY?: string;
}

// Helper function to perform web search via Serper or Tavily
async function performWebSearch(
  provider: 'serper' | 'tavily',
  searchQuery: string,
  env: Env
): Promise<any> {
  if (provider === 'serper') {
    return await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': env.SERPER_API_KEY!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ q: searchQuery, num: 5 })
    }).then(r => r.json());
  } else {
    return await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: env.TAVILY_API_KEY,
        query: searchQuery,
        max_results: 5
      })
    }).then(r => r.json());
  }
}

// Helper function to extract search results text
function extractSearchResults(searchResult: any, provider: 'serper' | 'tavily'): string {
  if (provider === 'serper') {
    return searchResult.organic?.map((r: any) => `${r.title}: ${r.snippet}`).join('\n\n') || '';
  } else {
    return searchResult.results?.map((r: any) => `${r.title}: ${r.content}`).join('\n\n') || '';
  }
}

// Helper function to extract search result sources (URLs)
function extractSearchSources(searchResult: any, provider: 'serper' | 'tavily'): string[] {
  if (provider === 'serper') {
    return searchResult.organic?.slice(0, 3).map((r: any) => r.link) || [];
  } else {
    return searchResult.results?.slice(0, 3).map((r: any) => r.url) || [];
  }
}

// Helper function to get result count
function getResultCount(searchResult: any, provider: 'serper' | 'tavily'): number {
  if (provider === 'serper') {
    return searchResult.organic?.length || 0;
  } else {
    return searchResult.results?.length || 0;
  }
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  try {
    const formData = await request.formData();
    const theme = formData.get('theme') as string || 'heritage';
    const textInput = formData.get('text') as string || '';

    if (!textInput || textInput.trim().length === 0) {
      return new Response(JSON.stringify({
        error: 'No input provided'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[Research] Theme: ${theme}, Input length: ${textInput.length}`);

    // Step 1: Handle file uploads (OCR for images)
    const files = formData.getAll('files') as File[];
    const extractedTexts = [];

    for (const file of files) {
      if (isImageFile(file.name)) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const imageText = await extractTextFromImage(new Uint8Array(arrayBuffer), env.AI);
          if (imageText) {
            extractedTexts.push(imageText);
          }
        } catch (ocrError) {
          console.warn('[Research] OCR failed for', file.name, ocrError);
        }
      }
    }

    const fullInput = [textInput, ...extractedTexts].filter(Boolean).join('\n\n');
    console.log('[Research] Full input length:', fullInput.length);

    // Step 2: Normalize intake with theme-specific prompt
    const template = await getTemplate(theme, env.DB);
    if (!template) {
      return new Response(JSON.stringify({
        error: 'Invalid theme',
        details: `Theme "${theme}" not found`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const intakeProvider = selectProvider(0, env, 'cheap');
    const intakePrompt = template.intakePrompt || INTAKE_NORMALIZER;

    const intakeStart = Date.now();
    const intakeResponse = await callProvider(intakeProvider, {
      systemPrompt: intakePrompt,
      userPrompt: fullInput,
      maxTokens: 1000,
      temperature: 0
    });

    const intakeDuration = Date.now() - intakeStart;
    console.log('[Research] Intake normalization:', intakeDuration, 'ms');

    // Parse intake JSON
    let intakeJson;
    try {
      let jsonStr = intakeResponse.content.trim();
      if (jsonStr.includes('```')) {
        const codeMatch = jsonStr.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (codeMatch) jsonStr = codeMatch[1];
      }
      const firstBrace = jsonStr.indexOf('{');
      const lastBrace = jsonStr.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
      }
      intakeJson = JSON.parse(jsonStr);
    } catch (parseError: any) {
      console.error('[Research] Parse error:', parseError.message);
      return new Response(JSON.stringify({
        error: 'Failed to parse intake',
        details: parseError.message,
        raw: intakeResponse.content.substring(0, 500)
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const intakeDiagnostics = {
      provider: intakeProvider.provider,
      model: intakeProvider.model,
      tokensIn: intakeResponse.usage?.prompt_tokens || 0,
      tokensOut: intakeResponse.usage?.completion_tokens || 0,
      costUsd: intakeProvider.costPer1kIn * (intakeResponse.usage?.prompt_tokens || 0) / 1000 +
               intakeProvider.costPer1kOut * (intakeResponse.usage?.completion_tokens || 0) / 1000,
      durationMs: intakeDuration
    };

    if (!validateIntake(intakeJson)) {
      return new Response(JSON.stringify({
        error: 'Failed to parse trip details',
        details: intakeJson
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('[Research] Intake validated:', JSON.stringify(intakeJson).substring(0, 200));

    // Step 3: Theme-specific research
    const researchSteps = [];

    // Extract theme-specific input using a map for better readability
    const themeInputMap = {
      heritage: intakeJson.surnames?.[0],
      tvmovie: intakeJson.titles?.[0],
      historical: intakeJson.events?.[0],
      culinary: intakeJson.cuisines?.[0],
      adventure: intakeJson.activities?.[0]
    };
    const themeInput = themeInputMap[intakeJson.theme as keyof typeof themeInputMap];

    if (themeInput && template.researchQueryTemplate && template.researchSynthesisPrompt) {
      // Declare searchQuery outside try block to avoid scope issues in catch
      let searchQuery = '';

      try {
        // Use template-defined search query
        searchQuery = template.researchQueryTemplate.replace('{input}', themeInput);
        console.log('[Research] Searching web for:', searchQuery);

        const searchProvider = env.SERPER_API_KEY ? 'serper' : env.TAVILY_API_KEY ? 'tavily' : null;

        if (!searchProvider) {
          console.warn('[Research] No search API key configured');
        } else {
          // Perform web search
          const searchResult = await performWebSearch(searchProvider, searchQuery, env);

          // Extract and truncate results consistently for both providers
          const MAX_SEARCH_RESULTS_LENGTH = 3000;
          const rawResults = extractSearchResults(searchResult, searchProvider);
          const truncatedResults = rawResults.substring(0, MAX_SEARCH_RESULTS_LENGTH);

          // AI synthesis using template-defined prompt
          const synthesisPrompt = template.researchSynthesisPrompt
            .replace('{input}', themeInput)
            .replace('{search_results}', truncatedResults);

          const synthesisProvider = selectProvider(0, env, 'cheap');
          const synthesisResponse = await callProvider(synthesisProvider, {
            systemPrompt: 'You are a travel expert synthesizing research into actionable travel recommendations.',
            userPrompt: synthesisPrompt,
            maxTokens: 400,
            temperature: 0.7
          });

          const synthesizedSummary = synthesisResponse.content.trim();
          const sources = extractSearchSources(searchResult, searchProvider);

          researchSteps.push({
            step: `${intakeJson.theme}_research`,
            query: searchQuery,
            summary: synthesizedSummary,
            sources
          });

          console.log('[Research] Found', getResultCount(searchResult, searchProvider), 'results, synthesized into', synthesizedSummary.length, 'chars');
        }
      } catch (searchError: any) {
        console.error('[Research] Search failed:', searchError.message);
        researchSteps.push({
          step: `${intakeJson.theme}_research`,
          query: searchQuery,
          error: searchError.message
        });
      }
    } else {
      console.log('[Research] No research configuration for theme:', intakeJson.theme, 'or missing input data');
    }

    // Return intake + research results
    return new Response(JSON.stringify({
      intake: intakeJson,
      research: researchSteps,
      diagnostics: {
        intake: intakeDiagnostics
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[Research] Error:', error);

    return new Response(JSON.stringify({
      error: 'Research failed',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
