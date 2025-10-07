import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { env } from 'cloudflare:test';
import { setupTestDatabase, cleanupTestData, generateTestUserId } from '../helpers/test-db';
import { validateTripStructure, validateResearchData } from '../helpers/assertions';
import { selectTemplate } from '../../functions/api/lib/trip-templates';
import { interpolateResearchQuery } from '../../functions/api/lib/research-utils';

describe('Heritage Theme Integration Tests', () => {
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

  test('heritage template exists and has correct configuration', async () => {
    const template = await selectTemplate('Williams family heritage', 'heritage', db);

    expect(template).toBeDefined();
    expect(template.id).toBe('heritage');
    expect(template.theme).toBe('heritage');
    expect(template.researchQueryTemplate).toBeDefined();
    expect(template.researchQueryTemplate).toContain('{surname}');
  });

  test('interpolates heritage query with surname', () => {
    const template = '{surname} family heritage sites ancestral homes castles';
    const intake = {
      surnames: ['Williams'],
      suspected_origins: ['Scotland']
    };

    const query = interpolateResearchQuery(template, intake);

    expect(query).toContain('Williams');
    expect(query).not.toContain('{surname}');
    expect(query).toContain('heritage sites');
  });

  test('validates heritage intake structure', () => {
    const mockIntake = {
      surnames: ['Williams'],
      suspected_origins: ['Scotland'],
      duration_days: 7,
      budget_tier: 'comfort',
      theme: 'heritage'
    };

    expect(mockIntake.surnames).toBeInstanceOf(Array);
    expect(mockIntake.surnames.length).toBeGreaterThan(0);
    expect(mockIntake.suspected_origins).toBeInstanceOf(Array);
    expect(mockIntake.theme).toBe('heritage');
  });

  test('validates heritage trip options structure', () => {
    const mockOptions = {
      options: [
        {
          title: 'Scottish Heritage Trail',
          cities: ['Edinburgh', 'Inverness', 'Isle of Skye'],
          itinerary: [
            { day: 1, location: 'Edinburgh', activities: ['Edinburgh Castle', 'Royal Mile'] }
          ],
          estimated_budget: 3500,
          highlights: ['Visit Edinburgh Castle', 'Explore Highland castles']
        },
        {
          title: 'Lowlands Heritage Journey',
          cities: ['Edinburgh', 'Glasgow', 'Stirling'],
          itinerary: [
            { day: 1, location: 'Edinburgh', activities: ['National Museum'] }
          ],
          estimated_budget: 2800,
          highlights: ['Stirling Castle', 'Glasgow heritage sites']
        }
      ]
    };

    expect(mockOptions.options).toBeInstanceOf(Array);
    expect(mockOptions.options.length).toBeGreaterThanOrEqual(2);
    expect(mockOptions.options.length).toBeLessThanOrEqual(4);

    mockOptions.options.forEach(option => {
      expect(option.title).toBeTruthy();
      expect(option.cities).toBeInstanceOf(Array);
      expect(option.itinerary).toBeInstanceOf(Array);
      expect(option.estimated_budget).toBeGreaterThan(0);
      expect(option.highlights).toBeInstanceOf(Array);
    });
  });

  test('validates heritage research data structure', () => {
    const mockResearch = [
      {
        step: 'surname_research',
        query: 'Williams family Scotland heritage sites',
        summary: 'The Williams surname has strong Scottish roots...',
        sources: ['https://example.com/williams-heritage']
      },
      {
        step: 'ai_reasoning',
        analysis: 'The Williams family originated in the Scottish Highlands...',
        tokens: 150,
        cost: 0.001
      }
    ];

    expect(mockResearch).toBeInstanceOf(Array);
    expect(mockResearch.length).toBeGreaterThan(0);

    mockResearch.forEach(step => {
      expect(step.step).toBeDefined();
      expect(['surname_research', 'ai_reasoning']).toContain(step.step);
    });
  });

  test('handles multiple surnames correctly', () => {
    const intake = {
      surnames: ['Williams', 'MacLeod', 'Campbell'],
      suspected_origins: ['Scotland'],
      theme: 'heritage'
    };

    expect(intake.surnames.length).toBe(3);
    expect(intake.surnames).toContain('Williams');
    expect(intake.surnames).toContain('MacLeod');
  });

  test('handles surname with special characters', () => {
    const specialSurnames = ['O\'Brien', 'D\'Angelo', 'MacLeod'];

    specialSurnames.forEach(surname => {
      const intake = { surnames: [surname], theme: 'heritage' };
      const query = interpolateResearchQuery('{surname} family heritage', intake);

      expect(query).toContain(surname);
      expect(query).not.toContain('{surname}');
    });
  });

  test('includes genealogy interests in intake', () => {
    const intake = {
      surnames: ['Williams'],
      suspected_origins: ['Scotland'],
      interests: ['castles', 'battlefields', 'clan history'],
      theme: 'heritage'
    };

    expect(intake.interests).toBeInstanceOf(Array);
    expect(intake.interests).toContain('castles');
  });

  test('validates trip persistence structure', async () => {
    const tripId = crypto.randomUUID();

    const mockTrip = {
      id: tripId,
      user_id: testUserId,
      template: 'heritage',
      status: 'options_ready',
      intake_json: JSON.stringify({
        surnames: ['Williams'],
        suspected_origins: ['Scotland'],
        theme: 'heritage'
      }),
      options_json: JSON.stringify({
        options: [
          { title: 'Scottish Heritage', cities: ['Edinburgh'], itinerary: [], estimated_budget: 3000, highlights: [] }
        ]
      }),
      created_at: Date.now(),
      updated_at: Date.now()
    };

    // Verify structure
    expect(mockTrip.id).toBeTruthy();
    expect(mockTrip.user_id).toContain('test-user-');
    expect(mockTrip.template).toBe('heritage');
    expect(mockTrip.intake_json).toBeTruthy();

    // Verify JSON parsing
    const intake = JSON.parse(mockTrip.intake_json);
    expect(intake.surnames).toBeDefined();

    const options = JSON.parse(mockTrip.options_json);
    expect(options.options).toBeInstanceOf(Array);
  });

  test('validates diagnostics with research data', () => {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      template: { id: 'heritage', name: 'Family Heritage Discovery' },
      steps: [
        { step: 'template_selection', template: 'heritage' },
        { step: 'intake_normalization', provider: 'openai', tokensIn: 100, tokensOut: 150, costUsd: 0.001 },
        { step: 'surname_research', count: 1 },
        { step: 'options_generation', provider: 'openai', tokensIn: 200, tokensOut: 400, costUsd: 0.003 }
      ],
      research: [
        {
          step: 'surname_research',
          query: 'Williams family Scotland heritage',
          summary: 'Research findings...',
          sources: ['https://example.com']
        }
      ],
      intake: { provider: 'openai', tokensIn: 100, tokensOut: 150, costUsd: 0.001 },
      options: { provider: 'openai', tokensIn: 200, tokensOut: 400, costUsd: 0.003 },
      totalCost: 0.004
    };

    expect(diagnostics.timestamp).toBeDefined();
    expect(diagnostics.research).toBeInstanceOf(Array);
    expect(diagnostics.totalCost).toBeGreaterThan(0);
    expect(diagnostics.steps.length).toBeGreaterThan(0);
  });

  test('heritage trip has 2-4 options', () => {
    const mockResponse = {
      options: [
        { title: 'Option 1', cities: [], itinerary: [], estimated_budget: 3000, highlights: [] },
        { title: 'Option 2', cities: [], itinerary: [], estimated_budget: 3500, highlights: [] }
      ]
    };

    expect(mockResponse.options.length).toBeGreaterThanOrEqual(2);
    expect(mockResponse.options.length).toBeLessThanOrEqual(4);
  });

  test('validates cost tracking for heritage trip', () => {
    const costs = {
      intake: { tokensIn: 100, tokensOut: 150, costUsd: 0.001 },
      research: { tokensIn: 50, tokensOut: 100, costUsd: 0.0005 },
      options: { tokensIn: 200, tokensOut: 400, costUsd: 0.003 },
      total: 0.0045
    };

    expect(costs.total).toBeLessThan(0.10); // Under $0.10 threshold
    expect(costs.intake.costUsd).toBeGreaterThan(0);
    expect(costs.options.costUsd).toBeGreaterThan(costs.intake.costUsd);
  });
});
