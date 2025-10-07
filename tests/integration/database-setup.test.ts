import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { env } from 'cloudflare:test';
import { setupTestDatabase, cleanupTestData } from '../helpers/test-db';

describe('Database Setup Tests', () => {
  let db: D1Database;

  beforeAll(async () => {
    db = env.TEST_DB;
    await setupTestDatabase(db);
  });

  afterAll(async () => {
    if (db) {
      await cleanupTestData(db);
    }
  });

  test('TEST_DB binding exists', () => {
    expect(db).toBeDefined();
    expect(db).toHaveProperty('prepare');
  });

  test('trip_templates table has all 5 themes', async () => {
    const result = await db.prepare('SELECT COUNT(*) as count FROM trip_templates').first();
    expect(result).toBeDefined();
    expect(result.count).toBeGreaterThanOrEqual(5);
  });

  test('heritage template exists with research query', async () => {
    const template = await db.prepare(
      'SELECT * FROM trip_templates WHERE theme = ?'
    ).bind('heritage').first();

    expect(template).toBeDefined();
    expect(template.theme).toBe('heritage');
    expect(template.researchQueryTemplate).toContain('surname');
    expect(template.researchQueryTemplate).toContain('heritage sites');
  });

  test('can create and delete test trip', async () => {
    const tripId = crypto.randomUUID();
    const userId = 'test-user-' + crypto.randomUUID();

    // Create test trip
    await db.prepare(`
      INSERT INTO themed_trips (id, user_id, template, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(tripId, userId, 'heritage', 'draft', Date.now(), Date.now()).run();

    // Verify it exists
    const trip = await db.prepare('SELECT * FROM themed_trips WHERE id = ?')
      .bind(tripId)
      .first();
    expect(trip).toBeDefined();
    expect(trip.user_id).toBe(userId);

    // Clean up
    await db.prepare('DELETE FROM themed_trips WHERE user_id LIKE ?')
      .bind('test-user-%')
      .run();

    // Verify cleanup
    const deletedTrip = await db.prepare('SELECT * FROM themed_trips WHERE id = ?')
      .bind(tripId)
      .first();
    expect(deletedTrip).toBeNull();
  });
});
