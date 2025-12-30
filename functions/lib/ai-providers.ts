/**
 * AI Provider Fallback Chain
 * VoyGent V3 - Cost Optimization
 *
 * Implements Constitution principle V: API Cost Optimization
 * Primary: Z.AI (llama-3.3-70b) - cheapest
 * Fallback: OpenRouter (claude-3-haiku or llama-3.1-70b)
 * Backup: OpenAI (gpt-4o-mini)
 */

import { Env } from './db';
import { Logger } from './logger';
import { CostTracker } from './cost-tracker';

export interface AIGenerateRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIGenerateResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  provider: string;
  model: string;
}

/**
 * AI Provider Interface
 */
export interface AIProvider {
  name: string;
  model: string;
  costPer1kInputTokens: number;
  costPer1kOutputTokens: number;

  /**
   * Generate AI response
   */
  generate(request: AIGenerateRequest): Promise<AIGenerateResponse>;

  /**
   * Check if provider is available (has API key configured)
   */
  isAvailable(): boolean;
}

/**
 * Z.AI Provider (Primary - Cheapest)
 */
export class ZAIProvider implements AIProvider {
  name = 'Z.AI';
  model = 'llama-3.3-70b';
  costPer1kInputTokens = 0.00006;
  costPer1kOutputTokens = 0.00006;

  constructor(private apiKey: string, private logger: Logger) {}

  async generate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
    const startTime = Date.now();

    try {
      const response = await fetch('https://api.zai.chat/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
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
        throw new Error(`Z.AI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;

      const inputTokens = data.usage?.prompt_tokens || 0;
      const outputTokens = data.usage?.completion_tokens || 0;
      const text = data.choices?.[0]?.message?.content || '';

      const cost = this.calculateCost(inputTokens, outputTokens);
      const duration = Date.now() - startTime;

      this.logger.debug(`Z.AI completed in ${duration}ms - ${inputTokens + outputTokens} tokens, $${cost.toFixed(4)}`);

      return {
        text,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        cost,
        provider: this.name,
        model: this.model,
      };
    } catch (error) {
      this.logger.error(`Z.AI generation failed: ${error}`);
      throw error;
    }
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    return (inputTokens / 1000) * this.costPer1kInputTokens + (outputTokens / 1000) * this.costPer1kOutputTokens;
  }
}

/**
 * OpenRouter Provider (Fallback)
 */
export class OpenRouterProvider implements AIProvider {
  name = 'OpenRouter';
  model = 'anthropic/claude-3-haiku';
  costPer1kInputTokens = 0.00025;
  costPer1kOutputTokens = 0.00125;

  constructor(private apiKey: string, private logger: Logger) {}

  async generate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
    const startTime = Date.now();

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://voygent.app',
          'X-Title': 'VoyGent V3',
        },
        body: JSON.stringify({
          model: this.model,
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

      const data = await response.json() as any;

      const inputTokens = data.usage?.prompt_tokens || 0;
      const outputTokens = data.usage?.completion_tokens || 0;
      const text = data.choices?.[0]?.message?.content || '';

      const cost = this.calculateCost(inputTokens, outputTokens);
      const duration = Date.now() - startTime;

      this.logger.debug(`OpenRouter completed in ${duration}ms - ${inputTokens + outputTokens} tokens, $${cost.toFixed(4)}`);

      return {
        text,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        cost,
        provider: this.name,
        model: this.model,
      };
    } catch (error) {
      this.logger.error(`OpenRouter generation failed: ${error}`);
      throw error;
    }
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    return (inputTokens / 1000) * this.costPer1kInputTokens + (outputTokens / 1000) * this.costPer1kOutputTokens;
  }
}

/**
 * OpenAI Provider (Backup)
 */
export class OpenAIProvider implements AIProvider {
  name = 'OpenAI';
  model = 'gpt-4o-mini';
  costPer1kInputTokens = 0.00015;
  costPer1kOutputTokens = 0.0006;

  constructor(private apiKey: string, private logger: Logger) {}

  async generate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
    const startTime = Date.now();

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
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
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;

      const inputTokens = data.usage?.prompt_tokens || 0;
      const outputTokens = data.usage?.completion_tokens || 0;
      const text = data.choices?.[0]?.message?.content || '';

      const cost = this.calculateCost(inputTokens, outputTokens);
      const duration = Date.now() - startTime;

      this.logger.debug(`OpenAI completed in ${duration}ms - ${inputTokens + outputTokens} tokens, $${cost.toFixed(4)}`);

      return {
        text,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        cost,
        provider: this.name,
        model: this.model,
      };
    } catch (error) {
      this.logger.error(`OpenAI generation failed: ${error}`);
      throw error;
    }
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    return (inputTokens / 1000) * this.costPer1kInputTokens + (outputTokens / 1000) * this.costPer1kOutputTokens;
  }
}

/**
 * AI Provider Manager with Fallback Chain
 */
export class AIProviderManager {
  private providers: AIProvider[] = [];

  constructor(env: Env, private logger: Logger) {
    // Build provider chain in priority order (cheapest first)
    if (env.ZAI_API_KEY) {
      this.providers.push(new ZAIProvider(env.ZAI_API_KEY, logger));
    }
    if (env.OPENROUTER_API_KEY) {
      this.providers.push(new OpenRouterProvider(env.OPENROUTER_API_KEY, logger));
    }
    // Note: OpenAI requires OPENAI_API_KEY (add to Env interface if needed)

    if (this.providers.length === 0) {
      logger.warn('No AI providers configured! Add ZAI_API_KEY or OPENROUTER_API_KEY to environment.');
    } else {
      logger.info(`AI providers configured: ${this.providers.map(p => p.name).join(', ')}`);
    }
  }

  /**
   * Generate AI response with automatic fallback
   */
  async generate(request: AIGenerateRequest, costTracker?: CostTracker): Promise<AIGenerateResponse> {
    const errors: Error[] = [];

    for (const provider of this.providers) {
      if (!provider.isAvailable()) {
        this.logger.debug(`Skipping ${provider.name}: not available`);
        continue;
      }

      try {
        this.logger.info(`Attempting AI generation with ${provider.name} (${provider.model})...`);
        const response = await provider.generate(request);

        // Track cost if tracker provided
        if (costTracker) {
          await costTracker.trackAICost(
            provider.name,
            provider.model,
            response.inputTokens,
            response.outputTokens,
            provider.costPer1kInputTokens,
            provider.costPer1kOutputTokens
          );
        }

        this.logger.info(`✓ ${provider.name} succeeded - ${response.totalTokens} tokens, $${response.cost.toFixed(4)}`);
        return response;
      } catch (error) {
        this.logger.warn(`✗ ${provider.name} failed: ${error}`);
        errors.push(error as Error);
        // Continue to next provider
      }
    }

    // All providers failed
    const errorMsg = `All AI providers failed: ${errors.map(e => e.message).join('; ')}`;
    this.logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  /**
   * Get list of available providers
   */
  getAvailableProviders(): string[] {
    return this.providers.filter(p => p.isAvailable()).map(p => `${p.name} (${p.model})`);
  }
}

/**
 * Create AI provider manager
 */
export function createAIProviderManager(env: Env, logger: Logger): AIProviderManager {
  return new AIProviderManager(env, logger);
}
