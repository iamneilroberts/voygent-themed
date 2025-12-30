import { execSync } from 'child_process';
import * as path from 'path';

/**
 * Database Helper for VoyGent V3 E2E Tests
 *
 * Provides utilities for:
 * - Setting up test database
 * - Cleaning up test data
 * - Running queries for test verification
 * - Inspecting trip state in database
 *
 * Uses wrangler CLI to interact with local D1 database
 */

export interface DbTrip {
  id: string;
  template_id: string;
  status: string;
  chat_history: string; // JSON string
  research_destinations?: string; // JSON string
  destinations_confirmed?: number; // SQLite boolean (0/1)
  confirmed_destinations?: string; // JSON string
  user_preferences?: string; // JSON string
  trip_options?: string; // JSON string
  selected_option_id?: string;
  telemetry_logs?: string; // JSON string
  created_at: string;
  updated_at: string;
}

export interface DbTemplate {
  id: string;
  name: string;
  description: string;
  initial_message: string;
  research_prompt_template: string;
  trip_building_prompt_template: string;
  created_at: string;
  updated_at: string;
}

export class DatabaseHelper {
  private dbName: string;
  private isLocal: boolean;

  constructor(dbName: string = 'voygent-v3-dev', isLocal: boolean = true) {
    this.dbName = dbName;
    this.isLocal = isLocal;
  }

  /**
   * Execute a SQL query against the D1 database
   * Returns raw JSON output from wrangler
   */
  private executeQuery(sql: string): any {
    try {
      const localFlag = this.isLocal ? '--local' : '';
      const command = `echo "${sql.replace(/"/g, '\\"')}" | npx wrangler d1 execute ${this.dbName} ${localFlag}`;

      const output = execSync(command, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Parse wrangler output (it returns JSON)
      // Format: {"results":[...], "success":true, "meta":{...}}
      try {
        return JSON.parse(output);
      } catch {
        // If output is not JSON, return raw output
        return { results: [], success: false, error: output };
      }
    } catch (error: any) {
      console.error('Database query failed:', error.message);
      throw error;
    }
  }

  /**
   * Get all templates from the database
   */
  async getTemplates(): Promise<DbTemplate[]> {
    const result = this.executeQuery('SELECT * FROM trip_templates ORDER BY created_at DESC;');
    return result.results || [];
  }

  /**
   * Get a template by ID
   */
  async getTemplateById(templateId: string): Promise<DbTemplate | null> {
    const result = this.executeQuery(`SELECT * FROM trip_templates WHERE id = '${templateId}';`);
    return result.results?.[0] || null;
  }

  /**
   * Get a trip by ID from the database
   */
  async getTripById(tripId: string): Promise<DbTrip | null> {
    const result = this.executeQuery(`SELECT * FROM themed_trips WHERE id = '${tripId}';`);
    return result.results?.[0] || null;
  }

  /**
   * Get all trips from the database
   */
  async getAllTrips(): Promise<DbTrip[]> {
    const result = this.executeQuery('SELECT * FROM themed_trips ORDER BY created_at DESC;');
    return result.results || [];
  }

  /**
   * Delete a trip by ID (for cleanup)
   */
  async deleteTripById(tripId: string): Promise<void> {
    this.executeQuery(`DELETE FROM themed_trips WHERE id = '${tripId}';`);
  }

  /**
   * Delete all trips (for cleanup)
   * WARNING: This deletes all test data!
   */
  async deleteAllTrips(): Promise<void> {
    this.executeQuery('DELETE FROM themed_trips;');
  }

  /**
   * Count trips in the database
   */
  async countTrips(): Promise<number> {
    const result = this.executeQuery('SELECT COUNT(*) as count FROM themed_trips;');
    return result.results?.[0]?.count || 0;
  }

  /**
   * Verify trip has required fields populated
   * Useful for data integrity tests
   */
  async verifyTripIntegrity(tripId: string): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const trip = await this.getTripById(tripId);

    if (!trip) {
      return {
        isValid: false,
        errors: [`Trip ${tripId} not found in database`],
      };
    }

    const errors: string[] = [];

    // Check required fields
    if (!trip.id) errors.push('Missing id');
    if (!trip.template_id) errors.push('Missing template_id');
    if (!trip.status) errors.push('Missing status');
    if (!trip.created_at) errors.push('Missing created_at');
    if (!trip.updated_at) errors.push('Missing updated_at');

    // Check JSON fields are valid JSON
    const jsonFields = [
      'chat_history',
      'research_destinations',
      'confirmed_destinations',
      'user_preferences',
      'trip_options',
      'telemetry_logs',
    ] as const;

    jsonFields.forEach(field => {
      const value = trip[field];
      if (value) {
        try {
          JSON.parse(value);
        } catch {
          errors.push(`Invalid JSON in ${field}`);
        }
      }
    });

    // Check status-dependent fields
    if (trip.status === 'awaiting_confirmation' || trip.status === 'building_trip' || trip.status === 'trip_ready' || trip.status === 'selected') {
      if (!trip.research_destinations) {
        errors.push('Missing research_destinations for status ' + trip.status);
      }
    }

    if (trip.status === 'building_trip' || trip.status === 'trip_ready' || trip.status === 'selected') {
      if (trip.destinations_confirmed !== 1) {
        errors.push('destinations_confirmed should be true for status ' + trip.status);
      }
      if (!trip.confirmed_destinations) {
        errors.push('Missing confirmed_destinations for status ' + trip.status);
      }
    }

    if (trip.status === 'trip_ready' || trip.status === 'selected') {
      if (!trip.trip_options) {
        errors.push('Missing trip_options for status ' + trip.status);
      }
    }

    if (trip.status === 'selected') {
      if (!trip.selected_option_id) {
        errors.push('Missing selected_option_id for status "selected"');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Parse a JSON field from a database trip
   */
  parseJsonField<T>(trip: DbTrip, field: keyof DbTrip): T | null {
    const value = trip[field];
    if (!value || typeof value !== 'string') return null;

    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
}

/**
 * Create a database helper instance for tests
 */
export function createDatabaseHelper(): DatabaseHelper {
  const dbName = process.env.DB_BINDING_NAME || 'voygent-v3-dev';
  const isLocal = process.env.TEST_ENV !== 'production';

  return new DatabaseHelper(dbName, isLocal);
}
