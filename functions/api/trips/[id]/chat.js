/**
 * POST /api/trips/:id/chat
 * Send user message and receive AI response
 * Uses AI to interpret user intent and handle refinement feedback
 */
import { createDatabaseClient } from '../../../lib/db';
import { createLogger } from '../../../lib/logger';
import { createResearchService } from '../../../services/research-service';
import { createAIProviderManager } from '../../../lib/ai-providers';
import { createCostTracker } from '../../../lib/cost-tracker';
export async function onRequestPost(context) {
    const logger = createLogger();
    const db = createDatabaseClient(context.env);
    const tripId = context.params.id;
    try {
        // Parse request body
        const body = await context.request.json();
        if (!body.message || body.message.trim() === '') {
            return new Response(JSON.stringify({ error: 'Message cannot be empty' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        logger.info(`Chat message for trip ${tripId}: "${body.message}"`);
        // Get trip
        const trip = await db.getTrip(tripId);
        if (!trip) {
            return new Response(JSON.stringify({ error: 'Trip not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        // Get template
        const template = await db.getTemplate(trip.template_id);
        if (!template) {
            return new Response(JSON.stringify({ error: 'Template not found' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        // Save user message to chat history
        const userMessage = {
            role: 'user',
            content: body.message,
            timestamp: Date.now(),
        };
        await db.appendChatMessage(tripId, userMessage);
        // Handle message based on current status
        logger.info(`DEBUG: Trip status is "${trip.status}" (type: ${typeof trip.status})`);
        let aiResponse;
        let updatedDestinations;
        if (trip.status === 'researching') {
            // User provided initial context - trigger destination research
            const researchService = createResearchService(context.env, db, logger);
            const result = await researchService.researchDestinations({
                tripId: tripId,
                userMessage: body.message,
                template: template,
                preferences: {}
            });
            aiResponse = result.aiResponse;
            logger.info(`✓ Destination research completed for trip ${tripId} - ${result.destinations.length} destinations found`);
        }
        else if (trip.status === 'awaiting_confirmation') {
            // Use AI to classify user intent
            const aiProvider = createAIProviderManager(context.env, logger);
            const costTracker = createCostTracker(db, logger, tripId);
            const researchDestinations = trip.research_destinations
                ? JSON.parse(trip.research_destinations)
                : [];
            // Build numbered list of destinations for context
            const destinationsList = researchDestinations.map((d, i) => `${i + 1}. ${d.name} (${d.geographic_context || 'location'})`).join('\n');
            // Use AI to classify intent
            const classificationPrompt = `Analyze this user message about their trip destinations and classify their intent.

Current destinations:
${destinationsList}

User message: "${body.message}"

Classify the user's intent as ONE of:
- "confirm": User is happy and wants to proceed (e.g., "yes", "looks good", "perfect", "let's go")
- "refine": User wants to modify the selection (e.g., "Ireland only", "1&2", "skip Seville", "just the first two", "remove #3", "only locations in Spain")
- "question": User is asking a question about the destinations

If intent is "refine", also extract:
- selected_indices: Array of 1-based indices if user specified numbers (e.g., "1&2" → [1,2], "1,2,3" → [1,2,3])
- filter_criteria: Any geographic or thematic filter (e.g., "Ireland only" → "Ireland", "skip Seville" → "exclude Seville")

Respond with ONLY valid JSON:
{
  "intent": "confirm" | "refine" | "question",
  "selected_indices": [1, 2] or null,
  "filter_criteria": "string" or null,
  "explanation": "brief explanation of classification"
}`;
            const classificationResponse = await aiProvider.generate({
                prompt: classificationPrompt,
                systemPrompt: 'You are a precise intent classifier. Respond ONLY with valid JSON.',
                maxTokens: 200,
                temperature: 0.1,
            }, costTracker);
            await logger.logTelemetry(db, tripId, 'intent_classification', {
                provider: classificationResponse.provider,
                model: classificationResponse.model,
                tokens: classificationResponse.totalTokens,
                cost: classificationResponse.cost,
                details: { message: body.message.substring(0, 50) },
            });
            // Parse classification
            let classification;
            try {
                const jsonMatch = classificationResponse.text.match(/\{[\s\S]*\}/);
                if (!jsonMatch)
                    throw new Error('No JSON found');
                classification = JSON.parse(jsonMatch[0]);
            }
            catch {
                // Default to question if parsing fails
                classification = { intent: 'question', explanation: 'Failed to parse, defaulting to question' };
            }
            logger.info(`Intent classification: ${JSON.stringify(classification)}`);
            if (classification.intent === 'confirm') {
                aiResponse = "Great! Your destinations are confirmed. Please click the 'Confirm & Build Trip' button to proceed.";
            }
            else if (classification.intent === 'refine') {
                // Apply refinement based on AI-extracted criteria
                let refinedDestinations = [...researchDestinations];
                // Handle numeric selection (e.g., "1&2")
                if (classification.selected_indices && classification.selected_indices.length > 0) {
                    refinedDestinations = classification.selected_indices
                        .filter(i => i >= 1 && i <= researchDestinations.length)
                        .map(i => researchDestinations[i - 1]);
                    logger.info(`Filtered by indices ${classification.selected_indices}: ${refinedDestinations.map(d => d.name).join(', ')}`);
                }
                // Handle filter criteria (e.g., "Ireland only")
                else if (classification.filter_criteria) {
                    // Use AI to apply the filter
                    const filterPrompt = `Apply this filter to the destinations list.

Destinations:
${JSON.stringify(researchDestinations, null, 2)}

Filter: "${classification.filter_criteria}"
Original user message: "${body.message}"

Return ONLY the destinations that match the filter criteria. Keep the full destination objects intact.
Respond with ONLY a valid JSON array of the filtered destinations.`;
                    const filterResponse = await aiProvider.generate({
                        prompt: filterPrompt,
                        systemPrompt: 'You are a precise filter. Return only a JSON array of matching destinations.',
                        maxTokens: 1500,
                        temperature: 0.1,
                    }, costTracker);
                    await logger.logTelemetry(db, tripId, 'destination_filter', {
                        provider: filterResponse.provider,
                        model: filterResponse.model,
                        tokens: filterResponse.totalTokens,
                        cost: filterResponse.cost,
                        details: { filter: classification.filter_criteria },
                    });
                    try {
                        const jsonMatch = filterResponse.text.match(/\[[\s\S]*\]/);
                        if (jsonMatch) {
                            refinedDestinations = JSON.parse(jsonMatch[0]);
                        }
                    }
                    catch (e) {
                        logger.error(`Failed to parse filtered destinations: ${e}`);
                    }
                }
                // Update the research destinations in database
                if (refinedDestinations.length > 0 && refinedDestinations.length !== researchDestinations.length) {
                    await db.updateResearchDestinations(tripId, refinedDestinations);
                    updatedDestinations = refinedDestinations;
                    // Generate friendly response about the changes
                    const changePrompt = `The user asked to modify their destinations.
Original: ${researchDestinations.map(d => d.name).join(', ')}
New: ${refinedDestinations.map(d => d.name).join(', ')}
User said: "${body.message}"

Write a brief, friendly confirmation of the changes (1-2 sentences). Then ask if they want to proceed or make more changes.`;
                    const changeResponse = await aiProvider.generate({
                        prompt: changePrompt,
                        systemPrompt: 'You are a friendly travel assistant.',
                        maxTokens: 200,
                        temperature: 0.7,
                    }, costTracker);
                    aiResponse = changeResponse.text;
                    await logger.logTelemetry(db, tripId, 'destinations_refined', {
                        details: {
                            original_count: researchDestinations.length,
                            new_count: refinedDestinations.length,
                            removed: researchDestinations.filter(d => !refinedDestinations.find(r => r.name === d.name)).map(d => d.name),
                        },
                    });
                }
                else if (refinedDestinations.length === 0) {
                    aiResponse = "I couldn't find any destinations matching that criteria. Could you please clarify which destinations you'd like to keep?";
                }
                else {
                    aiResponse = "I understand you'd like to make changes. Could you please specify which destinations you'd like to keep? You can say things like '1 and 2' or 'only Ireland locations'.";
                }
            }
            else {
                // Question - provide helpful response
                const questionPrompt = `You are helping a user plan a trip. The current recommended destinations are:

${JSON.stringify(researchDestinations, null, 2)}

User question: "${body.message}"

Provide a helpful, friendly response. If they seem to want changes, remind them they can say things like "just 1 and 2" or "Ireland only" to modify the selection.`;
                const questionResponse = await aiProvider.generate({
                    prompt: questionPrompt,
                    systemPrompt: 'You are a friendly travel assistant.',
                    maxTokens: 500,
                    temperature: 0.8,
                }, costTracker);
                await logger.logTelemetry(db, tripId, 'chat_response', {
                    provider: questionResponse.provider,
                    model: questionResponse.model,
                    tokens: questionResponse.totalTokens,
                    cost: questionResponse.cost,
                    details: { context: 'destination_question', message_preview: body.message.substring(0, 50) },
                });
                aiResponse = questionResponse.text;
            }
        }
        else {
            // General conversation (chat status)
            const aiProvider = createAIProviderManager(context.env, logger);
            const costTracker = createCostTracker(db, logger, tripId);
            const chatHistory = trip.chat_history
                ? JSON.parse(trip.chat_history)
                : [];
            // Build conversation context
            const conversationContext = chatHistory
                .slice(-5) // Last 5 messages
                .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
                .join('\n');
            const prompt = `${template.intake_prompt}

Conversation history:
${conversationContext}

User: ${body.message}

Provide a helpful, friendly response. If the user is ready to see destination recommendations, let them know the research is in progress.`;
            const response = await aiProvider.generate({
                prompt,
                systemPrompt: 'You are a friendly travel assistant helping plan themed trips.',
                maxTokens: 500,
                temperature: 0.8,
            }, costTracker);
            // Log telemetry for this AI call
            await logger.logTelemetry(db, tripId, 'chat_response', {
                provider: response.provider,
                model: response.model,
                tokens: response.totalTokens,
                cost: response.cost,
                details: { context: 'general_chat', message_preview: body.message.substring(0, 50) },
            });
            aiResponse = response.text;
        }
        // Save assistant message to chat history
        const assistantMessage = {
            role: 'assistant',
            content: aiResponse,
            timestamp: Date.now(),
        };
        await db.appendChatMessage(tripId, assistantMessage);
        // Return response
        return new Response(JSON.stringify({
            response: aiResponse,
            status: trip.status,
            updated_destinations: updatedDestinations,
            destinations_changed: !!updatedDestinations,
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    }
    catch (error) {
        logger.error(`Chat failed for trip ${tripId}: ${error}`);
        return new Response(JSON.stringify({ error: 'Failed to process message' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
// CORS preflight
export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
