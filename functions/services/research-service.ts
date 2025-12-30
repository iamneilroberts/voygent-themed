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
 * Research Service
 */
export class ResearchService {
  private templateEngine: TemplateEngine;
  private aiProvider: AIProviderManager;
  private searchClient: SearchClient;

  constructor(
    private env: Env,
    private db: DatabaseClient,
    private logger: Logger
  ) {
    this.templateEngine = createTemplateEngine();
    this.aiProvider = createAIProviderManager(env, logger);
    this.searchClient = createSearchClient(env, logger);
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
      // Step 1: Extract context using AI for template-specific placeholders
      const context = await this.extractContextWithAI(
        userMessage,
        template,
        preferences,
        costTracker,
        tripId
      );
      this.logger.debug(`Extracted context: ${JSON.stringify(context)}`);

      // Step 2: Build research queries from template
      const queries = this.templateEngine.buildResearchQueries(template, context);
      this.logger.info(`Built ${queries.length} research queries: ${queries.join(', ')}`);

      if (queries.length === 0) {
        throw new Error('No research queries configured in template');
      }

      // Log the actual queries being executed
      await this.logger.logTelemetry(this.db, tripId, 'search_queries', {
        details: {
          queries: queries,
          extracted_context: context,
        },
      });

      await this.logger.logUserProgress(this.db, tripId, 'Searching the web for destinations...', 30);

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

      await this.logger.logUserProgress(this.db, tripId, 'Analyzing results...', 50);

      // Step 4: Generate and store research summary
      const researchSummary = await this.generateResearchSummary(
        queries,
        searchResults,
        template,
        context,
        costTracker,
        tripId
      );
      await this.db.updateResearchSummary(tripId, researchSummary);

      await this.logger.logUserProgress(this.db, tripId, 'Identifying destinations...', 60);

      // Step 5: Synthesize results with AI
      const destinations = await this.synthesizeDestinations(
        template,
        context,
        searchResults,
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
    searchResults: SearchResponse[],
    costTracker: CostTracker,
    tripId: string
  ): Promise<Destination[]> {
    // Build synthesis prompt
    const synthesisPrompt = this.templateEngine.buildResearchSynthesis(template, context);
    const criteriaPrompt = this.templateEngine.buildDestinationCriteria(template, context);

    // Concatenate search results into context
    let searchContext = 'Web search results:\n\n';
    searchResults.forEach((response, index) => {
      searchContext += `Query ${index + 1}: "${response.query}"\n`;
      response.results.forEach((result, resultIndex) => {
        searchContext += `${resultIndex + 1}. ${result.title}\n   ${result.snippet}\n   ${result.url}\n\n`;
      });
      searchContext += '\n';
    });

    // Build geographic constraint if region was extracted
    let regionConstraint = '';
    if (context.region) {
      regionConstraint = `\nCRITICAL GEOGRAPHIC CONSTRAINT: All destinations MUST be located in or near "${context.region}". Do NOT suggest locations in other countries or regions. The user specifically wants to travel to ${context.region}.\n`;
    }

    // Build user context summary
    const userContextSummary = Object.entries(context)
      .filter(([key, value]) => value && !['departure_airport', 'luxury_level', 'activity_level'].includes(key))
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
${context.region ? `All destinations MUST be in ${context.region} - do not suggest US or other country locations.` : ''}

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

Generate 2-4 destinations that match the user's request.`;

    this.logger.info(`Synthesis prompt context: ${JSON.stringify(context)}`);

    // Call AI
    const aiResponse = await this.aiProvider.generate(
      {
        prompt: fullPrompt,
        systemPrompt: `You are a ${template.name} travel research assistant. Respond ONLY with valid JSON arrays, no additional text. ${context.region ? `Focus exclusively on destinations in ${context.region}.` : ''}`,
        maxTokens: 2000,
        temperature: 0.7,
      },
      costTracker
    );

    await this.logger.logTelemetry(this.db, tripId, 'destination_synthesis', {
      provider: aiResponse.provider,
      model: aiResponse.model,
      tokens: aiResponse.totalTokens,
      cost: aiResponse.cost,
      details: {
        region: context.region || 'not specified',
        surname: context.surname || 'not specified',
        search_results_count: searchResults.reduce((sum, r) => sum + r.results.length, 0),
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
    searchResults: SearchResponse[],
    _template: TripTemplate,
    context: any,
    costTracker: CostTracker,
    tripId: string
  ): Promise<ResearchSummary> {
    // Extract unique sources from search results
    const sourcesMap = new Map<string, { title: string; url: string }>();
    searchResults.forEach((response) => {
      response.results.forEach((result) => {
        if (!sourcesMap.has(result.url)) {
          sourcesMap.set(result.url, { title: result.title, url: result.url });
        }
      });
    });
    const sources = Array.from(sourcesMap.values()).slice(0, 8); // Top 8 sources

    // Build summary prompt
    const searchContext = searchResults.map((response) => {
      return response.results.map((r) => `- ${r.title}: ${r.snippet}`).join('\n');
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
    const baseContext = this.templateEngine.extractContext(userMessage, preferences);

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
