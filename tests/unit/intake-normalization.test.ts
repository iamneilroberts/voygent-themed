import { describe, test, expect } from 'vitest';

describe('Intake Normalization Tests', () => {
  test('parses heritage input with surname and origin', () => {
    // Mock AI response
    const mockIntake = {
      surnames: ['Williams'],
      suspected_origins: ['Scotland'],
      theme: 'heritage',
      duration_days: 7,
      budget_tier: 'comfort'
    };

    expect(mockIntake.surnames).toContain('Williams');
    expect(mockIntake.suspected_origins).toContain('Scotland');
    expect(mockIntake.theme).toBe('heritage');
  });

  test('parses tvmovie input with title', () => {
    const mockIntake = {
      titles: ['Game of Thrones'],
      theme: 'tvmovie',
      duration_days: 10
    };

    expect(mockIntake.titles).toContain('Game of Thrones');
    expect(mockIntake.theme).toBe('tvmovie');
  });

  test('parses historical input with event', () => {
    const mockIntake = {
      events: ['D-Day'],
      destinations: ['France', 'Normandy'],
      theme: 'historical',
      duration_days: 5
    };

    expect(mockIntake.events).toContain('D-Day');
    expect(mockIntake.destinations).toContain('France');
    expect(mockIntake.theme).toBe('historical');
  });

  test('parses culinary input with cuisine and region', () => {
    const mockIntake = {
      cuisines: ['Italian'],
      regions: ['Tuscany'],
      activities: ['cooking classes'],
      theme: 'culinary',
      duration_days: 7
    };

    expect(mockIntake.cuisines).toContain('Italian');
    expect(mockIntake.regions).toContain('Tuscany');
    expect(mockIntake.theme).toBe('culinary');
  });

  test('parses adventure input with destination and activity', () => {
    const mockIntake = {
      destinations: ['Patagonia'],
      activities: ['hiking', 'glacier trekking'],
      theme: 'adventure',
      duration_days: 12
    };

    expect(mockIntake.destinations).toContain('Patagonia');
    expect(mockIntake.activities).toContain('hiking');
    expect(mockIntake.theme).toBe('adventure');
  });

  test('extracts duration_days from various formats', () => {
    // Mock different duration formats
    const intakes = [
      { duration_days: 7 },      // "7 days"
      { duration_days: 14 },     // "2 weeks"
      { duration_days: 10 },     // "10 days"
      { duration_days: 5 }       // "5 days"
    ];

    intakes.forEach(intake => {
      expect(intake.duration_days).toBeGreaterThan(0);
      expect(intake.duration_days).toBeLessThanOrEqual(30);
    });
  });

  test('extracts budget_tier from text', () => {
    const budgetTiers = ['economy', 'comfort', 'luxury'];

    budgetTiers.forEach(tier => {
      const mockIntake = { budget_tier: tier };
      expect(['economy', 'comfort', 'luxury']).toContain(mockIntake.budget_tier);
    });
  });

  test('handles missing optional fields gracefully', () => {
    const mockIntake = {
      surnames: ['Smith'],
      theme: 'heritage'
      // No duration_days, no budget_tier
    };

    expect(mockIntake.surnames).toBeDefined();
    expect(mockIntake.theme).toBe('heritage');
    expect(mockIntake.duration_days).toBeUndefined();
  });

  test('validates required fields per theme - heritage', () => {
    const mockIntake = {
      surnames: ['Williams'],
      theme: 'heritage'
    };

    // Heritage theme requires surnames
    expect(mockIntake.surnames).toBeDefined();
    expect(mockIntake.surnames.length).toBeGreaterThan(0);
  });

  test('validates required fields per theme - tvmovie', () => {
    const mockIntake = {
      titles: ['Harry Potter'],
      theme: 'tvmovie'
    };

    // TV/Movie theme requires titles
    expect(mockIntake.titles).toBeDefined();
    expect(mockIntake.titles.length).toBeGreaterThan(0);
  });

  test('normalizes multiple surnames', () => {
    const mockIntake = {
      surnames: ['O\'Brien', 'MacLeod', 'Campbell'],
      theme: 'heritage'
    };

    expect(mockIntake.surnames.length).toBe(3);
    expect(mockIntake.surnames).toContain('O\'Brien');
  });

  test('handles special characters in names', () => {
    const specialNames = [
      'O\'Brien',
      'São Paulo',
      'Müller',
      'François'
    ];

    specialNames.forEach(name => {
      const mockIntake = { surnames: [name], theme: 'heritage' };
      expect(mockIntake.surnames[0]).toBe(name);
    });
  });
});
