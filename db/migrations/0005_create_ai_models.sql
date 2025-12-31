-- AI Models Configuration and Usage Tracking
-- Enables dynamic model selection and cost/performance analysis

-- AI Model Configurations
CREATE TABLE IF NOT EXISTS ai_models (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,  -- 'openrouter', 'openai', 'zai'
  model_id TEXT NOT NULL,  -- e.g., 'meta-llama/llama-3.2-3b-instruct'
  display_name TEXT NOT NULL,

  -- Pricing (per million tokens)
  input_cost_per_m REAL NOT NULL DEFAULT 0,
  output_cost_per_m REAL NOT NULL DEFAULT 0,

  -- Capabilities
  context_length INTEGER NOT NULL DEFAULT 32000,
  supports_json_mode BOOLEAN DEFAULT FALSE,
  supports_function_calling BOOLEAN DEFAULT FALSE,

  -- Task suitability (1-10 score, higher = better)
  score_speed INTEGER DEFAULT 5,
  score_quality INTEGER DEFAULT 5,
  score_instruction_following INTEGER DEFAULT 5,

  -- Usage settings
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  priority INTEGER DEFAULT 100,  -- Lower = higher priority in fallback chain

  -- Metadata
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- AI Usage Logs for cost and performance analysis
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Context
  trip_id TEXT,
  task_type TEXT NOT NULL,  -- 'interpret_request', 'generate_summary', 'synthesize_destinations', etc.

  -- Model info
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  model_display_name TEXT,

  -- Token usage
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,

  -- Cost (in USD)
  input_cost REAL NOT NULL DEFAULT 0,
  output_cost REAL NOT NULL DEFAULT 0,
  total_cost REAL NOT NULL DEFAULT 0,

  -- Performance
  duration_ms INTEGER NOT NULL DEFAULT 0,
  tokens_per_second REAL,

  -- Request details
  prompt_length INTEGER,
  response_length INTEGER,
  temperature REAL,
  max_tokens INTEGER,

  -- Status
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,

  -- Timestamps
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_trip_id ON ai_usage_logs(trip_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_task_type ON ai_usage_logs(task_type);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_model_id ON ai_usage_logs(model_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON ai_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_models_provider ON ai_models(provider);
CREATE INDEX IF NOT EXISTS idx_ai_models_is_active ON ai_models(is_active);

-- Seed initial model configurations
INSERT OR REPLACE INTO ai_models (id, provider, model_id, display_name, input_cost_per_m, output_cost_per_m, context_length, score_speed, score_quality, score_instruction_following, is_active, is_default, priority, notes) VALUES
  -- Fast & Cheap models
  ('gemma-3-4b', 'openrouter', 'google/gemma-3-4b-it', 'Gemma 3 4B', 0.017, 0.068, 96000, 9, 7, 7, TRUE, FALSE, 8, 'Google Gemma, very fast and cheap.'),
  ('llama-3.2-3b', 'openrouter', 'meta-llama/llama-3.2-3b-instruct', 'Llama 3.2 3B', 0.02, 0.02, 131072, 9, 6, 7, TRUE, FALSE, 10, 'Fastest Llama, cheapest. Good for simple tasks.'),
  ('llama-3.1-8b', 'openrouter', 'meta-llama/llama-3.1-8b-instruct', 'Llama 3.1 8B', 0.02, 0.03, 131072, 8, 7, 8, TRUE, FALSE, 20, 'Good balance of speed and quality. Fallback option.'),
  ('qwen3-8b', 'openrouter', 'qwen/qwen3-8b', 'Qwen3 8B', 0.028, 0.11, 128000, 8, 7, 8, TRUE, FALSE, 25, 'Strong instruction following.'),

  -- Quality models
  ('gemma-3-12b', 'openrouter', 'google/gemma-3-12b-it', 'Gemma 3 12B', 0.03, 0.10, 131072, 7, 8, 8, TRUE, FALSE, 28, 'Google Gemma 12B, good quality.'),
  ('mistral-small-3.1', 'openrouter', 'mistralai/mistral-small-3.1-24b-instruct', 'Mistral Small 3.1 24B', 0.03, 0.11, 131072, 7, 8, 9, TRUE, FALSE, 30, 'Higher quality, good for complex synthesis.'),
  ('gemini-flash-lite', 'openrouter', 'google/gemini-2.0-flash-lite-001', 'Gemini 2.0 Flash Lite', 0.075, 0.30, 1048576, 9, 8, 8, TRUE, TRUE, 1, 'FASTEST (10.7s). Best quality. New default.'),

  -- Free models (for testing - rate limited)
  ('gemini-flash-free', 'openrouter', 'google/gemini-2.0-flash-exp:free', 'Gemini Flash (Free)', 0, 0, 1048576, 9, 8, 8, TRUE, FALSE, 5, 'Free tier - rate limited but fast.'),
  ('mistral-small-free', 'openrouter', 'mistralai/mistral-small-3.1-24b-instruct:free', 'Mistral Small (Free)', 0, 0, 128000, 7, 8, 9, TRUE, FALSE, 6, 'Free tier - rate limited.'),
  ('llama-3.2-3b-free', 'openrouter', 'meta-llama/llama-3.2-3b-instruct:free', 'Llama 3.2 3B (Free)', 0, 0, 131072, 9, 6, 7, TRUE, FALSE, 7, 'Free tier - rate limited.');
