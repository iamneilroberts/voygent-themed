/**
 * D1 Database Client
 * VoyGent V3 - Template-Driven Architecture
 *
 * Provides type-safe query builders and data access for trip_templates and themed_trips.
 */

export interface Env {
  DB: D1Database;
  AMADEUS_API_KEY?: string;
  AMADEUS_API_SECRET?: string;
  VIATOR_API_KEY?: string;
  SERPER_API_KEY?: string;
  TAVILY_API_KEY?: string;
  ZAI_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  ADMIN_JWT_SECRET?: string;
}

// Type Definitions (matching data-model.md)

export interface TripTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  search_placeholder: string;
  search_help_text?: string;
  featured: number;

  // Phase 1: Research Prompts
  research_query_template?: string;
  destination_criteria_prompt?: string;
  research_synthesis_prompt?: string;
  destination_confirmation_prompt?: string;

  // Phase 2: Trip Building Prompts
  intake_prompt: string;
  options_prompt: string;
  daily_activity_prompt?: string;

  // API Integration Instructions
  flight_search_instructions?: string;
  hotel_search_instructions?: string;
  tour_search_instructions?: string;

  // Trip Constraints
  number_of_options: number;
  trip_days_min: number;
  trip_days_max: number;
  luxury_levels?: string;  // JSON
  activity_levels?: string;  // JSON

  required_fields?: string;  // JSON
  optional_fields?: string;  // JSON
  example_inputs?: string;  // JSON

  is_active: number;
  created_at: number;
  updated_at: number;
}

export interface ResearchSummary {
  queries: string[];
  sources: { title: string; url: string }[];
  summary: string;
}

export interface ThemedTrip {
  id: string;
  template_id: string;

  // Chat Conversation
  chat_history?: string;  // JSON

  // Phase 1: Research
  research_destinations?: string;  // JSON
  research_summary?: string;  // JSON: ResearchSummary
  destinations_confirmed: number;
  confirmed_destinations?: string;  // JSON

  // User Preferences
  preferences_json?: string;  // JSON

  // Phase 2: Trip Building
  options_json?: string;  // JSON
  selected_option_index?: number;
  final_itinerary?: string;  // JSON
  total_cost_usd?: number;

  // User-Facing Progress
  status: string;
  progress_message?: string;
  progress_percent: number;

  // Admin Telemetry
  ai_cost_usd: number;
  api_cost_usd: number;
  telemetry_logs?: string;  // JSON

  // User Contact
  user_contact_json?: string;  // JSON
  special_requests?: string;

  created_at: number;
  updated_at: number;
}

// Parsed JSON Types

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Destination {
  name: string;
  geographic_context: string;
  key_sites: string[];
  travel_logistics_note?: string;
  rationale: string;
  estimated_days: number;
}

export interface TripPreferences {
  duration?: string;
  travelers_adults?: number;
  travelers_children?: number;
  luxury_level?: 'Budget' | 'Comfort' | 'Luxury';
  activity_level?: 'Relaxed' | 'Moderate' | 'Active';
  departure_airport?: string;
  departure_date?: string;
}

export interface TripOption {
  option_index: number;
  total_cost_usd: number;
  flights: {
    outbound: Flight;
    return: Flight;
  };
  hotels: Hotel[];
  tours: Tour[];
  itinerary_highlights: string;
}

export interface Flight {
  airline: string;
  route: string;
  departure: string;
  arrival: string;
}

export interface Hotel {
  city: string;
  name: string;
  rating: number;
  nights: number;
  cost_per_night_usd: number;
}

export interface Tour {
  city: string;
  name: string;
  duration: string;
  cost_usd: number;
}

export interface TelemetryLog {
  timestamp: number;
  event: string;
  provider?: string;
  model?: string;
  tokens?: number;
  cost?: number;
  duration_ms?: number;
  details?: any;
}

/**
 * Database Client
 */
export class DatabaseClient {
  constructor(private db: D1Database) {}

  // Trip Templates

  async getTemplate(id: string): Promise<TripTemplate | null> {
    return await this.db
      .prepare('SELECT * FROM trip_templates WHERE id = ? AND is_active = 1')
      .bind(id)
      .first<TripTemplate>();
  }

  async getFeaturedTemplates(): Promise<TripTemplate[]> {
    const result = await this.db
      .prepare('SELECT * FROM trip_templates WHERE featured = 1 AND is_active = 1 ORDER BY name')
      .all<TripTemplate>();
    return result.results || [];
  }

  async getAllActiveTemplates(): Promise<TripTemplate[]> {
    const result = await this.db
      .prepare('SELECT * FROM trip_templates WHERE is_active = 1 ORDER BY name')
      .all<TripTemplate>();
    return result.results || [];
  }

  // Themed Trips

