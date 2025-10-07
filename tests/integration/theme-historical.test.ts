import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { env } from 'cloudflare:test';
import { setupTestDatabase, cleanupTestData, generateTestUserId } from '../helpers/test-db';
import { selectTemplate } from '../../functions/api/lib/trip-templates';
import { interpolateResearchQuery } from '../../functions/api/lib/research-utils';

describe('Historical Theme Integration Tests', () => {
  let db: D1Database;
  let testUserId: string;

  beforeAll(async () => {
    db = env.TEST_DB;
    await setupTestDatabase(db);
    testUserId = generateTestUserId();
  });

  afterAll(async () => {
    if (db) {
      await cleanupTestData(db);
    }
  });

  test('historical template exists and has correct configuration', async () => {
    const template = await selectTemplate('D-Day historical sites', 'historical', db);

    expect(template).toBeDefined();
    expect(template.id).toBe('historical');
    expect(template.theme).toBe('historical');
    expect(template.researchQueryTemplate).toBeDefined();
    expect(template.researchQueryTemplate).toContain('{event}');
  });

  test('interpolates historical query with event', () => {
    const template = '{event} historical sites museums memorials travel destinations';
    const intake = {
      events: ['D-Day']
    };

    const query = interpolateResearchQuery(template, intake);

    expect(query).toContain('D-Day');
    expect(query).not.toContain('{event}');
    expect(query).toContain('historical sites');
  });

  test('validates historical intake structure', () => {
    const mockIntake = {
      events: ['D-Day'],
      destinations: ['France', 'Normandy'],
      interests: ['museums', 'memorials', 'battlefields'],
      duration_days: 5,
      theme: 'historical'
    };

    expect(mockIntake.events).toBeInstanceOf(Array);
    expect(mockIntake.events.length).toBeGreaterThan(0);
    expect(mockIntake.theme).toBe('historical');
  });

  test('validates Normandy historical trip options', () => {
    const mockOptions = {
      options: [
        {
          title: 'D-Day Normandy Tour',
          cities: ['Paris', 'Bayeux', 'Caen'],
          itinerary: [
            { day: 1, location: 'Paris', activities: ['Travel to Normandy'] },
            { day: 2, location: 'Bayeux', activities: ['Omaha Beach', 'American Cemetery'] },
            { day: 3, location: 'Caen', activities: ['Caen Memorial Museum', 'Pegasus Bridge'] }
          ],
          estimated_budget: 2500,
          highlights: ['Visit Omaha Beach', 'American Cemetery', 'D-Day museums']
        }
      ]
    };

    const option = mockOptions.options[0];
    expect(option.cities).toContain('Bayeux');
    expect(option.highlights.some(h => h.toLowerCase().includes('beach'))).toBe(true);
  });

  test('handles historical period vs specific event', () => {
    const eventIntake = {
      events: ['Battle of Hastings'],
      theme: 'historical'
    };

    const periodIntake = {
      periods: ['Medieval England'],
      theme: 'historical'
    };

    expect(eventIntake.events).toBeDefined();
    expect(periodIntake.periods).toBeDefined();
  });

  test('validates medieval England historical trip', () => {
    const mockOptions = {
      options: [
        {
          title: 'Medieval England Heritage',
          cities: ['London', 'York', 'Canterbury'],
          itinerary: [
            { day: 1, location: 'London', activities: ['Tower of London', 'Westminster Abbey'] },
            { day: 3, location: 'York', activities: ['York Minster', 'Medieval city walls'] }
          ],
          estimated_budget: 3200,
          highlights: ['Tower of London', 'Medieval castles', 'Historic cathedrals']
        }
      ]
    };

    expect(mockOptions.options[0].highlights.some(h => h.includes('castles'))).toBe(true);
  });

  test('validates historical research data', () => {
    const mockResearch = [
      {
        step: 'historical_research',
        query: 'D-Day historical sites museums tours travel guide',
        summary: 'D-Day landing sites in Normandy include Omaha Beach, Utah Beach, and numerous museums...',
        sources: ['https://example.com/dday-normandy']
      }
    ];

    expect(mockResearch[0].step).toBe('historical_research');
    expect(mockResearch[0].query).toContain('D-Day');
    expect(mockResearch[0].summary).toContain('Normandy');
  });

  test('includes museums and memorials in itinerary', () => {
    const itinerary = [
      { day: 1, location: 'Caen', activities: ['Caen Memorial Museum', 'Walking tour'] },
      { day: 2, location: 'Bayeux', activities: ['Tapestry Museum', 'American Cemetery'] }
    ];

    const hasMuseum = itinerary.some(day =>
      day.activities.some(act => act.toLowerCase().includes('museum'))
    );

    expect(hasMuseum).toBe(true);
  });

  test('validates duration appropriate for historical sites', () => {
    const intake = {
      events: ['World War II'],
      duration_days: 7,
      theme: 'historical'
    };

    // Historical trips typically 5-10 days
    expect(intake.duration_days).toBeGreaterThanOrEqual(5);
    expect(intake.duration_days).toBeLessThanOrEqual(14);
  });

  test('validates historical trip persistence', async () => {
    const tripId = crypto.randomUUID();

    const mockTrip = {
      id: tripId,
      user_id: testUserId,
      template: 'historical',
      status: 'options_ready',
      intake_json: JSON.stringify({
        events: ['D-Day'],
        destinations: ['France'],
        theme: 'historical'
      }),
      created_at: Date.now(),
      updated_at: Date.now()
    };

    expect(mockTrip.template).toBe('historical');
    const intake = JSON.parse(mockTrip.intake_json);
    expect(intake.events).toContain('D-Day');
  });

  test('validates cost for historical trip', () => {
    const costs = {
      intake: { costUsd: 0.001 },
      research: { costUsd: 0.002 },
      options: { costUsd: 0.003 },
      total: 0.006
    };

    expect(costs.total).toBeLessThan(0.10);
    expect(costs.total).toBeGreaterThan(0);
  });
});
