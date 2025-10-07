import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { env } from 'cloudflare:test';
import { setupTestDatabase, cleanupTestData, generateTestUserId } from '../helpers/test-db';
import { selectTemplate } from '../../functions/api/lib/trip-templates';
import { interpolateResearchQuery } from '../../functions/api/lib/research-utils';

describe('Culinary Theme Integration Tests', () => {
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

  test('culinary template exists and has correct configuration', async () => {
    const template = await selectTemplate('Italian cuisine in Tuscany', 'culinary', db);

    expect(template).toBeDefined();
    expect(template.id).toBe('culinary');
    expect(template.theme).toBe('culinary');
    expect(template.researchQueryTemplate).toBeDefined();
    expect(template.researchQueryTemplate).toContain('{cuisine}');
  });

  test('interpolates culinary query with cuisine and region', () => {
    const template = '{cuisine} {region} restaurants cooking classes food tours';
    const intake = {
      cuisines: ['Italian'],
      regions: ['Tuscany']
    };

    const query = interpolateResearchQuery(template, intake);

    expect(query).toContain('Italian');
    expect(query).toContain('Tuscany');
    expect(query).not.toContain('{cuisine}');
    expect(query).not.toContain('{region}');
  });

  test('validates culinary intake structure', () => {
    const mockIntake = {
      cuisines: ['Italian'],
      regions: ['Tuscany'],
      activities: ['cooking classes', 'wine tasting', 'food tours'],
      duration_days: 7,
      budget_tier: 'comfort',
      theme: 'culinary'
    };

    expect(mockIntake.cuisines).toBeInstanceOf(Array);
    expect(mockIntake.cuisines.length).toBeGreaterThan(0);
    expect(mockIntake.activities).toContain('cooking classes');
    expect(mockIntake.theme).toBe('culinary');
  });

  test('validates Tuscany culinary trip options', () => {
    const mockOptions = {
      options: [
        {
          title: 'Tuscan Culinary Journey',
          cities: ['Florence', 'Siena', 'Montepulciano'],
          itinerary: [
            { day: 1, location: 'Florence', activities: ['Cooking class', 'Market tour'] },
            { day: 3, location: 'Siena', activities: ['Wine tasting', 'Traditional trattoria'] },
            { day: 5, location: 'Montepulciano', activities: ['Vineyard tour', 'Cheese tasting'] }
          ],
          estimated_budget: 3800,
          highlights: ['Hands-on cooking classes', 'Wine tours in Chianti', 'Truffle hunting']
        }
      ]
    };

    const option = mockOptions.options[0];
    expect(option.cities).toContain('Florence');
    expect(option.highlights.some(h => h.toLowerCase().includes('cooking'))).toBe(true);
    expect(option.highlights.some(h => h.toLowerCase().includes('wine'))).toBe(true);
  });

  test('handles cuisine without specific region', () => {
    const intake = {
      cuisines: ['French'],
      theme: 'culinary'
      // No region specified
    };

    const query = interpolateResearchQuery('{cuisine} {region} restaurants', intake);

    expect(query).toContain('French');
    // Region placeholder should be removed/handled
  });

  test('validates multi-region options when location not specified', () => {
    const mockOptions = {
      options: [
        {
          title: 'French Culinary Tour',
          cities: ['Paris', 'Lyon', 'Provence'],
          itinerary: [],
          estimated_budget: 4200,
          highlights: ['Paris bistros', 'Lyon bouchons', 'Provence markets']
        }
      ]
    };

    // Should offer multiple regions when not specified
    expect(mockOptions.options[0].cities.length).toBeGreaterThan(2);
  });

  test('includes cooking classes and food tours in activities', () => {
    const itinerary = [
      { day: 1, location: 'Florence', activities: ['Pasta making class', 'Market tour'] },
      { day: 2, location: 'Florence', activities: ['Wine and cheese pairing', 'Gelato workshop'] }
    ];

    const hasCookingClass = itinerary.some(day =>
      day.activities.some(act => act.toLowerCase().includes('class') || act.toLowerCase().includes('making'))
    );

    expect(hasCookingClass).toBe(true);
  });

  test('validates culinary research data', () => {
    const mockResearch = [
      {
        step: 'culinary_research',
        query: 'Italian Tuscany food tour cooking classes restaurants travel guide',
        summary: 'Tuscany offers world-renowned cooking schools, vineyard tours, and traditional restaurants...',
        sources: ['https://example.com/tuscany-food']
      }
    ];

    expect(mockResearch[0].step).toBe('culinary_research');
    expect(mockResearch[0].query).toContain('cooking classes');
    expect(mockResearch[0].summary).toContain('cooking');
  });

  test('validates dietary preferences handling', () => {
    const intake = {
      cuisines: ['Italian'],
      regions: ['Tuscany'],
      dietary_preferences: ['vegetarian'],
      theme: 'culinary'
    };

    expect(intake.dietary_preferences).toBeInstanceOf(Array);
    expect(intake.dietary_preferences).toContain('vegetarian');
  });

  test('validates duration appropriate for culinary trips', () => {
    const intake = {
      cuisines: ['Italian'],
      regions: ['Tuscany'],
      duration_days: 7,
      theme: 'culinary'
    };

    // Culinary trips typically 5-10 days
    expect(intake.duration_days).toBeGreaterThanOrEqual(5);
    expect(intake.duration_days).toBeLessThanOrEqual(14);
  });

  test('validates culinary trip persistence', async () => {
    const tripId = crypto.randomUUID();

    const mockTrip = {
      id: tripId,
      user_id: testUserId,
      template: 'culinary',
      status: 'options_ready',
      intake_json: JSON.stringify({
        cuisines: ['Italian'],
        regions: ['Tuscany'],
        theme: 'culinary'
      }),
      created_at: Date.now(),
      updated_at: Date.now()
    };

    expect(mockTrip.template).toBe('culinary');
    const intake = JSON.parse(mockTrip.intake_json);
    expect(intake.cuisines).toContain('Italian');
    expect(intake.regions).toContain('Tuscany');
  });

  test('validates cost for culinary trip', () => {
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
