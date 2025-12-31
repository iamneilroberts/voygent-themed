/**
 * AI Provider System with Database-Driven Model Selection
 * VoyGent V3 - Dynamic Model Configuration
 *
 * Features:
 * - Model configs stored in ai_models table
 * - Usage logging to ai_usage_logs table
 * - Dynamic model selection per request
 * - Automatic fallback chain
 */
/**
 * Fallback model configs (used when database not available)
 */
const FALLBACK_MODELS = {
    'llama-3.1-8b': {
        id: 'llama-3.1-8b',
        provider: 'openrouter',
        model_id: 'meta-llama/llama-3.1-8b-instruct',
        display_name: 'Llama 3.1 8B',
        input_cost_per_m: 0.02,
        output_cost_per_m: 0.03,
        context_length: 131072,
        score_speed: 8,
        score_quality: 7,
        is_active: true,
        is_default: true,
        priority: 20,
    },
    'llama-3.2-3b': {
        id: 'llama-3.2-3b',
        provider: 'openrouter',
        model_id: 'meta-llama/llama-3.2-3b-instruct',
        display_name: 'Llama 3.2 3B',
        input_cost_per_m: 0.02,
        output_cost_per_m: 0.02,
        context_length: 131072,
        score_speed: 9,
        score_quality: 6,
        is_active: true,
        is_default: false,
        priority: 10,
    },
    'gemma-3-4b': {
        id: 'gemma-3-4b',
        provider: 'openrouter',
        model_id: 'google/gemma-3-4b-it',
        display_name: 'Gemma 3 4B',
        input_cost_per_m: 0.017,
        output_cost_per_m: 0.068,
        context_length: 96000,
        score_speed: 9,
        score_quality: 7,
        is_active: true,
        is_default: false,
        priority: 8,
    },
    'gemma-3-12b': {
        id: 'gemma-3-12b',
        provider: 'openrouter',
        model_id: 'google/gemma-3-12b-it',
        display_name: 'Gemma 3 12B',
        input_cost_per_m: 0.03,
        output_cost_per_m: 0.10,
        context_length: 131072,
        score_speed: 7,
        score_quality: 8,
        is_active: true,
        is_default: false,
        priority: 28,
    },
    'mistral-small-3.1': {
        id: 'mistral-small-3.1',
        provider: 'openrouter',
        model_id: 'mistralai/mistral-small-3.1-24b-instruct',
        display_name: 'Mistral Small 3.1 24B',
        input_cost_per_m: 0.03,
        output_cost_per_m: 0.11,
        context_length: 131072,
        score_speed: 7,
        score_quality: 8,
        is_active: true,
        is_default: false,
        priority: 30,
    },
    'gemini-flash-free': {
        id: 'gemini-flash-free',
        provider: 'openrouter',
        model_id: 'google/gemini-2.0-flash-exp:free',
        display_name: 'Gemini Flash (Free)',
        input_cost_per_m: 0,
        output_cost_per_m: 0,
        context_length: 1048576,
        score_speed: 9,
        score_quality: 8,
        is_active: true,
        is_default: false,
        priority: 5,
    },
    'mistral-small-free': {
        id: 'mistral-small-free',
        provider: 'openrouter',
        model_id: 'mistralai/mistral-small-3.1-24b-instruct:free',
        display_name: 'Mistral Small (Free)',
        input_cost_per_m: 0,
        output_cost_per_m: 0,
        context_length: 128000,
        score_speed: 7,
        score_quality: 8,
        is_active: true,
        is_default: false,
        priority: 6,
    },
    'llama-3.2-3b-free': {
        id: 'llama-3.2-3b-free',
        provider: 'openrouter',
        model_id: 'meta-llama/llama-3.2-3b-instruct:free',
        display_name: 'Llama 3.2 3B (Free)',
        input_cost_per_m: 0,
        output_cost_per_m: 0,
        context_length: 131072,
        score_speed: 9,
        score_quality: 6,
        is_active: true,
        is_default: false,
        priority: 7,
    },
    'qwen3-8b': {
        id: 'qwen3-8b',
        provider: 'openrouter',
        model_id: 'qwen/qwen3-8b',
        display_name: 'Qwen3 8B',
        input_cost_per_m: 0.028,
        output_cost_per_m: 0.11,
        context_length: 128000,
        score_speed: 8,
        score_quality: 7,
        is_active: true,
        is_default: false,
        priority: 25,
    },
    'gemini-flash-lite': {
        id: 'gemini-flash-lite',
        provider: 'openrouter',
        model_id: 'google/gemini-2.0-flash-lite-001',
        display_name: 'Gemini 2.0 Flash Lite',
        input_cost_per_m: 0.075,
        output_cost_per_m: 0.30,
        context_length: 1048576,
        score_speed: 9,
        score_quality: 8,
        is_active: true,
        is_default: false,
        priority: 35,
    },
};
/**
 * AI Provider Manager with Database-Driven Model Selection
 */
