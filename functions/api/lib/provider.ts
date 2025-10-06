// Provider routing: CHEAP vs SMART based on token threshold

interface ProviderConfig {
  provider: 'openai' | 'anthropic';
  model: string;
  apiKey: string;
}

interface ProviderRequest {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}

interface ProviderResponse {
  content: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

const CHEAP_THRESHOLD = 600; // tokens - switch to SMART above this

// Cost per 1M tokens (rough estimates)
const COSTS = {
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'claude-3-5-sonnet': { input: 3.00, output: 15.00 }
};

function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token
  return Math.ceil(text.length / 4);
}

export function selectProvider(
  contextTokens: number,
  env: any,
  forceMode?: 'cheap' | 'smart'
): ProviderConfig {
  const mode = forceMode || (contextTokens > CHEAP_THRESHOLD ? 'smart' : 'cheap');

  // Prefer OpenAI, fallback to Anthropic
  if (env.OPENAI_API_KEY) {
    return {
      provider: 'openai',
      model: mode === 'cheap' ? 'gpt-4o-mini' : 'gpt-4o',
      apiKey: env.OPENAI_API_KEY
    };
  } else if (env.ANTHROPIC_API_KEY) {
    return {
      provider: 'anthropic',
      model: mode === 'cheap' ? 'claude-3-haiku-20240307' : 'claude-3-5-sonnet-20241022',
      apiKey: env.ANTHROPIC_API_KEY
    };
  }

  throw new Error('No API keys configured (OPENAI_API_KEY or ANTHROPIC_API_KEY)');
}

export async function callProvider(
  config: ProviderConfig,
  request: ProviderRequest
): Promise<ProviderResponse> {
  const { systemPrompt, userPrompt, maxTokens = 2000, temperature = 0.7 } = request;
  const tokensIn = estimateTokens(systemPrompt + userPrompt);

  if (config.provider === 'openai') {
    return callOpenAI(config, systemPrompt, userPrompt, maxTokens, temperature, tokensIn);
  } else {
    return callAnthropic(config, systemPrompt, userPrompt, maxTokens, temperature, tokensIn);
  }
}

async function callOpenAI(
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  temperature: number,
  tokensIn: number
): Promise<ProviderResponse> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: maxTokens,
      temperature
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  const tokensOut = estimateTokens(content);
  const costModel = COSTS[config.model as keyof typeof COSTS] || COSTS['gpt-4o-mini'];
  const costUsd = (tokensIn * costModel.input + tokensOut * costModel.output) / 1_000_000;

  return { content, tokensIn, tokensOut, costUsd };
}

async function callAnthropic(
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  temperature: number,
  tokensIn: number
): Promise<ProviderResponse> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: config.model,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      max_tokens: maxTokens,
      temperature
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.content[0].text;
  const tokensOut = estimateTokens(content);
  const costModel = COSTS[config.model.includes('haiku') ? 'claude-3-haiku' : 'claude-3-5-sonnet'];
  const costUsd = (tokensIn * costModel.input + tokensOut * costModel.output) / 1_000_000;

  return { content, tokensIn, tokensOut, costUsd };
}
