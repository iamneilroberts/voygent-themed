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
import { createCostTracker } from '../lib/cost-tracker';
import { createTemplateEngine } from '../lib/template-engine';
import { createAIProviderManager } from '../lib/ai-providers';
import { createSearchClient } from './search-client';
/**
 * Research Service
 */
export class ResearchService {
    env;
    db;
    logger;
    templateEngine;
    aiProvider;
    searchClient;
    constructor(env, db, logger) {
        this.env = env;
        this.db = db;
        this.logger = logger;
        this.templateEngine = createTemplateEngine();
        this.aiProvider = createAIProviderManager(env, logger);
        this.searchClient = createSearchClient(env, logger);
    }
    /**
     * Perform destination research
     */
    async researchDestinations(request) {
        const { tripId, userMessage, template, preferences } = request;
        const costTracker = createCostTracker(this.db, this.logger, tripId);
        // Update status: researching
        await this.logger.logUserProgress(this.db, tripId, 'Researching destinations...', 10);
        try {
            // Step 1: Extract context from user message and preferences
            const context = this.templateEngine.extractContext(userMessage, preferences);
            this.logger.debug(`Extracted context: ${JSON.stringify(context)}`);
            // Step 2: Build research queries from template
            const queries = this.templateEngine.buildResearchQueries(template, context);
            this.logger.info(`Built ${queries.length} research queries: ${queries.join(', ')}`);
            if (queries.length === 0) {
                throw new Error('No research queries configured in template');
            }
            await this.logger.logUserProgress(this.db, tripId, 'Searching the web for destinations...', 30);
            // Step 3: Perform web searches
            const searchResults = await this.searchClient.searchMultiple(queries, 5, costTracker);
            this.logger.info(`Completed ${searchResults.length} searches`);
            await this.logger.logUserProgress(this.db, tripId, 'Analyzing results...', 50);
            // Step 4: Synthesize results with AI
            const destinations = await this.synthesizeDestinations(template, context, searchResults, costTracker, tripId);
            await this.logger.logUserProgress(this.db, tripId, 'Preparing recommendations...', 80);
            // Step 5: Store research destinations
            await this.db.updateResearchDestinations(tripId, destinations);
            // Step 6: Generate confirmation prompt
            const confirmationPrompt = this.templateEngine.buildDestinationConfirmation(template, context);
            const aiResponse = await this.generateConfirmationMessage(destinations, confirmationPrompt, costTracker, tripId);
            await this.logger.logUserProgress(this.db, tripId, 'Recommendations ready!', 100);
            await this.db.updateTripStatus(tripId, 'awaiting_confirmation');
            return {
                destinations,
                aiResponse,
            };
        }
        catch (error) {
            this.logger.error(`Research failed for trip ${tripId}: ${error}`);
            await this.db.updateTripStatus(tripId, 'chat', 'Research failed. Please try again.', 0);
            throw error;
        }
    }
    /**
     * Synthesize destinations from search results using AI
     */
    async synthesizeDestinations(template, context, searchResults, costTracker, tripId) {
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
        // Build full prompt
        const fullPrompt = `${criteriaPrompt}

${synthesisPrompt}

${searchContext}

IMPORTANT: Your response must be ONLY a valid JSON array of destinations. No additional text or explanation.
Format:
[
  {
    "name": "Destination Name",
    "geographic_context": "Context (e.g., 'Primary origin', 'Cultural center')",
    "key_sites": ["Site 1", "Site 2", "Site 3"],
    "travel_logistics_note": "Optional logistics info",
    "rationale": "Why this destination is relevant",
    "estimated_days": 3
  }
]

Generate 2-4 destinations.`;
        // Call AI
        const aiResponse = await this.aiProvider.generate({
            prompt: fullPrompt,
            systemPrompt: 'You are a heritage travel research assistant. Respond ONLY with valid JSON arrays, no additional text.',
            maxTokens: 2000,
            temperature: 0.7,
        }, costTracker);
        await this.logger.logTelemetry(this.db, tripId, 'destination_synthesis', {
            provider: aiResponse.provider,
            model: aiResponse.model,
            tokens: aiResponse.totalTokens,
            cost: aiResponse.cost,
        });
        // Parse JSON response
        try {
            // Extract JSON from response (handle cases where AI adds markdown or explanation)
            let jsonText = aiResponse.text.trim();
            const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                jsonText = jsonMatch[0];
            }
            const destinations = JSON.parse(jsonText);
            if (!Array.isArray(destinations) || destinations.length === 0) {
                throw new Error('AI returned invalid destinations array');
            }
            this.logger.info(`Synthesized ${destinations.length} destinations`);
            return destinations;
        }
        catch (error) {
            this.logger.error(`Failed to parse AI destination response: ${error}\nResponse: ${aiResponse.text}`);
            throw new Error('Failed to synthesize destinations from AI response');
        }
    }
    /**
     * Generate user-facing confirmation message
     */
    async generateConfirmationMessage(destinations, confirmationPrompt, costTracker, tripId) {
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
        const aiResponse = await this.aiProvider.generate({
            prompt,
            systemPrompt: 'You are a friendly travel assistant helping users plan heritage trips.',
            maxTokens: 500,
            temperature: 0.8,
        }, costTracker);
        await this.logger.logTelemetry(this.db, tripId, 'confirmation_message', {
            provider: aiResponse.provider,
            model: aiResponse.model,
            tokens: aiResponse.totalTokens,
            cost: aiResponse.cost,
        });
        return aiResponse.text;
    }
    /**
     * Handle user refinement request (add/remove/modify destinations)
     */
    async handleRefinement(tripId, userMessage, currentDestinations, template) {
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
        const aiResponse = await this.aiProvider.generate({
            prompt,
            systemPrompt: 'You are a travel assistant. Respond ONLY with valid JSON, no additional text.',
            maxTokens: 2000,
            temperature: 0.7,
        }, costTracker);
        try {
            const jsonMatch = aiResponse.text.match(/\{[\s\S]*\}/);
            if (!jsonMatch)
                throw new Error('No JSON found in response');
            const result = JSON.parse(jsonMatch[0]);
            // Update research destinations
            await this.db.updateResearchDestinations(tripId, result.destinations);
            await this.db.updateTripStatus(tripId, 'awaiting_confirmation', 'Destinations updated!', 100);
            return {
                destinations: result.destinations,
                aiResponse: result.message,
            };
        }
        catch (error) {
            this.logger.error(`Failed to parse refinement response: ${error}`);
            throw new Error('Failed to process your request. Please try rephrasing.');
        }
    }
}
/**
 * Create research service
 */
export function createResearchService(env, db, logger) {
    return new ResearchService(env, db, logger);
}
