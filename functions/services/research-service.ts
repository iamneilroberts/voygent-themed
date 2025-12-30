/**
 * Research Service
 * VoyGent V3 - Phase 1 Destination Research
 *
 * Orchestrates destination research workflow:
 * 1. Extract context from user input
 * 2. Build research queries from template
 * 3. Perform web searches
 * 4. Synthesize results with AI
 * 5. Present destination recommendations
 */

import { Env, DatabaseClient, TripTemplate, Destination, TripPreferences, ResearchSummary } from '../lib/db';
import { Logger } from '../lib/logger';
import { CostTracker, createCostTracker } from '../lib/cost-tracker';
import { TemplateEngine, createTemplateEngine } from '../lib/template-engine';
import { AIProviderManager, createAIProviderManager } from '../lib/ai-providers';
import { SearchClient, createSearchClient, SearchResponse } from './search-client';
import { FirecrawlClient, createFirecrawlClient, ScrapeResult } from './firecrawl-client';

export interface EnrichedSearchResult {
  query: string;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    enrichedContent?: string;  // Full content from Firecrawl
  }>;
}

export interface ResearchRequest {
  tripId: string;
  userMessage: string;
  template: TripTemplate;
  preferences?: TripPreferences;
}

export interface ResearchResult {
  destinations: Destination[];
  aiResponse: string;
}

/**
 * AI-interpreted research context
 * Replaces hardcoded placeholder extraction with intelligent interpretation
 */
export interface InterpretedResearchContext {
  // AI-generated search queries tailored to the request
  search_queries: string[];

  // Key details extracted from user message
  extracted_details: {
    primary_interest: string;  // Main focus (e.g., "hiking", "ancestry research", "historical sites")
    geographic_focus?: string;  // Location constraint if any
    specific_requirements?: string[];  // Specific things mentioned
  };

  // Constraints for destination synthesis
  constraints: {
    geographic_region?: string;  // e.g., "British Columbia", "Ireland"
    thematic_focus?: string;  // e.g., "outdoor adventure", "family heritage"
    suggested_num_destinations: number;  // AI-determined based on trip params
    reasoning: string;  // Why this number of destinations
  };

  // Raw context for logging
  raw_interpretation: string;
}

/**
 * Research Service
 */
export class ResearchService {
  private templateEngine: TemplateEngine;
  private aiProvider: AIProviderManager;
  private searchClient: SearchClient;
  private firecrawlClient: FirecrawlClient | null;

  constructor(
    private env: Env,
    private db: DatabaseClient,
    private logger: Logger
  ) {
    this.templateEngine = createTemplateEngine();
    this.aiProvider = createAIProviderManager(env, logger);
    this.searchClient = createSearchClient(env, logger);
    this.firecrawlClient = createFirecrawlClient(env, logger);
  }

