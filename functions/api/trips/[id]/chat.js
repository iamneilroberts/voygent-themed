/**
 * POST /api/trips/:id/chat
 * Send user message and receive AI response
 * Handles destination confirmation, refinement, and general conversation
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
            // User is confirming or refining destinations
            const lowerMessage = body.message.toLowerCase();
            if (lowerMessage.includes('yes') ||
                lowerMessage.includes('confirm') ||
                lowerMessage.includes('looks good') ||
                lowerMessage.includes('perfect')) {
                // User confirmed - return confirmation message
                aiResponse = "Great! Your destinations are confirmed. Please use the 'Confirm Destinations' button to proceed to trip building.";
            }
            else if (lowerMessage.includes('add') ||
                lowerMessage.includes('remove') ||
                lowerMessage.includes('change') ||
                lowerMessage.includes('different')) {
                // User wants to refine destinations
                const researchDestinations = trip.research_destinations
                    ? JSON.parse(trip.research_destinations)
                    : [];
                const researchService = createResearchService(context.env, db, logger);
                const result = await researchService.handleRefinement(tripId, body.message, researchDestinations, template);
                aiResponse = result.aiResponse;
                updatedDestinations = result.destinations.map(d => d.name);
            }
            else {
                // General question about destinations
                const aiProvider = createAIProviderManager(context.env, logger);
                const costTracker = createCostTracker(db, logger, tripId);
                const researchDestinations = trip.research_destinations
                    ? JSON.parse(trip.research_destinations)
                    : [];
                const prompt = `You are helping a user plan a trip. The current recommended destinations are:

${JSON.stringify(researchDestinations, null, 2)}

User question: "${body.message}"

Provide a helpful, friendly response to their question about these destinations.`;
                const response = await aiProvider.generate({
                    prompt,
                    systemPrompt: 'You are a friendly travel assistant.',
                    maxTokens: 500,
                    temperature: 0.8,
                }, costTracker);
                aiResponse = response.text;
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
