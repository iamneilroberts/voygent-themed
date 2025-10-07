/**
 * Custom assertion functions for test validation
 */
import { expect } from 'vitest';

/**
 * Validate trip response structure
 */
export function validateTripStructure(trip: any) {
  // Required top-level properties
  expect(trip).toHaveProperty('tripId');
  expect(trip).toHaveProperty('intake');
  expect(trip).toHaveProperty('options');
  expect(trip).toHaveProperty('diagnostics');

  // Options validation
  expect(trip.options).toBeInstanceOf(Array);
  expect(trip.options.length).toBeGreaterThanOrEqual(2);
  expect(trip.options.length).toBeLessThanOrEqual(4);

  // Each option structure
  trip.options.forEach((option: any) => {
    expect(option).toHaveProperty('title');
    expect(option).toHaveProperty('cities');
    expect(option).toHaveProperty('itinerary');
    expect(option).toHaveProperty('estimated_budget');
    expect(option).toHaveProperty('highlights');

    expect(option.cities).toBeInstanceOf(Array);
    expect(option.estimated_budget).toBeGreaterThan(0);
  });
}

/**
 * Validate research data structure
 */
export function validateResearchData(research: any[]) {
  expect(research).toBeInstanceOf(Array);

  research.forEach((step) => {
    expect(step).toMatchObject({
      step: expect.stringMatching(/research|reasoning/),
      query: expect.any(String),
    });

    // Check for either summary or analysis field
    if (step.summary) {
      expect(step.summary.length).toBeGreaterThan(0);
    }
    if (step.analysis) {
      expect(step.analysis.length).toBeGreaterThan(0);
    }
  });
}

/**
 * Validate performance thresholds
 */
export function validatePerformance(
  duration: number,
  cost: number,
  thresholds: { maxDuration: number; maxCost: number }
) {
  expect(duration).toBeLessThan(thresholds.maxDuration);
  expect(cost).toBeLessThan(thresholds.maxCost);
}