  /**
   * AI-powered interpretation of user request
   * Generates smart search queries and extracts context without hardcoded placeholders
   */
  private async interpretUserRequest(
    userMessage: string,
    template: TripTemplate,
    preferences: TripPreferences | undefined,
    costTracker: CostTracker,
    tripId: string
  ): Promise<InterpretedResearchContext> {
    const duration = preferences?.duration || '7 days';
    const activityLevel = preferences?.activity_level || 'Moderate';
    const numTravelers = (preferences?.travelers_adults || 2) + (preferences?.travelers_children || 0);
    const userNumDestinations = preferences?.num_destinations;

    const prompt = `You are a travel research assistant helping plan a "${template.name}" trip.

TEMPLATE THEME: ${template.name}
TEMPLATE DESCRIPTION: ${template.description}
${template.example_inputs ? `EXAMPLE REQUESTS FOR THIS THEME: ${JSON.parse(template.example_inputs).join(', ')}` : ''}

USER'S REQUEST: "${userMessage}"

TRIP PARAMETERS:
- Duration: ${duration}
- Activity Level: ${activityLevel}
- Number of Travelers: ${numTravelers}
${preferences?.traveler_ages ? `- Traveler Ages: ${preferences.traveler_ages.join(', ')}` : ''}
${userNumDestinations ? `- Requested Destinations: ${userNumDestinations}` : '- Destinations: Not specified (you decide)'}

YOUR TASK:
1. Understand what the user wants based on their message and the template theme
2. Generate 2-4 web search queries that will find relevant destination information
3. Extract key details from their request
4. Determine how many destinations are appropriate (if not specified)

Respond with ONLY valid JSON in this exact format:
{
  "search_queries": [
    "specific search query 1 for finding destinations",
    "specific search query 2 for finding destinations"
  ],
  "extracted_details": {
    "primary_interest": "main focus of the trip",
    "geographic_focus": "location/region if mentioned, or null",
    "specific_requirements": ["any specific things mentioned"]
  },
  "constraints": {
    "geographic_region": "specific region to focus on, or null",
    "thematic_focus": "the theme/type of experience",
    "suggested_num_destinations": 3,
    "reasoning": "Brief explanation of why this number of destinations"
  },
  "raw_interpretation": "One sentence summary of what the user wants"
}`;

    try {
      const aiResponse = await this.aiProvider.generate(
        {
          prompt,
          systemPrompt: 'You are a travel research assistant. Respond with valid JSON only. Generate search queries that will find real destinations and travel information.',
          maxTokens: 600,
          temperature: 0.3,
        },
        costTracker
      );

      await this.logger.logTelemetry(this.db, tripId, 'request_interpretation', {
        provider: aiResponse.provider,
        model: aiResponse.model,
        tokens: aiResponse.totalTokens,
        cost: aiResponse.cost,
        details: { user_message_preview: userMessage.substring(0, 100) },
      });

      // Parse AI response
      const jsonMatch = aiResponse.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const interpreted = JSON.parse(jsonMatch[0]) as InterpretedResearchContext;

        // Override with user preference if specified
        if (userNumDestinations) {
          interpreted.constraints.suggested_num_destinations = userNumDestinations;
          interpreted.constraints.reasoning = `User specified ${userNumDestinations} destinations`;
        }

        this.logger.info(`AI interpretation: ${JSON.stringify(interpreted)}`);
        return interpreted;
      }
    } catch (error) {
      this.logger.error(`AI interpretation failed: ${error}`);
    }

