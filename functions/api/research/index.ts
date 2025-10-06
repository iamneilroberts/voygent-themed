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

    // Heritage theme: surname research
    if (intakeJson.theme === 'heritage' && intakeJson.surnames && intakeJson.surnames.length > 0) {
      const surname = intakeJson.surnames[0];
      const searchQuery = `${surname} surname origin history Scotland Ireland England genealogy`;

      console.log('[Research] Searching web for:', searchQuery);

      try {
        const searchProvider = env.SERPER_API_KEY ? 'serper' : env.TAVILY_API_KEY ? 'tavily' : null;

        if (!searchProvider) {
          console.warn('[Research] No search API key configured');
        } else if (searchProvider === 'serper') {
          const searchResult = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
              'X-API-KEY': env.SERPER_API_KEY!,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ q: searchQuery, num: 5 })
          }).then(r => r.json());

          const summary = searchResult.organic?.map((r: any) => `${r.title}: ${r.snippet}`).join('\n\n') || '';

          researchSteps.push({
            step: 'surname_research',
            query: searchQuery,
            summary: summary.substring(0, 800),
            sources: searchResult.organic?.slice(0, 3).map((r: any) => r.link) || []
          });

          console.log('[Research] Found', searchResult.organic?.length || 0, 'results');
        } else if (searchProvider === 'tavily') {
          const searchResult = await fetch('https://api.tavily.com/search', {
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

          const summary = searchResult.results?.map((r: any) => `${r.title}: ${r.content}`).join('\n\n') || '';

          researchSteps.push({
            step: 'surname_research',
            query: searchQuery,
            summary: summary.substring(0, 800),
            sources: searchResult.results?.slice(0, 3).map((r: any) => r.url) || []
          });

          console.log('[Research] Found', searchResult.results?.length || 0, 'results');
        }
      } catch (searchError: any) {
        console.error('[Research] Search failed:', searchError.message);
        researchSteps.push({
          step: 'surname_research',
          query: searchQuery,
          error: searchError.message
        });
      }
    }
    // TV/Movie theme: location and filming site research
    else if (intakeJson.theme === 'tvmovie' && intakeJson.titles && intakeJson.titles.length > 0) {
      const title = intakeJson.titles[0];
      const searchQuery = `${title} filming locations where to visit travel guide`;

      console.log('[Research] Searching web for:', searchQuery);

      try {
        const searchProvider = env.SERPER_API_KEY ? 'serper' : env.TAVILY_API_KEY ? 'tavily' : null;

        if (!searchProvider) {
          console.warn('[Research] No search API key configured');
        } else if (searchProvider === 'serper') {
          const searchResult = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
              'X-API-KEY': env.SERPER_API_KEY!,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ q: searchQuery, num: 5 })
          }).then(r => r.json());

          const summary = searchResult.organic?.map((r: any) => `${r.title}: ${r.snippet}`).join('\n\n') || '';

          researchSteps.push({
            step: 'filming_location_research',
            query: searchQuery,
            summary: summary.substring(0, 800),
            sources: searchResult.organic?.slice(0, 3).map((r: any) => r.link) || []
          });

          console.log('[Research] Found', searchResult.organic?.length || 0, 'results');
        } else if (searchProvider === 'tavily') {
          const searchResult = await fetch('https://api.tavily.com/search', {
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

          const summary = searchResult.results?.map((r: any) => `${r.title}: ${r.content}`).join('\n\n') || '';

          researchSteps.push({
            step: 'filming_location_research',
            query: searchQuery,
            summary: summary.substring(0, 800),
            sources: searchResult.results?.slice(0, 3).map((r: any) => r.url) || []
          });

          console.log('[Research] Found', searchResult.results?.length || 0, 'results');
        }
      } catch (searchError: any) {
        console.error('[Research] Search failed:', searchError.message);
        researchSteps.push({
          step: 'filming_location_research',
          query: searchQuery,
          error: searchError.message
        });
      }
    }
    // Historical theme
    else if (intakeJson.theme === 'historical' && intakeJson.events && intakeJson.events.length > 0) {
      const event = intakeJson.events[0];
      const searchQuery = `${event} historical sites museums where to visit travel guide`;

      console.log('[Research] Searching web for:', searchQuery);

      try {
        const searchProvider = env.SERPER_API_KEY ? 'serper' : env.TAVILY_API_KEY ? 'tavily' : null;

        if (searchProvider === 'serper') {
          const searchResult = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
              'X-API-KEY': env.SERPER_API_KEY!,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ q: searchQuery, num: 5 })
          }).then(r => r.json());

          const summary = searchResult.organic?.map((r: any) => `${r.title}: ${r.snippet}`).join('\n\n') || '';

          researchSteps.push({
            step: 'historical_research',
            query: searchQuery,
            summary: summary.substring(0, 800),
            sources: searchResult.organic?.slice(0, 3).map((r: any) => r.link) || []
          });
        } else if (searchProvider === 'tavily') {
          const searchResult = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              api_key: env.TAVILY_API_KEY,
              query: searchQuery,
              max_results: 5
            })
          }).then(r => r.json());

          const summary = searchResult.results?.map((r: any) => `${r.title}: ${r.content}`).join('\n\n') || '';

          researchSteps.push({
            step: 'historical_research',
            query: searchQuery,
            summary: summary.substring(0, 800),
            sources: searchResult.results?.slice(0, 3).map((r: any) => r.url) || []
          });
        }
      } catch (searchError: any) {
        console.error('[Research] Search failed:', searchError.message);
        researchSteps.push({
          step: 'historical_research',
          query: searchQuery,
          error: searchError.message
        });
      }
    }
    // Culinary theme
    else if (intakeJson.theme === 'culinary' && intakeJson.cuisines && intakeJson.cuisines.length > 0) {
      const cuisine = intakeJson.cuisines[0];
      const searchQuery = `${cuisine} cuisine best restaurants regions where to eat travel guide`;

      console.log('[Research] Searching web for:', searchQuery);

      try {
        const searchProvider = env.SERPER_API_KEY ? 'serper' : env.TAVILY_API_KEY ? 'tavily' : null;

        if (searchProvider === 'serper') {
          const searchResult = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
              'X-API-KEY': env.SERPER_API_KEY!,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ q: searchQuery, num: 5 })
          }).then(r => r.json());

          const summary = searchResult.organic?.map((r: any) => `${r.title}: ${r.snippet}`).join('\n\n') || '';

          researchSteps.push({
            step: 'culinary_research',
            query: searchQuery,
            summary: summary.substring(0, 800),
            sources: searchResult.organic?.slice(0, 3).map((r: any) => r.link) || []
          });
        } else if (searchProvider === 'tavily') {
          const searchResult = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              api_key: env.TAVILY_API_KEY,
              query: searchQuery,
              max_results: 5
            })
          }).then(r => r.json());

          const summary = searchResult.results?.map((r: any) => `${r.title}: ${r.content}`).join('\n\n') || '';

          researchSteps.push({
            step: 'culinary_research',
            query: searchQuery,
            summary: summary.substring(0, 800),
            sources: searchResult.results?.slice(0, 3).map((r: any) => r.url) || []
          });
        }
      } catch (searchError: any) {
        console.error('[Research] Search failed:', searchError.message);
        researchSteps.push({
          step: 'culinary_research',
          query: searchQuery,
          error: searchError.message
        });
      }
    }
    // Adventure theme
    else if (intakeJson.theme === 'adventure' && intakeJson.activities && intakeJson.activities.length > 0) {
      const activity = intakeJson.activities[0];
      const searchQuery = `${activity} best destinations trails parks travel guide`;

      console.log('[Research] Searching web for:', searchQuery);

      try {
        const searchProvider = env.SERPER_API_KEY ? 'serper' : env.TAVILY_API_KEY ? 'tavily' : null;

        if (searchProvider === 'serper') {
          const searchResult = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
              'X-API-KEY': env.SERPER_API_KEY!,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ q: searchQuery, num: 5 })
          }).then(r => r.json());

          const summary = searchResult.organic?.map((r: any) => `${r.title}: ${r.snippet}`).join('\n\n') || '';

          researchSteps.push({
            step: 'adventure_research',
            query: searchQuery,
            summary: summary.substring(0, 800),
            sources: searchResult.organic?.slice(0, 3).map((r: any) => r.link) || []
          });
        } else if (searchProvider === 'tavily') {
          const searchResult = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              api_key: env.TAVILY_API_KEY,
              query: searchQuery,
              max_results: 5
            })
          }).then(r => r.json());

          const summary = searchResult.results?.map((r: any) => `${r.title}: ${r.content}`).join('\n\n') || '';

          researchSteps.push({
            step: 'adventure_research',
            query: searchQuery,
            summary: summary.substring(0, 800),
            sources: searchResult.results?.slice(0, 3).map((r: any) => r.url) || []
          });
        }
      } catch (searchError: any) {
        console.error('[Research] Search failed:', searchError.message);
        researchSteps.push({
          step: 'adventure_research',
          query: searchQuery,
          error: searchError.message
        });
      }
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
