// GET /api/trips - List trips for a user
// POST /api/trips - Create new trip from intake (files/links/text)
import { createTrip, updateTrip, saveMessage, listTrips } from '../lib/db';
import { selectProvider, callProvider } from '../lib/provider';
import { INTAKE_NORMALIZER, OPTIONS_GENERATOR } from '../lib/prompts';
import { validateIntake } from '../lib/schemas';
import { extractTextFromImage, isImageFile } from '../lib/ocr';
import { parseGenealogyURL, extractGenealogyContext, mergeGenealogyContexts, type GenealogyContext } from '../lib/genealogy';
import * as serper from '../lib/serper';
import * as tavily from '../lib/tavily';
import { selectTemplate } from '../lib/trip-templates';

interface Env {
  DB: D1Database;
  AI?: any; // Cloudflare AI binding for OCR
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  SERPER_API_KEY?: string;
  SERPER_API_URL?: string;
  TAVILY_API_KEY?: string;
  TAVILY_API_URL?: string;
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return new Response(JSON.stringify({
        error: 'Missing required parameter',
        details: 'userId query parameter is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const trips = await listTrips(env.DB, userId);

    return new Response(JSON.stringify({ trips }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Error listing trips:', error);

    return new Response(JSON.stringify({
      error: 'Failed to list trips',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  try {
    // Parse multipart form data
    const formData = await request.formData();
    const text = formData.get('text') as string || '';
    const urls = formData.get('urls') as string || '';
    const userId = formData.get('userId') as string || null;
    const files = formData.getAll('files') as File[];

    // Trip theme selection (explicit or auto-detected)
    const explicitTheme = formData.get('theme') as string || '';

    // NEW: Genealogy-specific fields (for backwards compatibility)
    const genealogyUrl = formData.get('genealogy_url') as string || '';
    const departureAirport = formData.get('departure_airport') as string || '';
    const transportPref = formData.get('transport_pref') as string || '';
    const hotelType = formData.get('hotel_type') as string || '';

    // Process genealogy URL if provided
    const genealogyContexts: Partial<GenealogyContext>[] = [];

    if (genealogyUrl) {
      try {
        const urlContext = await parseGenealogyURL(genealogyUrl);
        genealogyContexts.push(urlContext);

        // Perform web search for surname + region history (FR-005)
        if (urlContext.surnames && urlContext.surnames.length > 0 && urlContext.origins && urlContext.origins.length > 0) {
          const query = `${urlContext.surnames[0]} surname ${urlContext.origins[0]} history`;
          try {
            const searchResult = env.SERPER_API_KEY
              ? await serper.webSearch(env as any, { q: query, max_results: 5 })
              : await tavily.webSearch(env as any, { q: query, max_results: 5 });

            const webSummary = searchResult.results.map((r: any) => r.snippet || r.title).join(' ');
            if (urlContext.sources && urlContext.sources[0]) {
              urlContext.sources[0].web_search_context = webSummary.slice(0, 500);
            }
          } catch (searchError) {
            console.error('Web search for genealogy failed:', searchError);
            // Continue without web search (non-blocking per FR-008)
          }
        }
      } catch (urlError) {
        console.error('Genealogy URL parsing failed:', urlError);
        // Continue trip generation (FR-008)
      }
    }

    // Process file uploads (OCR if images, check for genealogy files)
    let fileTexts: string[] = [];
    for (const file of files) {
      if (isImageFile(file.name)) {
        const buffer = await file.arrayBuffer();
        const ocrText = env.AI
          ? await extractTextFromImage(buffer, env)
          : '[OCR unavailable - AI binding not configured]';

        fileTexts.push(`[Image: ${file.name}]\n${ocrText}`);

        // Extract genealogy context from OCR text
        if (!ocrText.startsWith('[OCR')) {
          const fileContext = extractGenealogyContext(ocrText, `OCR from ${file.name}`);
          genealogyContexts.push(fileContext);
        }
      } else if (file.name.toLowerCase().endsWith('.pdf')) {
        const textContent = await file.text();
        fileTexts.push(`[File: ${file.name}]\n${textContent}`);

        // Extract genealogy context from PDF text
        const fileContext = extractGenealogyContext(textContent, `PDF: ${file.name}`);
        genealogyContexts.push(fileContext);
      } else {
        const textContent = await file.text();
        fileTexts.push(`[File: ${file.name}]\n${textContent}`);
      }
    }

    // Merge all genealogy contexts
    const ancestryContext = genealogyContexts.length > 0
      ? mergeGenealogyContexts(genealogyContexts)
      : null;

    // Combine all inputs
    const combinedInput = [
      text,
      urls ? `URLs:\n${urls}` : '',
      ...fileTexts,
      ancestryContext ? `\nGenealogy Context:\n${JSON.stringify(ancestryContext, null, 2)}` : ''
    ].filter(Boolean).join('\n\n');

    if (!combinedInput.trim()) {
      return new Response(JSON.stringify({ error: 'No input provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Step 0.5: Select trip template based on input or explicit theme
    const template = await selectTemplate(combinedInput, explicitTheme, env.DB);
    console.log(`[STEP 0.5] Selected template: ${template.name} (${template.id})`);

    // Step 1: Normalize intake with CHEAP model using template-specific prompt
    console.log('[STEP 1] Starting intake normalization...');
    console.log(`[STEP 1] Input length: ${combinedInput.length} chars, estimated tokens: ${Math.round(combinedInput.length / 4)}`);

    const intakeProvider = selectProvider(combinedInput.length / 4, env, 'cheap');
    console.log(`[STEP 1] Selected provider: ${intakeProvider.name} (${intakeProvider.model})`);

    const intakeResponse = await callProvider(intakeProvider, {
      systemPrompt: template.intakePrompt,  // Use template-specific prompt
      userPrompt: combinedInput,
      maxTokens: 1200,  // Increased for more complex themes
      temperature: 0.5
    });

    console.log(`[STEP 1] ✓ Intake normalized. Tokens: ${intakeResponse.tokensIn}→${intakeResponse.tokensOut}, Cost: $${intakeResponse.costUsd.toFixed(4)}`);

    // Parse and validate intake JSON
    console.log('[STEP 1] Parsing intake JSON...');
    let intakeJson;
    try {
      // Try to extract JSON - look for outermost braces
      let jsonStr = intakeResponse.content.trim();

      // If wrapped in markdown code blocks, extract
      if (jsonStr.includes('```')) {
        const codeMatch = jsonStr.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (codeMatch) jsonStr = codeMatch[1];
      }

      // Find the first { and last }
      const firstBrace = jsonStr.indexOf('{');
      const lastBrace = jsonStr.lastIndexOf('}');

      if (firstBrace === -1 || lastBrace === -1) {
        throw new Error('No JSON object found in response');
      }

      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
      intakeJson = JSON.parse(jsonStr);
      console.log(`[STEP 1] ✓ Parsed successfully. Surnames: ${intakeJson.surnames?.join(', ') || 'none'}`);
    } catch (e: any) {
      console.error('[STEP 1] ✗ Parse failed:', e.message);
      return new Response(JSON.stringify({
        error: 'Failed to parse intake JSON',
        details: e.message,
        raw: intakeResponse.content.substring(0, 500)
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!validateIntake(intakeJson, template)) {
      return new Response(JSON.stringify({ error: 'Invalid intake schema', errors: validateIntake.errors }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Add genealogy context and new fields to intake JSON
    if (ancestryContext) {
      intakeJson.ancestry_context = ancestryContext;
    }
    if (departureAirport) {
      intakeJson.departure_airport = departureAirport;
    }
    if (transportPref) {
      intakeJson.transport_pref = transportPref;
    }
    if (hotelType) {
      intakeJson.hotel_type = hotelType;
    }

    // Step 1.5: Theme-specific research
    console.log('[STEP 1.5] Starting theme-specific research...');
    const researchSteps = [];

    // Heritage theme: surname + origin-based travel research
    if (intakeJson.theme === 'heritage' && intakeJson.surnames && intakeJson.surnames.length > 0) {
      const surname = intakeJson.surnames[0];
      const origins = intakeJson.suspected_origins || [];
      const interests = intakeJson.interests || [];
      const notes = intakeJson.notes || [];
      const sources = intakeJson.sources || [];

      console.log(`[STEP 1.5] Heritage research for surname: ${surname}`);

      try {
        // Build search query from available context
        let searchQuery = `${surname} family`;

        // Add suspected origins if provided (most important for targeting destinations)
        if (origins.length > 0) {
          searchQuery += ` ${origins.slice(0, 3).join(' ')}`;
        }

        // Add relevant keywords from sources (genealogy notes, etc.)
        if (sources.length > 0) {
          const sourceNotes = sources
            .filter((s: any) => s.notes)
            .map((s: any) => s.notes)
            .join(' ')
            .substring(0, 80);
          if (sourceNotes) {
            searchQuery += ` ${sourceNotes}`;
          }
        }

        // Add interests if provided
        if (interests.length > 0) {
          searchQuery += ` ${interests.slice(0, 2).join(' ')}`;
        }

        // Add relevant keywords from notes
        if (notes.length > 0) {
          const notesText = notes.join(' ').substring(0, 80);
          searchQuery += ` ${notesText}`;
        }

        // Add travel-focused keywords
        searchQuery += ' heritage sites ancestral homes castles historical tours travel destinations';

        console.log(`[STEP 1.5] Web search query: "${searchQuery}"`);

        const searchResult = env.SERPER_API_KEY
          ? await serper.webSearch(env as any, { q: searchQuery, max_results: 5 })
          : env.TAVILY_API_KEY
          ? await tavily.webSearch(env as any, { q: searchQuery, max_results: 5 })
          : null;

        if (searchResult) {
          console.log(`[STEP 1.5] ✓ Web search returned ${searchResult.results?.length || 0} results`);

          const summary = searchResult.results
            .slice(0, 3)
            .map((r: any) => `${r.title}: ${r.snippet || r.content}`)
            .join('\n\n');

          researchSteps.push({
            step: 'surname_research',
            query: searchQuery,
            summary: summary.substring(0, 800),
            sources: searchResult.results.slice(0, 3).map((r: any) => r.url)
          });
        }
      } catch (error) {
        console.error('[STEP 1.5] ✗ Web search failed:', error);
      }
    }
    // TV/Movie theme: location and filming site research
    else if (intakeJson.theme === 'tvmovie' && intakeJson.titles && intakeJson.titles.length > 0) {
      const title = intakeJson.titles[0];
      console.log(`[STEP 1.5] TV/Movie research for: ${title}`);

      try {
        const searchQuery = `${title} filming locations where to visit travel guide`;
        console.log(`[STEP 1.5] Web search query: "${searchQuery}"`);

        const searchResult = env.SERPER_API_KEY
          ? await serper.webSearch(env as any, { q: searchQuery, max_results: 5 })
          : env.TAVILY_API_KEY
          ? await tavily.webSearch(env as any, { q: searchQuery, max_results: 5 })
          : null;

        if (searchResult) {
          console.log(`[STEP 1.5] ✓ Web search returned ${searchResult.results?.length || 0} results`);

          const summary = searchResult.results
            .slice(0, 3)
            .map((r: any) => `${r.title}: ${r.snippet || r.content}`)
            .join('\n\n');

          researchSteps.push({
            step: 'filming_location_research',
            query: searchQuery,
            summary: summary.substring(0, 800),
            sources: searchResult.results.slice(0, 3).map((r: any) => r.url)
          });
        }
      } catch (error) {
        console.error('[STEP 1.5] ✗ Web search failed:', error);
      }
    }
    // Historical theme: event/period research
    else if (intakeJson.theme === 'historical' && intakeJson.events && intakeJson.events.length > 0) {
      const event = intakeJson.events[0];
      console.log(`[STEP 1.5] Historical research for: ${event}`);

      try {
        const searchQuery = `${event} historical sites museums tours travel guide`;
        console.log(`[STEP 1.5] Web search query: "${searchQuery}"`);

        const searchResult = env.SERPER_API_KEY
          ? await serper.webSearch(env as any, { q: searchQuery, max_results: 5 })
          : env.TAVILY_API_KEY
          ? await tavily.webSearch(env as any, { q: searchQuery, max_results: 5 })
          : null;

        if (searchResult) {
          console.log(`[STEP 1.5] ✓ Web search returned ${searchResult.results?.length || 0} results`);

          const summary = searchResult.results
            .slice(0, 3)
            .map((r: any) => `${r.title}: ${r.snippet || r.content}`)
            .join('\n\n');

          researchSteps.push({
            step: 'historical_research',
            query: searchQuery,
            summary: summary.substring(0, 800),
            sources: searchResult.results.slice(0, 3).map((r: any) => r.url)
          });
        }
      } catch (error) {
        console.error('[STEP 1.5] ✗ Web search failed:', error);
      }
    }
    // Culinary theme: cuisine/region research
    else if (intakeJson.theme === 'culinary' && intakeJson.cuisines && intakeJson.cuisines.length > 0) {
      const cuisine = intakeJson.cuisines[0];
      const region = intakeJson.regions?.[0] || '';
      console.log(`[STEP 1.5] Culinary research for: ${cuisine}${region ? ` in ${region}` : ''}`);

      try {
        const searchQuery = `${cuisine} ${region} food tour cooking classes restaurants travel guide`;
        console.log(`[STEP 1.5] Web search query: "${searchQuery}"`);

        const searchResult = env.SERPER_API_KEY
          ? await serper.webSearch(env as any, { q: searchQuery, max_results: 5 })
          : env.TAVILY_API_KEY
          ? await tavily.webSearch(env as any, { q: searchQuery, max_results: 5 })
          : null;

        if (searchResult) {
          console.log(`[STEP 1.5] ✓ Web search returned ${searchResult.results?.length || 0} results`);

          const summary = searchResult.results
            .slice(0, 3)
            .map((r: any) => `${r.title}: ${r.snippet || r.content}`)
            .join('\n\n');

          researchSteps.push({
            step: 'culinary_research',
            query: searchQuery,
            summary: summary.substring(0, 800),
            sources: searchResult.results.slice(0, 3).map((r: any) => r.url)
          });
        }
      } catch (error) {
        console.error('[STEP 1.5] ✗ Web search failed:', error);
      }
    }
    // Adventure theme: destination/activity research
    else if (intakeJson.theme === 'adventure' && intakeJson.locations && intakeJson.locations.length > 0) {
      const location = intakeJson.locations[0];
      console.log(`[STEP 1.5] Adventure research for: ${location}`);

      try {
        const searchQuery = `${location} hiking trails outdoor activities adventure travel guide`;
        console.log(`[STEP 1.5] Web search query: "${searchQuery}"`);

        const searchResult = env.SERPER_API_KEY
          ? await serper.webSearch(env as any, { q: searchQuery, max_results: 5 })
          : env.TAVILY_API_KEY
          ? await tavily.webSearch(env as any, { q: searchQuery, max_results: 5 })
          : null;

        if (searchResult) {
          console.log(`[STEP 1.5] ✓ Web search returned ${searchResult.results?.length || 0} results`);

          const summary = searchResult.results
            .slice(0, 3)
            .map((r: any) => `${r.title}: ${r.snippet || r.content}`)
            .join('\n\n');

          researchSteps.push({
            step: 'adventure_research',
            query: searchQuery,
            summary: summary.substring(0, 800),
            sources: searchResult.results.slice(0, 3).map((r: any) => r.url)
          });
        }
      } catch (error) {
        console.error('[STEP 1.5] ✗ Web search failed:', error);
      }
    } else {
      console.log('[STEP 1.5] Skipped - no research data available for this theme');
    }

    // AI reasoning (only for heritage theme currently)
    if (intakeJson.theme === 'heritage' && researchSteps.length > 0) {
      console.log('[STEP 1.5] Starting AI reasoning...');
      try {
        const surname = intakeJson.surnames[0];
        const reasoningPrompt = `Based on the surname "${surname}" and the following research:

${researchSteps[0]?.summary || 'No web search data available'}

Provide a brief analysis (2-3 sentences) of:
1. The most likely geographic origin of this surname
2. Key historical locations associated with this family name
3. Recommended heritage destinations to visit

Keep your response concise and factual.`;

        const reasoningProvider = selectProvider(reasoningPrompt.length / 4, env, 'cheap');
        console.log(`[STEP 1.5] AI provider: ${reasoningProvider.name} (${reasoningProvider.model})`);

        const reasoningResponse = await callProvider(reasoningProvider, {
          systemPrompt: 'You are a genealogy and heritage travel expert. Provide concise, factual analysis.',
          userPrompt: reasoningPrompt,
          maxTokens: 300,
          temperature: 0.7
        });

        console.log(`[STEP 1.5] ✓ AI reasoning complete. Tokens: ${reasoningResponse.tokensOut}, Cost: $${reasoningResponse.costUsd.toFixed(4)}`);

        researchSteps.push({
          step: 'ai_reasoning',
          analysis: reasoningResponse.content.trim(),
          tokens: reasoningResponse.tokensOut,
          cost: reasoningResponse.costUsd
        });

        console.log(`[STEP 1.5] Analysis preview: ${reasoningResponse.content.substring(0, 100)}...`);
      } catch (error) {
        console.error('[STEP 1.5] ✗ AI reasoning failed:', error);
      }
    }

    // Add research to intake for later reference
    if (researchSteps.length > 0) {
      intakeJson.research_context = researchSteps;
      console.log(`[STEP 1.5] ✓ Research complete with ${researchSteps.length} steps`);
    }

    // Step 2: Generate options (<=4) with CHEAP model, increased token limit
    console.log('[STEP 2] Generating trip options...');
    // First attempt: 4 options with 1800 tokens
    const optionsProvider = selectProvider(JSON.stringify(intakeJson).length / 4, env, 'cheap');
    console.log(`[STEP 2] Provider: ${optionsProvider.name} (${optionsProvider.model})`);

    let optionsJson;
    let optionsResponse;
    let attempt = 1;
    const maxAttempts = 2;

    while (attempt <= maxAttempts) {
      const maxOptions = attempt === 1 ? 4 : 2;
      const maxTokens = attempt === 1 ? 1800 : 2500;

      console.log(`[STEP 2] Attempt ${attempt}: Generating ${maxOptions} options with ${maxTokens} max tokens`);

      const promptWithCount = `${OPTIONS_GENERATOR}\n\nIMPORTANT: Generate exactly ${maxOptions} options. Each option should be complete with all required fields.`;

      optionsResponse = await callProvider(optionsProvider, {
        systemPrompt: promptWithCount,
        userPrompt: JSON.stringify(intakeJson, null, 2),
        maxTokens,
        temperature: 0.7
      });

      console.log(`[STEP 2] Response received. Tokens: ${optionsResponse.tokensIn}→${optionsResponse.tokensOut}, Cost: $${optionsResponse.costUsd.toFixed(4)}`);

      try {
        let jsonStr = optionsResponse.content.trim();

        // If wrapped in markdown code blocks, extract
        if (jsonStr.includes('```')) {
          const codeMatch = jsonStr.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
          if (codeMatch) jsonStr = codeMatch[1];
        }

        // Find the first { and last }
        const firstBrace = jsonStr.indexOf('{');
        const lastBrace = jsonStr.lastIndexOf('}');

        if (firstBrace === -1 || lastBrace === -1) {
          throw new Error('No JSON object found in response');
        }

        jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
        optionsJson = JSON.parse(jsonStr);

        const optionCount = optionsJson.options?.length || 0;
        console.log(`[STEP 2] ✓ Parsed successfully. Generated ${optionCount} options`);

        // Success! Break out of retry loop
        break;
      } catch (e: any) {
        console.error(`[STEP 2] ✗ Parse failed on attempt ${attempt}:`, e.message);
        if (attempt < maxAttempts) {
          // Retry with fewer options and more tokens
          console.log(`[STEP 2] Retrying with ${maxOptions === 4 ? 2 : 'N/A'} options...`);
          attempt++;
          continue;
        }

        // Final attempt failed - return error
        return new Response(JSON.stringify({
          error: 'Failed to parse options JSON',
          details: e.message,
          raw: optionsResponse.content.substring(0, 500),
          attempts: maxAttempts
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Create trip record
    console.log('[STEP 3] Saving trip to database...');

    // Generate theme-appropriate title
    let tripTitle = 'Trip';
    switch (intakeJson.theme) {
      case 'heritage':
        tripTitle = `Heritage trip: ${intakeJson.surnames?.join(', ') || 'Ancestry exploration'}`;
        break;
      case 'tvmovie':
        tripTitle = `${intakeJson.titles?.[0] || 'TV/Movie'} locations trip`;
        break;
      case 'historical':
        tripTitle = `Historical trip: ${intakeJson.events?.[0] || 'History exploration'}`;
        break;
      case 'culinary':
        tripTitle = `Culinary trip: ${intakeJson.cuisines?.[0] || 'Food tour'}`;
        break;
      case 'adventure':
        tripTitle = `Adventure trip: ${intakeJson.activities?.[0] || 'Outdoor exploration'}`;
        break;
      default:
        tripTitle = `${template.name} trip`;
    }

    const tripId = await createTrip(env.DB, userId);
    await updateTrip(env.DB, tripId, {
      intake_json: JSON.stringify(intakeJson),
      options_json: JSON.stringify(optionsJson),
      status: 'options_ready',
      title: tripTitle
    });
    console.log(`[STEP 3] ✓ Trip saved. ID: ${tripId}`);

    // Save messages
    await saveMessage(
      env.DB,
      tripId,
      'user',
      combinedInput,
      intakeResponse.tokensIn,
      0,
      0
    );
    await saveMessage(
      env.DB,
      tripId,
      'assistant',
      intakeResponse.content,
      0,
      intakeResponse.tokensOut,
      intakeResponse.costUsd
    );
    await saveMessage(
      env.DB,
      tripId,
      'assistant',
      optionsResponse.content,
      0,
      optionsResponse.tokensOut,
      optionsResponse.costUsd
    );

    console.log('[COMPLETE] Trip generation finished successfully');

    return new Response(JSON.stringify({
      tripId,
      intake: intakeJson,
      options: optionsJson.options || optionsJson,
      status: 'options_ready',
      template: {
        id: template.id,
        name: template.name,
        icon: template.icon
      },
      diagnostics: {
        timestamp: new Date().toISOString(),
        template: { id: template.id, name: template.name },
        steps: [
          { step: 'template_selection', template: template.name },
          { step: 'intake_normalization', provider: intakeProvider.name, model: intakeProvider.model, tokensIn: intakeResponse.tokensIn, tokensOut: intakeResponse.tokensOut, costUsd: intakeResponse.costUsd },
          ...(researchSteps.length > 0 ? [{ step: 'surname_research', count: researchSteps.length }] : []),
          { step: 'options_generation', provider: optionsProvider.name, model: optionsProvider.model, tokensIn: optionsResponse.tokensIn, tokensOut: optionsResponse.tokensOut, costUsd: optionsResponse.costUsd }
        ],
        research: researchSteps.length > 0 ? researchSteps : undefined,
        intake: {
          provider: intakeProvider.name,
          model: intakeProvider.model,
          tokensIn: intakeResponse.tokensIn,
          tokensOut: intakeResponse.tokensOut,
          costUsd: intakeResponse.costUsd
        },
        options: {
          provider: optionsProvider.name,
          model: optionsProvider.model,
          tokensIn: optionsResponse.tokensIn,
          tokensOut: optionsResponse.tokensOut,
          costUsd: optionsResponse.costUsd
        },
        totalCost: (intakeResponse.costUsd + optionsResponse.costUsd + (researchSteps.find(s => s.cost)?.cost || 0))
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in POST /api/trips:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
