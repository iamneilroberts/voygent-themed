/**
 * Mock AI provider implementations for testing
 */

export interface ProviderConfig {
  provider: 'openai' | 'anthropic';
  model: string;
  apiKey: string;
  name?: string;
}

export interface ProviderRequest {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ProviderResponse {
  content: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

/**
 * Create a mock callProvider function that returns predefined responses
 * @param fixtureResponses - Map of keys to response content
 */
export function mockCallProvider(fixtureResponses: Record<string, string>) {
  return async (config: ProviderConfig, request: ProviderRequest): Promise<ProviderResponse> => {
    // Match by prompt content to find appropriate fixture
    const key = Object.keys(fixtureResponses).find(k =>
      request.systemPrompt.toLowerCase().includes(k.toLowerCase()) ||
      request.userPrompt.toLowerCase().includes(k.toLowerCase())
    ) || 'default';

    const content = fixtureResponses[key];

    if (!content) {
      throw new Error(`No mock response for key: ${key}`);
    }

    return {
      content,
      tokensIn: estimateTokens(request.systemPrompt + request.userPrompt),
      tokensOut: estimateTokens(content),
      costUsd: 0.001 // Mock cost
    };
  };
}

/**
 * Estimate token count from text (rough approximation)
 */
function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

/**
 * Create a mock provider that throws an error (for testing error handling)
 */
export function createMockProviderError(message: string) {
  return async (): Promise<ProviderResponse> => {
    throw new Error(message);
  };
}
