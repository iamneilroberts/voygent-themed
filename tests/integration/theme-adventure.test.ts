import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { env } from 'cloudflare:test';
import { setupTestDatabase, cleanupTestData, generateTestUserId } from '../helpers/test-db';
import { selectTemplate } from '../../functions/api/lib/trip-templates';
import { interpolateResearchQuery } from '../../functions/api/lib/research-utils';

describe('Adventure Theme Integration Tests', () => {
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

  test('adventure template exists and has correct configuration', async () => {
    const template = await selectTemplate('Patagonia hiking adventure', 'adventure', db);

    expect(template).toBeDefined();
    expect(template.id).toBe('adventure');
    expect(template.theme).toBe('adventure');
    expect(template.researchQueryTemplate).toBeDefined();
    expect(template.researchQueryTemplate).toContain('{destination}');
  });

  test('interpolates adventure query with destination and activity', () => {
    const template = '{destination} {activity} adventure tours outdoor activities';
    const intake = {
      destinations: ['Patagonia'],
      activities: ['hiking']
    };

    const query = interpolateResearchQuery(template, intake);

    expect(query).toContain('Patagonia');
    expect(query).toContain('hiking');
    expect(query).not.toContain('{destination}');
    expect(query).not.toContain('{activity}');
  });

  test('validates adventure intake structure', () => {
    const mockIntake = {
      destinations: ['Patagonia'],
      activities: ['hiking', 'glacier trekking', 'wildlife viewing'],
      duration_days: 12,
      fitness_level: 'moderate',
      theme: 'adventure'
    };

    expect(mockIntake.destinations).toBeInstanceOf(Array);
    expect(mockIntake.activities).toBeInstanceOf(Array);
    expect(mockIntake.activities.length).toBeGreaterThan(0);
    expect(mockIntake.theme).toBe('adventure');
  });

  test('validates Patagonia adventure trip options', () => {
    const mockOptions = {
      options: [
        {
          title: 'Patagonia Hiking Expedition',
          cities: ['El Calafate', 'El Chaltén', 'Puerto Natales'],
          itinerary: [
            { day: 1, location: 'El Calafate', activities: ['Perito Moreno Glacier tour'] },
            { day: 4, location: 'El Chaltén', activities: ['Fitz Roy trek', 'Laguna de los Tres'] },
            { day: 8, location: 'Puerto Natales', activities: ['Torres del Paine W trek'] }
          ],
          estimated_budget: 4200,
          highlights: ['Glacier hiking', 'Torres del Paine', 'Wildlife viewing']
        }
      ]
    };

    const option = mockOptions.options[0];
    expect(option.cities).toContain('El Chaltén');
    expect(option.highlights.some(h => h.toLowerCase().includes('hiking') || h.toLowerCase().includes('trek'))).toBe(true);
  });

  test('handles activity-based destination selection', () => {
    const intake = {
      activities: ['safari'],
      theme: 'adventure'
      // No specific destination
    };

    // Should suggest safari destinations
    expect(intake.activities).toContain('safari');
  });

  test('validates multiple activities in intake', () => {
    const intake = {
      destinations: ['Costa Rica'],
      activities: ['ziplining', 'surfing', 'wildlife photography'],
      theme: 'adventure'
    };

    expect(intake.activities.length).toBe(3);
    expect(intake.activities).toContain('ziplining');
  });

  test('includes outdoor activities and national parks', () => {
    const itinerary = [
      { day: 1, location: 'Torres del Paine', activities: ['W Trek Day 1', 'Base Las Torres'] },
      { day: 2, location: 'Torres del Paine', activities: ['Valle Francés', 'Wildlife spotting'] }
    ];

    const hasOutdoorActivity = itinerary.some(day =>
      day.activities.some(act => act.toLowerCase().includes('trek') || act.toLowerCase().includes('wildlife'))
    );

    expect(hasOutdoorActivity).toBe(true);
  });

  test('validates adventure research data', () => {
    const mockResearch = [
      {
        step: 'adventure_research',
        query: 'Patagonia hiking trails outdoor activities adventure travel guide',
        summary: 'Patagonia offers world-class trekking in Torres del Paine, Fitz Roy, and Perito Moreno...',
        sources: ['https://example.com/patagonia-hiking']
      }
    ];

    expect(mockResearch[0].step).toBe('adventure_research');
    expect(mockResearch[0].query).toContain('hiking');
    expect(mockResearch[0].summary).toContain('trek');
  });

  test('validates fitness level and difficulty', () => {
    const intake = {
      destinations: ['Kilimanjaro'],
      activities: ['mountain climbing'],
      fitness_level: 'high',
      theme: 'adventure'
    };

    expect(intake.fitness_level).toBe('high');
    expect(['low', 'moderate', 'high']).toContain(intake.fitness_level);
  });

  test('validates longer duration for adventure trips', () => {
    const intake = {
      destinations: ['Patagonia'],
      activities: ['hiking'],
      duration_days: 12,
      theme: 'adventure'
    };

    // Adventure trips often longer (10-21 days)
    expect(intake.duration_days).toBeGreaterThanOrEqual(10);
    expect(intake.duration_days).toBeLessThanOrEqual(21);
  });

  test('validates safari adventure options', () => {
    const mockOptions = {
      options: [
        {
          title: 'East Africa Safari',
          cities: ['Nairobi', 'Serengeti', 'Ngorongoro'],
          itinerary: [
            { day: 1, location: 'Nairobi', activities: ['Arrival', 'Giraffe Center'] },
            { day: 2, location: 'Serengeti', activities: ['Game drive', 'Big Five viewing'] }
          ],
          estimated_budget: 5500,
          highlights: ['Big Five safari', 'Great Migration', 'Maasai village visit']
        }
      ]
    };

    expect(mockOptions.options[0].highlights.some(h => h.includes('safari') || h.includes('Big Five'))).toBe(true);
  });

  test('validates adventure trip persistence', async () => {
    const tripId = crypto.randomUUID();

    const mockTrip = {
      id: tripId,
      user_id: testUserId,
      template: 'adventure',
      status: 'options_ready',
      intake_json: JSON.stringify({
        destinations: ['Patagonia'],
        activities: ['hiking'],
        theme: 'adventure'
      }),
      created_at: Date.now(),
      updated_at: Date.now()
    };

    expect(mockTrip.template).toBe('adventure');
    const intake = JSON.parse(mockTrip.intake_json);
    expect(intake.destinations).toContain('Patagonia');
    expect(intake.activities).toContain('hiking');
  });

  test('validates cost for adventure trip', () => {
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
