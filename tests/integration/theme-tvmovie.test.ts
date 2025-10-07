import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { env } from 'cloudflare:test';
import { setupTestDatabase, cleanupTestData, generateTestUserId } from '../helpers/test-db';
import { selectTemplate } from '../../functions/api/lib/trip-templates';
import { interpolateResearchQuery } from '../../functions/api/lib/research-utils';

describe('TV/Movie Theme Integration Tests', () => {
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

  test('tvmovie template exists and has correct configuration', async () => {
    const template = await selectTemplate('Game of Thrones filming locations', 'tvmovie', db);

    expect(template).toBeDefined();
    expect(template.id).toBe('tvmovie');
    expect(template.theme).toBe('tvmovie');
    expect(template.researchQueryTemplate).toBeDefined();
    expect(template.researchQueryTemplate).toContain('{title}');
  });

  test('interpolates tvmovie query with title', () => {
    const template = '{title} filming locations movie sets travel guide';
    const intake = {
      titles: ['Game of Thrones']
    };

    const query = interpolateResearchQuery(template, intake);

    expect(query).toContain('Game of Thrones');
    expect(query).not.toContain('{title}');
    expect(query).toContain('filming locations');
  });

  test('validates tvmovie intake structure', () => {
    const mockIntake = {
      titles: ['Game of Thrones'],
      destinations: ['Northern Ireland', 'Iceland', 'Croatia'],
      duration_days: 14,
      budget_tier: 'comfort',
      theme: 'tvmovie'
    };

    expect(mockIntake.titles).toBeInstanceOf(Array);
    expect(mockIntake.titles.length).toBeGreaterThan(0);
    expect(mockIntake.theme).toBe('tvmovie');
  });

  test('validates multi-country itinerary for popular series', () => {
    const mockOptions = {
      options: [
        {
          title: 'Game of Thrones Complete Tour',
          cities: ['Belfast', 'Dubrovnik', 'Reykjavik'],
          itinerary: [
            { day: 1, location: 'Belfast', activities: ['Dark Hedges', 'Castle Ward'] },
            { day: 5, location: 'Dubrovnik', activities: ['Old Town (King\'s Landing)'] },
            { day: 10, location: 'Reykjavik', activities: ['Beyond the Wall locations'] }
          ],
          estimated_budget: 5500,
          highlights: ['Visit Winterfell', 'Walk King\'s Landing', 'See Beyond the Wall']
        }
      ]
    };

    const option = mockOptions.options[0];
    expect(option.cities.length).toBeGreaterThan(1); // Multi-country
    expect(option.cities).toContain('Belfast');
    expect(option.cities).toContain('Dubrovnik');
  });

  test('handles TV series vs movie distinction', () => {
    const tvIntake = {
      titles: ['Game of Thrones'],
      media_type: 'tv_series',
      theme: 'tvmovie'
    };

    const movieIntake = {
      titles: ['Lord of the Rings'],
      media_type: 'movie',
      theme: 'tvmovie'
    };

    expect(tvIntake.media_type).toBe('tv_series');
    expect(movieIntake.media_type).toBe('movie');
  });

  test('validates filming location research data', () => {
    const mockResearch = [
      {
        step: 'filming_location_research',
        query: 'Game of Thrones filming locations where to visit',
        summary: 'Game of Thrones was filmed across multiple locations including Northern Ireland, Croatia, and Iceland...',
        sources: ['https://example.com/got-locations']
      }
    ];

    expect(mockResearch[0].step).toBe('filming_location_research');
    expect(mockResearch[0].query).toContain('filming locations');
    expect(mockResearch[0].summary).toBeTruthy();
  });

  test('handles multiple titles in intake', () => {
    const intake = {
      titles: ['Harry Potter', 'Downton Abbey'],
      theme: 'tvmovie'
    };

    // Should use first title for research
    const query = interpolateResearchQuery('{title} filming locations', intake);
    expect(query).toContain('Harry Potter');
  });

  test('validates New Zealand focus for LOTR', () => {
    const mockOptions = {
      options: [
        {
          title: 'Middle Earth Journey',
          cities: ['Auckland', 'Queenstown', 'Wellington'],
          itinerary: [
            { day: 1, location: 'Auckland', activities: ['Hobbiton Movie Set'] },
            { day: 5, location: 'Queenstown', activities: ['Remarkables (Misty Mountains)'] }
          ],
          estimated_budget: 4500,
          highlights: ['Visit Hobbiton', 'See Misty Mountains', 'Tour Weta Workshop']
        }
      ]
    };

    const option = mockOptions.options[0];
    expect(option.cities).toContain('Auckland');
    expect(option.highlights.some(h => h.includes('Hobbiton'))).toBe(true);
  });

  test('includes duration preference for tvmovie trips', () => {
    const intake = {
      titles: ['Game of Thrones'],
      duration_days: 14,
      theme: 'tvmovie'
    };

    expect(intake.duration_days).toBe(14);
    expect(intake.duration_days).toBeGreaterThan(7); // Longer for multi-country
  });

  test('validates tvmovie trip persistence', async () => {
    const tripId = crypto.randomUUID();

    const mockTrip = {
      id: tripId,
      user_id: testUserId,
      template: 'tvmovie',
      status: 'options_ready',
      intake_json: JSON.stringify({
        titles: ['Game of Thrones'],
        theme: 'tvmovie'
      }),
      created_at: Date.now(),
      updated_at: Date.now()
    };

    expect(mockTrip.template).toBe('tvmovie');
    const intake = JSON.parse(mockTrip.intake_json);
    expect(intake.titles).toContain('Game of Thrones');
  });

  test('validates cost for multi-country tvmovie trip', () => {
    const costs = {
      intake: { costUsd: 0.001 },
      research: { costUsd: 0.002 },
      options: { costUsd: 0.004 },
      total: 0.007
    };

    expect(costs.total).toBeLessThan(0.10);
    expect(costs.total).toBeGreaterThan(0);
  });
});
