/**
 * Integration Tests: Template-Driven Workflow
 *
 * Phase 12, Tasks T068-T071
 *
 * Tests the complete end-to-end flow of the template-driven trip system:
 * - Template selection
 * - Research generation and viewing
 * - Options generation
 * - Price estimates
 * - Handoff creation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE_URL = 'http://localhost:8788';

describe('Template-Driven Workflow Integration Tests', () => {
  let testTripId: string;
  let testHandoffId: string;

  describe('T068: Culinary Heritage Scenario', () => {
    it('should create trip with culinary template', async () => {
      const formData = new FormData();
      formData.append('text', 'I want to explore Italian culinary traditions');
      formData.append('theme', 'culinary');
      formData.append('userId', 'test-user-culinary');

      const response = await fetch(`${BASE_URL}/api/trips`, {
        method: 'POST',
        body: formData
      });

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.tripId).toBeDefined();
      expect(data.status).toMatch(/research_initiated|research_ready/);

      testTripId = data.tripId;
    });

    it('should have research summary', async () => {
      // Wait a bit for research to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await fetch(`${BASE_URL}/api/trips/${testTripId}/research`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.hasResearch).toBe(true);
      expect(data.researchSummary).toBeDefined();
      expect(data.canGenerateOptions).toBe(false); // Not viewed yet
    });

    it('should enforce research-viewed gate', async () => {
      // Try to generate options without viewing research
      const response = await fetch(`${BASE_URL}/api/trips/${testTripId}/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences: {
            luxuryLevel: 'comfort',
            days: 7
          }
        })
      });

      expect(response.status).toBe(403); // Forbidden
      const data = await response.json();
      expect(data.requiresAction).toBe('view_research');
    });

    it('should mark research as viewed', async () => {
      const response = await fetch(`${BASE_URL}/api/trips/${testTripId}/research`, {
        method: 'PATCH'
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.canGenerateOptions).toBe(true);
    });

    it('should generate trip options after research viewed', async () => {
      const response = await fetch(`${BASE_URL}/api/trips/${testTripId}/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences: {
            luxuryLevel: 'comfort',
            activityLevel: 'moderate',
            days: 7
          }
        })
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.options).toBeDefined();
      expect(Array.isArray(data.options)).toBe(true);
      expect(data.options.length).toBeGreaterThan(0);
    });

    it('should get flight price estimates', async () => {
      const response = await fetch(`${BASE_URL}/api/trips/${testTripId}/estimates/flights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'JFK',
          to: 'FCO', // Rome
          departureDate: '2025-06-15',
          adults: 2
        })
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.options).toBeDefined();
      expect(Array.isArray(data.options)).toBe(true);
      expect(data.marginPercent).toBeDefined();
    });

    it('should get hotel price estimates', async () => {
      const response = await fetch(`${BASE_URL}/api/trips/${testTripId}/estimates/hotels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: 'Rome',
          checkin: '2025-06-15',
          checkout: '2025-06-22',
          adults: 2
        })
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.options).toBeDefined();
      expect(data.nights).toBe(7);
    });

    it('should track user selections', async () => {
      const response = await fetch(`${BASE_URL}/api/trips/${testTripId}/selections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selections: [
            { type: 'flight', optionId: 'flight_1', optionData: { price: 650 } },
            { type: 'hotel', optionId: 'hotel_1', optionData: { price: 180 } }
          ]
        })
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.results).toBeDefined();
      expect(data.results.length).toBe(2);
    });
  });

  describe('T069: Scottish Heritage Scenario', () => {
    let heritageTestTripId: string;

    it('should create trip with heritage template', async () => {
      const formData = new FormData();
      formData.append('text', 'McLeod family heritage, Isle of Skye');
      formData.append('theme', 'heritage');
      formData.append('userId', 'test-user-heritage');

      const response = await fetch(`${BASE_URL}/api/trips`, {
        method: 'POST',
        body: formData
      });

      expect(response.status).toBe(201);

      const data = await response.json();
      heritageTestTripId = data.tripId;
    });

    it('should generate heritage-specific research', async () => {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await fetch(`${BASE_URL}/api/trips/${heritageTestTripId}/research`);
      const data = await response.json();

      expect(data.researchSummary).toBeDefined();
      // Should contain heritage-related keywords
      expect(data.researchSummary.toLowerCase()).toMatch(/mcleod|skye|heritage|clan|scottish/);
    });

    it('should get tour estimates for heritage sites', async () => {
      // Mark research as viewed first
      await fetch(`${BASE_URL}/api/trips/${heritageTestTripId}/research`, {
        method: 'PATCH'
      });

      const response = await fetch(`${BASE_URL}/api/trips/${heritageTestTripId}/estimates/tours`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'Isle of Skye',
          category: 'historical'
        })
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.options).toBeDefined();
      expect(data.options.length).toBeGreaterThan(0);
    });
  });

  describe('T070: Agent Handoff Workflow', () => {
    beforeAll(async () => {
      // Ensure we have a completed trip
      if (!testTripId) {
        throw new Error('No test trip available for handoff test');
      }
    });

    it('should create handoff document', async () => {
      const response = await fetch(`${BASE_URL}/api/trips/${testTripId}/handoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test-user-culinary'
        })
      });

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.handoffId).toBeDefined();
      expect(data.quoteStatus).toBe('pending');
      expect(data.expiresAt).toBeDefined();

      testHandoffId = data.handoffId;
    });

    it('should retrieve handoff document', async () => {
      const response = await fetch(`${BASE_URL}/api/trips/${testTripId}/handoff`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.id).toBe(testHandoffId);
      expect(data.chatHistory).toBeDefined();
      expect(data.researchSummary).toBeDefined();
      expect(data.dailyItinerary).toBeDefined();
      expect(data.totalEstimateUsd).toBeGreaterThan(0);
    });

    it('should export handoff as JSON', async () => {
      const response = await fetch(`${BASE_URL}/api/trips/${testTripId}/handoff/export?format=json`);
      expect(response.status).toBe(200);

      const contentDisposition = response.headers.get('content-disposition');
      expect(contentDisposition).toContain('attachment');

      const data = await response.json();
      expect(data.handoffId).toBeDefined();
      expect(data.exportedAt).toBeDefined();
    });

    it('should allow agent to submit quote', async () => {
      const response = await fetch(`${BASE_URL}/api/agent/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handoffId: testHandoffId,
          agentId: 'test-agent-123',
          quoteUsd: 5000,
          notes: 'Customized Italian culinary tour with expert guides'
        })
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.quoteUsd).toBe(5000);
    });

    it('should list agent quotes', async () => {
      const response = await fetch(`${BASE_URL}/api/agent/quotes?agentId=test-agent-123`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.quotes).toBeDefined();
      expect(Array.isArray(data.quotes)).toBe(true);
      expect(data.quotes.length).toBeGreaterThan(0);
    });
  });

  describe('T071: Diagnostics Integration', () => {
    it('should get trip diagnostics', async () => {
      const response = await fetch(`${BASE_URL}/api/trips/${testTripId}/diagnostics`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.tripId).toBe(testTripId);
      expect(data.template).toBeDefined();
      expect(data.providers).toBeDefined();
    });

    it('should stream logs', async () => {
      const response = await fetch(`${BASE_URL}/api/trips/${testTripId}/logs`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.logs).toBeDefined();
      expect(Array.isArray(data.logs)).toBe(true);
    });

    it('should filter logs by level', async () => {
      const response = await fetch(`${BASE_URL}/api/trips/${testTripId}/logs?level=error`);
      expect(response.status).toBe(200);

      const data = await response.json();
      if (data.logs.length > 0) {
        data.logs.forEach((log: any) => {
          expect(log.level).toBe('error');
        });
      }
    });

    it('should get system health status', async () => {
      const response = await fetch(`${BASE_URL}/api/admin/diagnostics/health`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toMatch(/healthy|degraded/);
      expect(data.database).toBeDefined();
      expect(data.database.connected).toBe(true);
    });

    it('should get provider statistics', async () => {
      const response = await fetch(`${BASE_URL}/api/admin/diagnostics/provider-stats`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.stats).toBeDefined();
      expect(data.totals).toBeDefined();
    });
  });

  describe('Admin Template Management', () => {
    let testTemplateId: string;

    it('should list templates', async () => {
      const response = await fetch(`${BASE_URL}/api/admin/templates?is_active=true`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.templates).toBeDefined();
      expect(Array.isArray(data.templates)).toBe(true);
    });

    it('should create new template', async () => {
      const response = await fetch(`${BASE_URL}/api/admin/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Adventure Template',
          description: 'For testing purposes',
          intakePrompt: 'Extract adventure preferences from user input',
          optionsPrompt: 'Generate adventure trip options',
          requiredFields: ['destination', 'activity_type'],
          numberOfOptions: 3
        })
      });

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.name).toBe('Test Adventure Template');

      testTemplateId = data.id;
    });

    it('should validate template', async () => {
      const response = await fetch(`${BASE_URL}/api/admin/templates/${testTemplateId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowPrompt: 'Test workflow prompt for validation'
        })
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.valid).toBeDefined();
    });

    it('should duplicate template', async () => {
      const response = await fetch(`${BASE_URL}/api/admin/templates/${testTemplateId}/duplicate`, {
        method: 'POST'
      });

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.name).toContain('(Copy)');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent trip', async () => {
      const response = await fetch(`${BASE_URL}/api/trips/non-existent-id/research`);
      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid estimate request', async () => {
      const response = await fetch(`${BASE_URL}/api/trips/${testTripId}/estimates/flights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Missing required fields
          from: 'JFK'
        })
      });

      expect(response.status).toBe(400);
    });

    it('should return 410 for deprecated A/B endpoint', async () => {
      const response = await fetch(`${BASE_URL}/api/trips/${testTripId}/ab`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(410); // Gone
    });
  });

  afterAll(async () => {
    // Cleanup test data if needed
    console.log('Test trip ID:', testTripId);
    console.log('Test handoff ID:', testHandoffId);
  });
});
