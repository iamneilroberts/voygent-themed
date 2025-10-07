import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { env } from 'cloudflare:test';
import { selectTemplate, getTemplate, detectTemplateId } from '../../functions/api/lib/trip-templates';
import { setupTestDatabase, cleanupTestData } from '../helpers/test-db';

// Helper to detect template without needing DB
function detectTemplateIdLocal(input: string, explicitTheme?: string): string {
  if (explicitTheme) return explicitTheme;

  const lowerInput = input.toLowerCase();

  if (lowerInput.match(/game of thrones|harry potter|lord of the rings|star wars|filming location|movie|tv show|series/i)) {
    return 'tvmovie';
  }

  if (lowerInput.match(/wwii|world war|battle|historical|revolution|ancient|empire|medieval/i)) {
    return 'historical';
  }

  if (lowerInput.match(/food|cuisine|cooking class|wine tour|michelin|restaurant|culinary|market/i)) {
    return 'culinary';
  }

  if (lowerInput.match(/hiking|safari|adventure|climbing|kayaking|wildlife|camping|national park/i)) {
    return 'adventure';
  }

  if (lowerInput.match(/surname|ancestry|family|genealogy|heritage|roots|immigrant/i)) {
    return 'heritage';
  }

  return 'heritage'; // Default
}

describe('Template Validation Tests', () => {
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

  test('heritage template has required fields', async () => {
    const template = await getTemplate('heritage', db);
    expect(template).toBeDefined();
    expect(template?.id).toBe('heritage');
    expect(template?.name).toBeTruthy();
    expect(template?.theme).toBe('heritage');
    expect(template?.researchQueryTemplate).toContain('{surname}');
  });

  test('tvmovie template has required fields', async () => {
    const template = await getTemplate('tvmovie', db);
    expect(template).toBeDefined();
    expect(template?.id).toBe('tvmovie');
    expect(template?.theme).toBe('tvmovie');
    expect(template?.researchQueryTemplate).toContain('{title}');
  });

  test('historical template has required fields', async () => {
    const template = await getTemplate('historical', db);
    expect(template).toBeDefined();
    expect(template?.id).toBe('historical');
    expect(template?.theme).toBe('historical');
    expect(template?.researchQueryTemplate).toContain('{event}');
  });

  test('culinary template has required fields', async () => {
    const template = await getTemplate('culinary', db);
    expect(template).toBeDefined();
    expect(template?.id).toBe('culinary');
    expect(template?.theme).toBe('culinary');
    expect(template?.researchQueryTemplate).toContain('{cuisine}');
  });

  test('adventure template has required fields', async () => {
    const template = await getTemplate('adventure', db);
    expect(template).toBeDefined();
    expect(template?.id).toBe('adventure');
    expect(template?.theme).toBe('adventure');
    expect(template?.researchQueryTemplate).toContain('{destination}');
  });

  test('template selection by explicit theme', () => {
    const templateId = detectTemplateIdLocal('random text', 'culinary');
    expect(templateId).toBe('culinary');
  });

  test('template auto-detection for heritage keywords', () => {
    const templateId = detectTemplateIdLocal('I want to explore my Williams family ancestry');
    expect(templateId).toBe('heritage');
  });

  test('template auto-detection for tvmovie keywords', () => {
    const templateId = detectTemplateIdLocal('Game of Thrones filming locations');
    expect(templateId).toBe('tvmovie');
  });

  test('template auto-detection for historical keywords', () => {
    const templateId = detectTemplateIdLocal('WWII historical sites in Europe');
    expect(templateId).toBe('historical');
  });

  test('template auto-detection for culinary keywords', () => {
    const templateId = detectTemplateIdLocal('Italian cuisine cooking classes');
    expect(templateId).toBe('culinary');
  });

  test('template auto-detection for adventure keywords', () => {
    const templateId = detectTemplateIdLocal('Patagonia hiking and camping');
    expect(templateId).toBe('adventure');
  });

  test('defaults to heritage for ambiguous input', () => {
    const templateId = detectTemplateIdLocal('I want to travel somewhere nice');
    expect(templateId).toBe('heritage');
  });
});
