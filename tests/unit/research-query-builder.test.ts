import { describe, test, expect } from 'vitest';
import { interpolateResearchQuery } from '../../functions/api/lib/research-utils';

describe('Research Query Builder Tests', () => {
  test('builds heritage query with surname and origin', () => {
    const template = '{surname} family heritage sites ancestral homes castles historical tours travel destinations';
    const intake = {
      surnames: ['Williams'],
      suspected_origins: ['Scotland']
    };

    const query = interpolateResearchQuery(template, intake);

    expect(query).toContain('Williams');
    expect(query).toContain('heritage sites');
    expect(query).toContain('travel destinations');
  });

  test('builds tvmovie query with title', () => {
    const template = '{title} filming locations movie sets TV show locations travel destinations';
    const intake = {
      titles: ['Game of Thrones']
    };

    const query = interpolateResearchQuery(template, intake);

    expect(query).toContain('Game of Thrones');
    expect(query).toContain('filming locations');
    expect(query).not.toContain('{title}');
  });

  test('builds historical query with event', () => {
    const template = '{event} historical sites museums memorials travel destinations';
    const intake = {
      events: ['D-Day']
    };

    const query = interpolateResearchQuery(template, intake);

    expect(query).toContain('D-Day');
    expect(query).toContain('historical sites');
    expect(query).toContain('museums');
  });

  test('builds culinary query with cuisine and region', () => {
    const template = '{cuisine} {region} restaurants cooking classes food tours culinary experiences';
    const intake = {
      cuisines: ['Italian'],
      regions: ['Tuscany']
    };

    const query = interpolateResearchQuery(template, intake);

    expect(query).toContain('Italian');
    expect(query).toContain('Tuscany');
    expect(query).toContain('cooking classes');
  });

  test('builds adventure query with destination and activity', () => {
    const template = '{destination} {activity} adventure tours outdoor activities travel destinations';
    const intake = {
      destinations: ['Patagonia'],
      activities: ['hiking']
    };

    const query = interpolateResearchQuery(template, intake);

    expect(query).toContain('Patagonia');
    expect(query).toContain('hiking');
    expect(query).toContain('adventure tours');
  });

  test('handles missing optional region in culinary query', () => {
    const template = '{cuisine} {region} restaurants culinary experiences';
    const intake = {
      cuisines: ['French']
      // No regions provided
    };

    const query = interpolateResearchQuery(template, intake);

    expect(query).toContain('French');
    expect(query).not.toContain('{region}');
    expect(query).not.toContain('undefined');
  });

  test('query length is reasonable for API limits', () => {
    const template = '{surname} family heritage sites ancestral homes castles historical tours travel destinations';
    const intake = {
      surnames: ['VeryLongSurnameWithManyCharacters']
    };

    const query = interpolateResearchQuery(template, intake);

    // Most search APIs have ~500-1000 char limits
    expect(query.length).toBeLessThan(500);
    expect(query.length).toBeGreaterThan(20);
  });

  test('query does not contain unreplaced placeholders when data provided', () => {
    const template = '{surname} family {title} heritage';
    const intake = {
      surnames: ['Williams'],
      titles: ['Some Title']
    };

    const query = interpolateResearchQuery(template, intake);

    expect(query).toContain('Williams');
    expect(query).toContain('Some Title');
    expect(query).not.toContain('{surname}');
    expect(query).not.toContain('{title}');
  });

  test('query is properly formatted with spaces', () => {
    const template = '{surname} family heritage';
    const intake = { surnames: ['Williams'] };

    const query = interpolateResearchQuery(template, intake);

    // Should not have double spaces or leading/trailing spaces
    expect(query).not.toMatch(/\s{2,}/);
    expect(query.trim()).toBe(query);
  });

  test('builds query for multiple activities', () => {
    const template = '{destination} {activity} adventure';
    const intake = {
      destinations: ['Costa Rica'],
      activities: ['ziplining', 'surfing', 'wildlife']
    };

    // Uses first activity only
    const query = interpolateResearchQuery(template, intake);

    expect(query).toContain('Costa Rica');
    expect(query).toContain('ziplining');
  });

  test('handles case-sensitive data correctly', () => {
    const template = '{surname} Family Heritage';
    const intake = { surnames: ['o\'brien'] };

    const query = interpolateResearchQuery(template, intake);

    expect(query).toContain('o\'brien');
    expect(query).toContain('Family Heritage');
  });
});