export class AIProviderManager {
    env;
    logger;
    db;
    openrouterKey;
    constructor(env, logger) {
        this.env = env;
        this.logger = logger;
        this.db = env.DB || null;
        this.openrouterKey = env.OPENROUTER_API_KEY || null;
        if (!this.openrouterKey) {
            logger.warn('OPENROUTER_API_KEY not configured');
        }
    }
    /**
     * Get model config from database or fallback
     */
    async getModelConfig(modelId) {
        // If specific model requested, try to get it
        if (modelId && this.db) {
            try {
                const result = await this.db.prepare('SELECT * FROM ai_models WHERE id = ? AND is_active = TRUE').bind(modelId).first();
                if (result) {
                    this.logger.debug(`Loaded model config from DB: ${result.display_name}`);
                    return result;
                }
            }
            catch (error) {
                this.logger.warn(`Failed to load model from DB: ${error}`);
            }
        }
        // If specific model requested but not in DB, check fallback
        if (modelId && FALLBACK_MODELS[modelId]) {
            this.logger.debug(`Using fallback config for: ${modelId}`);
            return FALLBACK_MODELS[modelId];
        }
        // Try to get default from database
        if (this.db) {
            try {
                const result = await this.db.prepare('SELECT * FROM ai_models WHERE is_default = TRUE AND is_active = TRUE LIMIT 1').first();
                if (result) {
                    this.logger.debug(`Using default model from DB: ${result.display_name}`);
                    return result;
                }
            }
            catch (error) {
                this.logger.warn(`Failed to load default model from DB: ${error}`);
            }
        }
        // Final fallback: llama-3.1-8b
        this.logger.debug('Using hardcoded fallback: llama-3.1-8b');
        return FALLBACK_MODELS['llama-3.1-8b'];
    }
    /**
     * Log AI usage to database
     */
    async logUsage(params) {
        if (!this.db)
            return;
        const inputCost = (params.inputTokens / 1000000) * params.modelConfig.input_cost_per_m;
        const outputCost = (params.outputTokens / 1000000) * params.modelConfig.output_cost_per_m;
        const totalCost = inputCost + outputCost;
        const tokensPerSecond = params.durationMs > 0
            ? ((params.inputTokens + params.outputTokens) / params.durationMs) * 1000
            : 0;
        try {
            await this.db.prepare(`
        INSERT INTO ai_usage_logs (
          trip_id, task_type, provider, model_id, model_display_name,
          input_tokens, output_tokens, total_tokens,
          input_cost, output_cost, total_cost,
          duration_ms, tokens_per_second,
          prompt_length, response_length, temperature, max_tokens,
          success, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(params.tripId || null, params.taskType, params.modelConfig.provider, params.modelConfig.model_id, params.modelConfig.display_name, params.inputTokens, params.outputTokens, params.inputTokens + params.outputTokens, inputCost, outputCost, totalCost, params.durationMs, tokensPerSecond, params.promptLength, params.responseLength, params.temperature || 0.7, params.maxTokens || 2000, params.success ? 1 : 0, params.errorMessage || null).run();
            this.logger.debug(`Logged AI usage: ${params.taskType} - $${totalCost.toFixed(6)}`);
        }
        catch (error) {
            this.logger.warn(`Failed to log AI usage: ${error}`);
        }
    }
    /**
     * Generate AI response with specific or default model
     */
    async generate(request, options) {
        if (!this.openrouterKey) {
            throw new Error('OpenRouter API key not configured');
        }
        const modelConfig = await this.getModelConfig(options?.modelId);
        const startTime = Date.now();
        const taskType = options?.taskType || 'unknown';
        this.logger.info(`AI request [${taskType}] using ${modelConfig.display_name} (${modelConfig.model_id})`);
        try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.openrouterKey}`,
                    'HTTP-Referer': 'https://voygent.app',
                    'X-Title': 'VoyGent V3',
                },
                body: JSON.stringify({
                    model: modelConfig.model_id,
                    messages: [
                        ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
                        { role: 'user', content: request.prompt },
                    ],
                    max_tokens: request.maxTokens || 2000,
                    temperature: request.temperature || 0.7,
                }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
            }
            const data = await response.json();
            const inputTokens = data.usage?.prompt_tokens || 0;
            const outputTokens = data.usage?.completion_tokens || 0;
            const text = data.choices?.[0]?.message?.content || '';
            const durationMs = Date.now() - startTime;
            // Calculate cost
            const inputCost = (inputTokens / 1000000) * modelConfig.input_cost_per_m;
            const outputCost = (outputTokens / 1000000) * modelConfig.output_cost_per_m;
            const cost = inputCost + outputCost;
            this.logger.info(`✓ ${modelConfig.display_name} completed in ${durationMs}ms - ` +
                `${inputTokens + outputTokens} tokens, $${cost.toFixed(6)}`);
            // Log usage to database
            await this.logUsage({
                tripId: options?.tripId,
                taskType,
                modelConfig,
                inputTokens,
                outputTokens,
                durationMs,
                promptLength: request.prompt.length + (request.systemPrompt?.length || 0),
                responseLength: text.length,
                temperature: request.temperature,
                maxTokens: request.maxTokens,
                success: true,
            });
            // Track cost if tracker provided (for backward compatibility)
            if (options?.costTracker) {
                await options.costTracker.trackAICost(modelConfig.provider, modelConfig.model_id, inputTokens, outputTokens, modelConfig.input_cost_per_m / 1000, // Convert to per-1k
                modelConfig.output_cost_per_m / 1000);
            }
            return {
                text,
                inputTokens,
                outputTokens,
                totalTokens: inputTokens + outputTokens,
                cost,
                provider: modelConfig.provider,
                model: modelConfig.model_id,
                durationMs,
            };
        }
        catch (error) {
            const durationMs = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Log failed attempt
            await this.logUsage({
                tripId: options?.tripId,
                taskType,
                modelConfig,
                inputTokens: 0,
                outputTokens: 0,
                durationMs,
                promptLength: request.prompt.length + (request.systemPrompt?.length || 0),
                responseLength: 0,
                temperature: request.temperature,
                maxTokens: request.maxTokens,
                success: false,
                errorMessage,
            });
            this.logger.error(`✗ ${modelConfig.display_name} failed: ${errorMessage}`);
            throw error;
        }
    }
    /**
     * Get list of available models from database
     */
    async getAvailableModels() {
        if (!this.db) {
            return Object.values(FALLBACK_MODELS);
        }
        try {
            const result = await this.db.prepare('SELECT * FROM ai_models WHERE is_active = TRUE ORDER BY priority ASC').all();
            return result.results || Object.values(FALLBACK_MODELS);
        }
        catch (error) {
            this.logger.warn(`Failed to load models from DB: ${error}`);
            return Object.values(FALLBACK_MODELS);
        }
    }
}
/**
 * Create AI provider manager
 */
export function createAIProviderManager(env, logger) {
    return new AIProviderManager(env, logger);
}
