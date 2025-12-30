/**
 * D1 Database Client
 * VoyGent V3 - Template-Driven Architecture
 *
 * Provides type-safe query builders and data access for trip_templates and themed_trips.
 */
/**
 * Database Client
 */
export class DatabaseClient {
    db;
    constructor(db) {
        this.db = db;
    }
    // Trip Templates
    async getTemplate(id) {
        return await this.db
            .prepare('SELECT * FROM trip_templates WHERE id = ? AND is_active = 1')
            .bind(id)
            .first();
    }
    async getFeaturedTemplates() {
        const result = await this.db
            .prepare('SELECT * FROM trip_templates WHERE featured = 1 AND is_active = 1 ORDER BY name')
            .all();
        return result.results || [];
    }
    async getAllActiveTemplates() {
        const result = await this.db
            .prepare('SELECT * FROM trip_templates WHERE is_active = 1 ORDER BY name')
            .all();
        return result.results || [];
    }
    // Themed Trips
    async createTrip(id, templateId, initialMessage, preferences) {
        const chatHistory = [
            { role: 'user', content: initialMessage, timestamp: Date.now() }
        ];
        await this.db
            .prepare(`INSERT INTO themed_trips (
          id, template_id, chat_history, preferences_json, status, progress_message, progress_percent
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`)
            .bind(id, templateId, JSON.stringify(chatHistory), preferences ? JSON.stringify(preferences) : null, 'researching', 'Researching destinations...', 0)
            .run();
        return (await this.getTrip(id));
    }
    async getTrip(id) {
        return await this.db
            .prepare('SELECT * FROM themed_trips WHERE id = ?')
            .bind(id)
            .first();
    }
    async updateTripStatus(id, status, progressMessage, progressPercent) {
        const updates = ['status = ?', 'updated_at = unixepoch()'];
        const bindings = [status];
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
    async appendChatMessage(id, message) {
        const trip = await this.getTrip(id);
        if (!trip)
            throw new Error('Trip not found');
        const chatHistory = trip.chat_history
            ? JSON.parse(trip.chat_history)
            : [];
        chatHistory.push(message);
        await this.db
            .prepare('UPDATE themed_trips SET chat_history = ?, updated_at = unixepoch() WHERE id = ?')
            .bind(JSON.stringify(chatHistory), id)
            .run();
    }
    async updateResearchDestinations(id, destinations) {
        await this.db
            .prepare('UPDATE themed_trips SET research_destinations = ?, updated_at = unixepoch() WHERE id = ?')
            .bind(JSON.stringify(destinations), id)
            .run();
    }
    async updateResearchSummary(id, summary) {
        await this.db
            .prepare('UPDATE themed_trips SET research_summary = ?, updated_at = unixepoch() WHERE id = ?')
            .bind(JSON.stringify(summary), id)
            .run();
    }
    async updatePreferences(id, preferences) {
        await this.db
            .prepare('UPDATE themed_trips SET preferences_json = ?, updated_at = unixepoch() WHERE id = ?')
            .bind(JSON.stringify(preferences), id)
            .run();
    }
    async confirmDestinations(id, confirmedDestinations) {
        const result = await this.db
            .prepare(`UPDATE themed_trips SET
          destinations_confirmed = 1,
          confirmed_destinations = ?,
          status = 'building_trip',
          progress_message = 'Building your trip options...',
          updated_at = unixepoch()
        WHERE id = ?`)
            .bind(JSON.stringify(confirmedDestinations), id)
            .run();
        // Verify the update succeeded
        if (!result.success) {
            throw new Error(`Failed to confirm destinations: ${result.error}`);
        }
    }
    async updateTripOptions(id, options) {
        await this.db
            .prepare(`UPDATE themed_trips SET
          options_json = ?,
          status = 'options_ready',
          progress_message = 'Your trip options are ready!',
          progress_percent = 100,
          updated_at = unixepoch()
        WHERE id = ?`)
            .bind(JSON.stringify(options), id)
            .run();
    }
    async selectTripOption(id, optionIndex) {
        const trip = await this.getTrip(id);
        if (!trip || !trip.options_json)
            throw new Error('Trip options not ready');
        const options = JSON.parse(trip.options_json);
        const selectedOption = options.find((opt) => opt.option_index === optionIndex);
        if (!selectedOption)
            throw new Error('Invalid option index');
        await this.db
            .prepare(`UPDATE themed_trips SET
          selected_option_index = ?,
          total_cost_usd = ?,
          status = 'option_selected',
          updated_at = unixepoch()
        WHERE id = ?`)
            .bind(optionIndex, selectedOption.total_cost_usd, id)
            .run();
    }
    async addTelemetryLog(id, log) {
        const trip = await this.getTrip(id);
        if (!trip)
            throw new Error('Trip not found');
        const telemetryLogs = trip.telemetry_logs
            ? JSON.parse(trip.telemetry_logs)
            : [];
        telemetryLogs.push(log);
        await this.db
            .prepare('UPDATE themed_trips SET telemetry_logs = ?, updated_at = unixepoch() WHERE id = ?')
            .bind(JSON.stringify(telemetryLogs), id)
            .run();
    }
    async updateCosts(id, aiCost, apiCost) {
        await this.db
            .prepare(`UPDATE themed_trips SET
          ai_cost_usd = ai_cost_usd + ?,
          api_cost_usd = api_cost_usd + ?,
          updated_at = unixepoch()
        WHERE id = ?`)
            .bind(aiCost, apiCost, id)
            .run();
    }
}
/**
 * Helper to create DatabaseClient from environment
 */
export function createDatabaseClient(env) {
    return new DatabaseClient(env.DB);
}