    // Fallback: basic interpretation
    return {
      search_queries: [
        `${template.name} ${userMessage} travel destinations`,
        `best places ${userMessage} ${template.name} trip`,
      ],
      extracted_details: {
        primary_interest: template.name,
        geographic_focus: undefined,
        specific_requirements: [],
      },
      constraints: {
        geographic_region: undefined,
        thematic_focus: template.name,
        suggested_num_destinations: 3,
        reasoning: 'Default fallback',
      },
      raw_interpretation: userMessage,
    };
  }

  /**
   * Perform destination research
   */
  async researchDestinations(request: ResearchRequest): Promise<ResearchResult> {
    const { tripId, userMessage, template, preferences } = request;
    const costTracker = createCostTracker(this.db, this.logger, tripId);

    // Update status: researching
    await this.logger.logUserProgress(this.db, tripId, 'Researching destinations...', 10);

    try {
      // Step 1: AI interprets user request and generates smart search queries
      const interpretation = await this.interpretUserRequest(
        userMessage,
        template,
        preferences,
        costTracker,
        tripId
      );
      this.logger.info(`AI interpretation complete: ${interpretation.raw_interpretation}`);

      // Use AI-generated queries
      const queries = interpretation.search_queries;

      if (queries.length === 0) {
        throw new Error('AI failed to generate search queries');
      }

      // Log the AI interpretation and queries
      await this.logger.logTelemetry(this.db, tripId, 'search_queries', {
        details: {
          queries: queries,
          interpretation: interpretation.extracted_details,
          constraints: interpretation.constraints,
        },
      });

      await this.logger.logUserProgress(this.db, tripId, 'Searching the web for destinations...', 30);

      // Build context for compatibility with existing synthesis methods
      const context: any = {
        ...preferences,
        ...interpretation.extracted_details,
        geographic_focus: interpretation.constraints.geographic_region,
        thematic_focus: interpretation.constraints.thematic_focus,
        suggested_num_destinations: interpretation.constraints.suggested_num_destinations,
        topic: userMessage,
      };

      // Step 3: Perform web searches
      const searchResults = await this.searchClient.searchMultiple(queries, 5, costTracker);
      this.logger.info(`Completed ${searchResults.length} searches`);

      // Log search results summary
      await this.logger.logTelemetry(this.db, tripId, 'search_results', {
        details: {
          total_results: searchResults.reduce((sum, r) => sum + r.results.length, 0),
          by_query: searchResults.map(r => ({ query: r.query, count: r.results.length })),
        },
      });

      await this.logger.logUserProgress(this.db, tripId, 'Extracting detailed content...', 40);

      // Step 3b: Enrich top search results with Firecrawl
      const enrichedResults = await this.enrichSearchResults(searchResults, costTracker, tripId);

      await this.logger.logUserProgress(this.db, tripId, 'Analyzing results...', 50);

      // Step 4: Generate and store research summary
      const researchSummary = await this.generateResearchSummary(
        queries,
        enrichedResults,
        template,
        context,
        costTracker,
        tripId
      );
      await this.db.updateResearchSummary(tripId, researchSummary);

      await this.logger.logUserProgress(this.db, tripId, 'Identifying destinations...', 60);

      // Step 5: Synthesize results with AI (using enriched content)
      const destinations = await this.synthesizeDestinations(
        template,
        context,
        enrichedResults,
        costTracker,
        tripId
      );

      await this.logger.logUserProgress(this.db, tripId, 'Preparing recommendations...', 80);

      // Step 5: Store research destinations
      await this.db.updateResearchDestinations(tripId, destinations);

      // Step 6: Generate confirmation prompt
      const confirmationPrompt = this.templateEngine.buildDestinationConfirmation(template, context);
      const aiResponse = await this.generateConfirmationMessage(
        destinations,
        confirmationPrompt,
        costTracker,
        tripId
      );

      await this.logger.logUserProgress(this.db, tripId, 'Recommendations ready!', 100);
      await this.db.updateTripStatus(tripId, 'awaiting_confirmation');

      return {
        destinations,
        aiResponse,
      };
    } catch (error) {
      this.logger.error(`Research failed for trip ${tripId}: ${error}`);
      await this.db.updateTripStatus(tripId, 'chat', 'Research failed. Please try again.', 0);
      throw error;
    }
  }

  /**
   * Synthesize destinations from search results using AI
   */
  private async synthesizeDestinations(
    template: TripTemplate,
    context: any,
    enrichedResults: EnrichedSearchResult[],
    costTracker: CostTracker,
    tripId: string
  ): Promise<Destination[]> {
    // Build synthesis prompt
    const synthesisPrompt = this.templateEngine.buildResearchSynthesis(template, context);
    const criteriaPrompt = this.templateEngine.buildDestinationCriteria(template, context);

    // Concatenate search results into context (including enriched content)
    let searchContext = 'Web search results:\n\n';
    enrichedResults.forEach((response, index) => {
      searchContext += `Query ${index + 1}: "${response.query}"\n`;
      response.results.forEach((result, resultIndex) => {
        searchContext += `${resultIndex + 1}. ${result.title}\n`;
        searchContext += `   Summary: ${result.snippet}\n`;
        if (result.enrichedContent) {
          searchContext += `   Full content:\n   ${result.enrichedContent.substring(0, 1500)}\n`;
        }
        searchContext += `   Source: ${result.url}\n\n`;
      });
      searchContext += '\n';
    });

    // Build geographic constraint from any location-related field
    const geoFocus = context.geographic_focus || context.region || context.destination || context.location;
    let regionConstraint = '';
    if (geoFocus) {
      regionConstraint = `\nCRITICAL GEOGRAPHIC CONSTRAINT: All destinations MUST be located in or near "${geoFocus}". Do NOT suggest locations in other countries or regions. The user specifically wants to travel to ${geoFocus}.\n`;
    }

    // Determine number of destinations
    const numDestinations = context.suggested_num_destinations || 3;

    // Build user context summary (filter out internal fields)
    const systemFields = ['departure_airport', 'luxury_level', 'activity_level', 'duration', 'travelers_adults', 'travelers_children', 'suggested_num_destinations'];
    const userContextSummary = Object.entries(context)
      .filter(([key, value]) => value && !systemFields.includes(key))
      .map(([key, value]) => `- ${key}: ${value}`)
      .join('\n');

    // Build full prompt
    const fullPrompt = `${criteriaPrompt}
${regionConstraint}
${synthesisPrompt}

User's request context:
${userContextSummary}

${searchContext}

IMPORTANT: Your response must be ONLY a valid JSON array of destinations. No additional text or explanation.
${geoFocus ? `All destinations MUST be in ${geoFocus} - do not suggest locations in other countries or regions.` : ''}

Format:
[
  {
    "name": "City/Town Name",
    "geographic_context": "Region/Country (e.g., 'County Cork, Ireland')",
    "key_sites": ["Site 1", "Site 2", "Site 3"],
    "travel_logistics_note": "Nearest airport, travel tips",
    "rationale": "Why this destination is relevant to the user's request",
    "estimated_days": 3
  }
]

Generate exactly ${numDestinations} destinations that match the user's request.`;

    this.logger.info(`Synthesis prompt context: ${JSON.stringify(context)}`);

    // Use the geographic focus we already determined
    const geographicFocus = geoFocus ? `Focus exclusively on destinations in ${geoFocus}.` : '';

    // Call AI
    const aiResponse = await this.aiProvider.generate(
      {
        prompt: fullPrompt,
        systemPrompt: `You are a ${template.name} travel research assistant. Respond ONLY with valid JSON arrays, no additional text. ${geographicFocus}`,
        maxTokens: 2000,
        temperature: 0.7,
      },
      costTracker
    );

    // Log extracted context dynamically (filter out system fields)
    const extractedContextForLog: Record<string, any> = {};
    const logSystemFields = ['departure_airport', 'luxury_level', 'activity_level', 'duration', 'travelers_adults', 'travelers_children', 'departure_date', 'suggested_num_destinations', 'topic'];
    Object.keys(context).forEach(key => {
      if (!logSystemFields.includes(key) && context[key]) {
        extractedContextForLog[key] = context[key];
      }
    });

    await this.logger.logTelemetry(this.db, tripId, 'destination_synthesis', {
      provider: aiResponse.provider,
      model: aiResponse.model,
      tokens: aiResponse.totalTokens,
      cost: aiResponse.cost,
      details: {
        extracted_context: extractedContextForLog,
        geographic_focus: geoFocus || 'none',
        num_destinations_requested: numDestinations,
        search_results_count: enrichedResults.reduce((sum, r) => sum + r.results.length, 0),
      },
    });

    // Parse JSON response
    try {
      // Extract JSON from response (handle cases where AI adds markdown or explanation)
      let jsonText = aiResponse.text.trim();
      const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      const destinations = JSON.parse(jsonText) as Destination[];

      if (!Array.isArray(destinations) || destinations.length === 0) {
        throw new Error('AI returned invalid destinations array');
      }

      this.logger.info(`Synthesized ${destinations.length} destinations`);
      return destinations;
    } catch (error) {
      this.logger.error(`Failed to parse AI destination response: ${error}\nResponse: ${aiResponse.text}`);
      throw new Error('Failed to synthesize destinations from AI response');
    }
  }

  /**
   * Generate user-facing confirmation message
   */
  private async generateConfirmationMessage(
    destinations: Destination[],
    confirmationPrompt: string,
    costTracker: CostTracker,
    tripId: string
  ): Promise<string> {
    const destinationsText = destinations.map((dest, index) => {
      return `${index + 1}. **${dest.name}** (${dest.geographic_context})
   - Key sites: ${dest.key_sites.join(', ')}
   - Why: ${dest.rationale}
   - Estimated duration: ${dest.estimated_days} days`;
    }).join('\n\n');

    const prompt = `${confirmationPrompt}

Here are the recommended destinations:

${destinationsText}

Generate a friendly, conversational message presenting these destinations to the user and asking for confirmation.`;

    const aiResponse = await this.aiProvider.generate(
      {
        prompt,
        systemPrompt: 'You are a friendly travel assistant helping users plan heritage trips.',
        maxTokens: 500,
        temperature: 0.8,
      },
      costTracker
    );

    await this.logger.logTelemetry(this.db, tripId, 'confirmation_message', {
      provider: aiResponse.provider,
      model: aiResponse.model,
      tokens: aiResponse.totalTokens,
      cost: aiResponse.cost,
    });

    return aiResponse.text;
  }

  /**
   * Generate research summary from search results
   */
  private async generateResearchSummary(
    queries: string[],
    enrichedResults: EnrichedSearchResult[],
    _template: TripTemplate,
    context: any,
    costTracker: CostTracker,
    tripId: string
  ): Promise<ResearchSummary> {
    // Extract unique sources from search results
    const sourcesMap = new Map<string, { title: string; url: string }>();
    enrichedResults.forEach((response) => {
      response.results.forEach((result) => {
        if (!sourcesMap.has(result.url)) {
          sourcesMap.set(result.url, { title: result.title, url: result.url });
        }
      });
    });
    const sources = Array.from(sourcesMap.values()).slice(0, 8); // Top 8 sources

    // Build summary prompt (use enriched content when available)
    const searchContext = enrichedResults.map((response) => {
      return response.results.map((r) => {
        if (r.enrichedContent) {
          return `- ${r.title}:\n  ${r.enrichedContent.substring(0, 500)}`;
        }
        return `- ${r.title}: ${r.snippet}`;
      }).join('\n');
    }).join('\n\n');

    // Get theme name for context
    const themeName = _template.name || 'travel';

    const prompt = `You are a ${themeName} research specialist. Based on the following web search results about "${context.topic || context.surname || context.destination || 'this topic'}", write a comprehensive 3-4 paragraph summary.

User's query: "${context.topic || context.surname || 'travel planning'}"
Theme: ${themeName}

Search queries used: ${queries.join(', ')}

Key findings from research:
${searchContext}

Write a detailed, informative summary that:
1. **Background/History**: Provide relevant historical or cultural context about the topic (e.g., for heritage trips: surname origins, clan history, notable ancestors, historical significance)
2. **Geographic Relevance**: List the most relevant regions, cities, or areas connected to this topic with specific place names
3. **Key Attractions**: Mention specific sites, museums, archives, or experiences that would be valuable to visit
4. **Practical Insights**: Include any useful travel tips, best times to visit, or local knowledge

Be specific with place names and facts. This summary helps the traveler understand what they'll discover before seeing destination recommendations.`;

    const aiResponse = await this.aiProvider.generate(
      {
        prompt,
        systemPrompt: 'You are a friendly travel research assistant. Write concise, engaging summaries.',
        maxTokens: 400,
        temperature: 0.7,
      },
      costTracker
    );

    await this.logger.logTelemetry(this.db, tripId, 'research_summary', {
      provider: aiResponse.provider,
      model: aiResponse.model,
      tokens: aiResponse.totalTokens,
      cost: aiResponse.cost,
    });

    return {
      queries,
      sources,
      summary: aiResponse.text,
    };
  }

  /**
   * Extract context from user message using AI for template-specific placeholders
   */
  private async extractContextWithAI(
    userMessage: string,
    template: TripTemplate,
    preferences: TripPreferences | undefined,
    costTracker: CostTracker,
    tripId: string
  ): Promise<any> {
    // Start with basic regex extraction for backward compatibility
    // Pass template so extraction only happens for placeholders the template actually uses
    const baseContext = this.templateEngine.extractContext(userMessage, preferences, template);

    // Get template-specific placeholders
    const placeholders = this.templateEngine.extractPlaceholders(template);

    if (placeholders.length === 0) {
      // No template-specific placeholders, use basic extraction
      return baseContext;
    }

    this.logger.info(`Extracting ${placeholders.length} placeholders with AI: ${placeholders.join(', ')}`);

    // Build extraction prompt
    const extractionPrompt = this.templateEngine.buildContextExtractionPrompt(
      template,
      placeholders,
      userMessage
    );

    try {
      // Call AI to extract context
      const aiResponse = await this.aiProvider.generate(
        {
          prompt: extractionPrompt,
          systemPrompt: 'You are a precise data extraction assistant. Extract only what is explicitly mentioned. Respond with valid JSON only.',
          maxTokens: 200,
          temperature: 0.1, // Low temperature for consistent extraction
        },
        costTracker
      );

      await this.logger.logTelemetry(this.db, tripId, 'context_extraction', {
        provider: aiResponse.provider,
        model: aiResponse.model,
        tokens: aiResponse.totalTokens,
        cost: aiResponse.cost,
        details: { placeholders: placeholders.join(', ') },
      });

      // Parse AI response
      const jsonMatch = aiResponse.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extracted = JSON.parse(jsonMatch[0]);

        // Merge AI-extracted values with base context (AI values take precedence)
        const mergedContext = { ...baseContext };
        for (const [key, value] of Object.entries(extracted)) {
          if (value !== null && value !== 'null' && value !== '') {
            mergedContext[key] = value;
          }
        }

        // Also add the raw user message as 'topic' for fallback
        mergedContext.topic = userMessage;

        this.logger.info(`AI extracted context: ${JSON.stringify(mergedContext)}`);
        return mergedContext;
      }
    } catch (error) {
      this.logger.error(`AI context extraction failed: ${error}`);
      // Fall back to basic extraction + topic
    }

    // Fallback: use basic extraction plus raw message as topic
    return {
      ...baseContext,
      topic: userMessage,
    };
  }

  /**
   * Enrich search results by scraping top URLs with Firecrawl
   * Takes top 2 URLs per query and extracts full content
   */
  private async enrichSearchResults(
    searchResults: SearchResponse[],
    costTracker: CostTracker,
    tripId: string
  ): Promise<EnrichedSearchResult[]> {
    if (!this.firecrawlClient) {
      this.logger.debug('Firecrawl not available, using search snippets only');
      return searchResults.map(r => ({
        query: r.query,
        results: r.results.map(result => ({
          title: result.title,
          url: result.url,
          snippet: result.snippet,
        })),
      }));
    }

    const urlsToScrape: string[] = [];
    const urlToQueryMap = new Map<string, number>();

    // OPTIMIZATION: Limit to 3 URLs total (down from 2 per query = ~6 total)
    // This reduces Firecrawl scraping time significantly
    const MAX_URLS_TO_SCRAPE = 3;

    // Collect top 1 URL per query, then fill remaining slots
    searchResults.forEach((response, queryIndex) => {
      if (urlsToScrape.length < MAX_URLS_TO_SCRAPE && response.results.length > 0) {
        const result = response.results[0];
        if (!urlsToScrape.includes(result.url)) {
          urlsToScrape.push(result.url);
          urlToQueryMap.set(result.url, queryIndex);
        }
      }
    });

    // Fill remaining slots with second results from queries
    if (urlsToScrape.length < MAX_URLS_TO_SCRAPE) {
      searchResults.forEach((response, queryIndex) => {
        if (urlsToScrape.length >= MAX_URLS_TO_SCRAPE) return;
        if (response.results.length > 1) {
          const result = response.results[1];
          if (!urlsToScrape.includes(result.url)) {
            urlsToScrape.push(result.url);
            urlToQueryMap.set(result.url, queryIndex);
          }
        }
      });
    }

    this.logger.info(`Enriching ${urlsToScrape.length} URLs with Firecrawl...`);

    // Scrape URLs in parallel (with concurrency limit and telemetry)
    const scrapeResults = await this.firecrawlClient.scrapeMultiple(
      urlsToScrape,
      { formats: ['markdown'], onlyMainContent: true },
      costTracker,
      3,  // Concurrency limit
      { db: this.db, tripId }  // Telemetry context
    );

    // Build map of URL to scraped content
    const contentMap = new Map<string, string>();
    scrapeResults.forEach(result => {
      if (result.success && result.markdown) {
        const summary = FirecrawlClient.extractSummary(result.markdown, 2000);
        contentMap.set(result.url, summary);
      }
    });

    // Log enrichment results
    const successCount = scrapeResults.filter(r => r.success).length;
    await this.logger.logTelemetry(this.db, tripId, 'content_enrichment', {
      provider: 'Firecrawl',
      details: {
        urls_scraped: urlsToScrape.length,
        successful: successCount,
        failed: urlsToScrape.length - successCount,
      },
    });

    // Build enriched results
    return searchResults.map(response => ({
      query: response.query,
      results: response.results.map(result => ({
        title: result.title,
        url: result.url,
        snippet: result.snippet,
        enrichedContent: contentMap.get(result.url),
      })),
    }));
  }

  /**
   * Handle user refinement request (add/remove/modify destinations)
   */
  async handleRefinement(
    tripId: string,
    userMessage: string,
    currentDestinations: Destination[],
    template: TripTemplate
  ): Promise<ResearchResult> {
    const costTracker = createCostTracker(this.db, this.logger, tripId);

    await this.logger.logUserProgress(this.db, tripId, 'Updating destinations...', 50);

    // Use AI to interpret refinement request
    const prompt = `The user has requested changes to their trip destinations.

Current destinations:
${JSON.stringify(currentDestinations, null, 2)}

User request: "${userMessage}"

IMPORTANT: Respond with ONLY a valid JSON object in this format:
{
  "action": "add" | "remove" | "replace" | "keep",
  "destinations": [ /* Updated array of Destination objects */ ],
  "message": "Friendly explanation of changes made"
}`;

    const aiResponse = await this.aiProvider.generate(
      {
        prompt,
        systemPrompt: 'You are a travel assistant. Respond ONLY with valid JSON, no additional text.',
        maxTokens: 2000,
        temperature: 0.7,
      },
      costTracker
    );

    try {
      const jsonMatch = aiResponse.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');

      const result = JSON.parse(jsonMatch[0]) as {
        action: string;
        destinations: Destination[];
        message: string;
      };

      // Update research destinations
      await this.db.updateResearchDestinations(tripId, result.destinations);
      await this.db.updateTripStatus(tripId, 'awaiting_confirmation', 'Destinations updated!', 100);

      return {
        destinations: result.destinations,
        aiResponse: result.message,
      };
    } catch (error) {
      this.logger.error(`Failed to parse refinement response: ${error}`);
      throw new Error('Failed to process your request. Please try rephrasing.');
    }
  }
}

/**
 * Create research service
 */
export function createResearchService(env: Env, db: DatabaseClient, logger: Logger): ResearchService {
  return new ResearchService(env, db, logger);
}
