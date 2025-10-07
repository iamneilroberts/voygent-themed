import { describe, test, expect } from 'vitest';
import { interpolateResearchQuery } from '../../functions/api/lib/research-utils';

describe('Template Query Interpolation', () => {
  test('replaces {surname} placeholder with single surname', () => {
    const template = '{surname} family heritage sites';
    const intake = { surnames: ['Williams'] };
    const result = interpolateResearchQuery(template, intake);
    expect(result).toBe('Williams family heritage sites');
  });

  test('uses first surname when multiple provided', () => {
    const template = '{surname} ancestry history';
    const intake = { surnames: ['Smith', 'Jones'] };
    const result = interpolateResearchQuery(template, intake);
    expect(result).toBe('Smith ancestry history');
  });

  test('replaces {title} placeholder for TV/movie theme', () => {
    const template = '{title} filming locations travel guide';
    const intake = { titles: ['Game of Thrones'] };
    const result = interpolateResearchQuery(template, intake);
    expect(result).toBe('Game of Thrones filming locations travel guide');
  });

  test('replaces {event} placeholder for historical theme', () => {
    const template = '{event} historical sites museums';
    const intake = { events: ['D-Day'] };
    const result = interpolateResearchQuery(template, intake);
    expect(result).toBe('D-Day historical sites museums');
  });

  test('replaces {cuisine} and {region} placeholders together', () => {
    const template = '{cuisine} {region} restaurants cooking classes';
    const intake = { cuisines: ['Italian'], regions: ['Tuscany'] };
    const result = interpolateResearchQuery(template, intake);
    expect(result).toBe('Italian Tuscany restaurants cooking classes');
  });

  test('removes {region} placeholder when no region provided', () => {
    const template = '{cuisine} {region} restaurants';
    const intake = { cuisines: ['French'], regions: [] };
    const result = interpolateResearchQuery(template, intake);
    // Should remove {region} and clean up extra spaces
    expect(result).toBe('French  restaurants');
  });

  test('replaces {destination} and {activity} for adventure theme', () => {
    const template = '{destination} {activity} adventure tours';
    const intake = { destinations: ['Patagonia'], activities: ['hiking'] };
    const result = interpolateResearchQuery(template, intake);
    expect(result).toBe('Patagonia hiking adventure tours');
  });

  test('handles missing data gracefully - leaves placeholders', () => {
    const template = '{surname} family heritage';
    const intake = { surnames: [] };
    const result = interpolateResearchQuery(template, intake);
    // No replacement if data missing
    expect(result).toBe('{surname} family heritage');
  });

  test('handles null or undefined intake', () => {
    const template = '{surname} heritage sites';
    const result = interpolateResearchQuery(template, null);
    expect(result).toBe('{surname} heritage sites');
  });

  test('handles empty template', () => {
    const template = '';
    const intake = { surnames: ['Williams'] };
    const result = interpolateResearchQuery(template, intake);
    expect(result).toBe('');
  });

  test('handles template with no placeholders', () => {
    const template = 'general heritage travel sites';
    const intake = { surnames: ['Williams'] };
    const result = interpolateResearchQuery(template, intake);
    expect(result).toBe('general heritage travel sites');
  });

  test('replaces all occurrences of same placeholder', () => {
    const template = '{surname} family {surname} ancestry';
    const intake = { surnames: ['O\'Brien'] };
    const result = interpolateResearchQuery(template, intake);
    expect(result).toBe('O\'Brien family O\'Brien ancestry');
  });
});
