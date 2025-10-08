// Research Workflow Service
// Manages research-first workflow with gating logic

import { TripTemplate } from '../trip-templates';
import { TemplateEngine } from './template-engine';

export interface ResearchStatus {
  status: 'pending' | 'in_progress' | 'complete' | 'failed';
  researchSummary?: string;
  researchViewed: boolean;
  providerUsed?: string;
  tokensUsed?: number;
  costUsd?: number;
  error?: string;
}

export class ResearchService {
  /**
   * Initiate research for a trip
   */
  static async initiateResearch(
    db: D1Database,
    tripId: string,
    template: TripTemplate,
    intake: any
  ): Promise<void> {
    // Build context for template variables
    const context = TemplateEngine.buildContext(intake);

    // Replace variables in research prompts
    const researchPrompt = template.researchSynthesisPrompt
      ? TemplateEngine.replaceVariables(template.researchSynthesisPrompt, context)
      : null;

    // Update trip status to researching
    await db.prepare(`
      UPDATE themed_trips
      SET status = 'researching', research_viewed = 0
      WHERE id = ?
    `).bind(tripId).run();

    // Research will be performed by the AI provider
    // This is a placeholder - actual research would call provider
  }

  /**
   * Get research status for a trip
   */
  static async getResearchStatus(db: D1Database, tripId: string): Promise<ResearchStatus | null> {
    const trip = await db.prepare(`
      SELECT status, research_summary, research_viewed FROM themed_trips WHERE id = ?
    `).bind(tripId).first<{
      status: string;
      research_summary: string | null;
      research_viewed: number;
    }>();

    if (!trip) {
      return null;
    }

    let status: ResearchStatus['status'] = 'pending';
    if (trip.status === 'researching') {
      status = 'in_progress';
    } else if (trip.research_summary) {
      status = 'complete';
    }

    return {
      status,
      researchSummary: trip.research_summary || undefined,
      researchViewed: trip.research_viewed === 1,
      providerUsed: undefined, // Would come from logs
      tokensUsed: undefined,
      costUsd: undefined
    };
  }

  /**
   * Mark research as viewed
   */
  static async markResearchViewed(db: D1Database, tripId: string): Promise<boolean> {
    const result = await db.prepare(`
      UPDATE themed_trips SET research_viewed = 1 WHERE id = ? AND research_summary IS NOT NULL
    `).bind(tripId).run();

    return result.success;
  }

  /**
   * Check if trip can generate options (research viewed gate)
   */
  static async canGenerateOptions(db: D1Database, tripId: string): Promise<boolean> {
    const trip = await db.prepare(`
      SELECT research_viewed FROM themed_trips WHERE id = ?
    `).bind(tripId).first<{ research_viewed: number }>();

    return trip?.research_viewed === 1;
  }

  /**
   * Save research summary
   */
  static async saveResearchSummary(
    db: D1Database,
    tripId: string,
    summary: string,
    metadata?: {
      providerUsed?: string;
      tokensUsed?: number;
      costUsd?: number;
    }
  ): Promise<void> {
    await db.prepare(`
      UPDATE themed_trips
      SET research_summary = ?, status = 'research_complete'
      WHERE id = ?
    `).bind(summary, tripId).run();

    // Metadata would be logged separately via Logger
  }
}