  async createTrip(
    id: string,
    templateId: string,
    initialMessage: string,
    preferences?: TripPreferences
  ): Promise<ThemedTrip> {
    const chatHistory: ChatMessage[] = [
      { role: 'user', content: initialMessage, timestamp: Date.now() }
    ];

    await this.db
      .prepare(
        `INSERT INTO themed_trips (
          id, template_id, chat_history, preferences_json, status, progress_message, progress_percent
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        templateId,
        JSON.stringify(chatHistory),
        preferences ? JSON.stringify(preferences) : null,
        'researching',
        'Researching destinations...',
        0
      )
      .run();

    return (await this.getTrip(id))!;
  }

  async getTrip(id: string): Promise<ThemedTrip | null> {
    return await this.db
      .prepare('SELECT * FROM themed_trips WHERE id = ?')
      .bind(id)
      .first<ThemedTrip>();
  }

  async updateTripStatus(
    id: string,
    status: string,
    progressMessage?: string,
    progressPercent?: number
  ): Promise<void> {
    const updates: string[] = ['status = ?', 'updated_at = unixepoch()'];
    const bindings: any[] = [status];

    if (progressMessage !== undefined) {
      updates.push('progress_message = ?');
      bindings.push(progressMessage);
    }

    if (progressPercent !== undefined) {
      updates.push('progress_percent = ?');
      bindings.push(progressPercent);
    }

    bindings.push(id);

    await this.db
      .prepare(`UPDATE themed_trips SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...bindings)
      .run();
  }

  async appendChatMessage(id: string, message: ChatMessage): Promise<void> {
    const trip = await this.getTrip(id);
    if (!trip) throw new Error('Trip not found');

    const chatHistory: ChatMessage[] = trip.chat_history
      ? JSON.parse(trip.chat_history)
      : [];
    chatHistory.push(message);

    await this.db
      .prepare('UPDATE themed_trips SET chat_history = ?, updated_at = unixepoch() WHERE id = ?')
      .bind(JSON.stringify(chatHistory), id)
      .run();
  }

  async updateResearchDestinations(id: string, destinations: Destination[]): Promise<void> {
    await this.db
      .prepare('UPDATE themed_trips SET research_destinations = ?, updated_at = unixepoch() WHERE id = ?')
      .bind(JSON.stringify(destinations), id)
      .run();
  }

  async updateResearchSummary(id: string, summary: ResearchSummary): Promise<void> {
    await this.db
      .prepare('UPDATE themed_trips SET research_summary = ?, updated_at = unixepoch() WHERE id = ?')
      .bind(JSON.stringify(summary), id)
      .run();
  }

  async updatePreferences(id: string, preferences: TripPreferences): Promise<void> {
    await this.db
      .prepare('UPDATE themed_trips SET preferences_json = ?, updated_at = unixepoch() WHERE id = ?')
      .bind(JSON.stringify(preferences), id)
      .run();
  }

  async confirmDestinations(id: string, confirmedDestinations: string[]): Promise<void> {
    const result = await this.db
      .prepare(
        `UPDATE themed_trips SET
          destinations_confirmed = 1,
          confirmed_destinations = ?,
          status = 'building_trip',
          progress_message = 'Building your trip options...',
          updated_at = unixepoch()
        WHERE id = ?`
      )
      .bind(JSON.stringify(confirmedDestinations), id)
      .run();

    // Verify the update succeeded
    if (!result.success) {
      throw new Error(`Failed to confirm destinations: ${result.error}`);
    }
  }

  async updateTripOptions(id: string, options: TripOption[]): Promise<void> {
    await this.db
      .prepare(
        `UPDATE themed_trips SET
          options_json = ?,
          status = 'options_ready',
          progress_message = 'Your trip options are ready!',
          progress_percent = 100,
          updated_at = unixepoch()
        WHERE id = ?`
      )
      .bind(JSON.stringify(options), id)
      .run();
  }

  async selectTripOption(id: string, optionIndex: number): Promise<void> {
    const trip = await this.getTrip(id);
    if (!trip || !trip.options_json) throw new Error('Trip options not ready');

    const options: TripOption[] = JSON.parse(trip.options_json);
    const selectedOption = options.find((opt) => opt.option_index === optionIndex);
    if (!selectedOption) throw new Error('Invalid option index');

    await this.db
      .prepare(
        `UPDATE themed_trips SET
          selected_option_index = ?,
          total_cost_usd = ?,
          status = 'option_selected',
          updated_at = unixepoch()
        WHERE id = ?`
      )
      .bind(optionIndex, selectedOption.total_cost_usd, id)
      .run();
  }

  async addTelemetryLog(id: string, log: TelemetryLog): Promise<void> {
    const trip = await this.getTrip(id);
    if (!trip) throw new Error('Trip not found');

    const telemetryLogs: TelemetryLog[] = trip.telemetry_logs
      ? JSON.parse(trip.telemetry_logs)
      : [];
    telemetryLogs.push(log);

    await this.db
      .prepare('UPDATE themed_trips SET telemetry_logs = ?, updated_at = unixepoch() WHERE id = ?')
      .bind(JSON.stringify(telemetryLogs), id)
      .run();
  }

  async updateCosts(id: string, aiCost: number, apiCost: number): Promise<void> {
    await this.db
      .prepare(
        `UPDATE themed_trips SET
          ai_cost_usd = ai_cost_usd + ?,
          api_cost_usd = api_cost_usd + ?,
          updated_at = unixepoch()
        WHERE id = ?`
      )
      .bind(aiCost, apiCost, id)
      .run();
  }
}

/**
 * Helper to create DatabaseClient from environment
 */
export function createDatabaseClient(env: Env): DatabaseClient {
  return new DatabaseClient(env.DB);
}
