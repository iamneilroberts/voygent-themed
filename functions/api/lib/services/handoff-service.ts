// Handoff Assembly Service
// Assembles comprehensive handoff documents

import { HandoffDocument, createHandoffDocument } from '../handoff-documents';

export class HandoffService {
  /**
   * Create handoff document with complete context
   */
  static async createHandoff(
    db: D1Database,
    tripId: string,
    selections: {
      selectedFlightId: string;
      selectedHotelIds: string[];
      selectedTransportIds?: string[];
      dailyItinerary: any[];
    }
  ): Promise<HandoffDocument> {
    // Get trip data
    const trip = await db.prepare(`
      SELECT * FROM themed_trips WHERE id = ?
    `).bind(tripId).first<any>();

    if (!trip) {
      throw new Error('Trip not found');
    }

    // Get chat history (last 100 messages)
    const chatHistory = await this.getChatHistory(db, tripId, 100);

    // Get all options shown
    const allFlightOptions = await this.getAllFlightsShown(db, tripId);
    const allHotelOptions = await this.getAllHotelsShown(db, tripId);

    // Calculate total
    const totalEstimate = selections.dailyItinerary.reduce(
      (sum, day) => sum + (day.dailyTotalUsd || 0),
      0
    );

    // Create handoff
    return await createHandoffDocument(db, {
      tripId,
      userId: trip.user_id,
      chatHistory,
      researchSummary: trip.research_summary || '',
      userPreferences: JSON.parse(trip.preferences || '{}'),
      allFlightOptions,
      selectedFlightId: selections.selectedFlightId,
      allHotelOptions,
      selectedHotelIds: selections.selectedHotelIds,
      allTransportOptions: [],
      selectedTransportIds: selections.selectedTransportIds || null,
      dailyItinerary: selections.dailyItinerary,
      totalEstimateUsd: totalEstimate,
      marginPercent: 17, // From template
      agentId: null,
      agentQuoteUsd: null,
      agentNotes: null,
      quoteStatus: 'pending',
      pdfUrl: null,
      jsonExport: null,
      quotedAt: null
    });
  }

  /**
   * Get chat history for trip
   */
  static async getChatHistory(db: D1Database, tripId: string, limit: number = 100): Promise<any[]> {
    const result = await db.prepare(`
      SELECT role, content, timestamp FROM messages
      WHERE trip_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).bind(tripId, limit).all();

    return (result.results || []).reverse();
  }

  /**
   * Get all flights shown to user
   */
  static async getAllFlightsShown(db: D1Database, tripId: string): Promise<any[]> {
    // Would query from options tracking table
    return [];
  }

  /**
   * Get all hotels shown to user
   */
  static async getAllHotelsShown(db: D1Database, tripId: string): Promise<any[]> {
    // Would query from options tracking table
    return [];
  }

  /**
   * Generate PDF for handoff
   */
  static async generatePDF(handoffId: string): Promise<string> {
    // Would generate PDF and upload to R2
    return `https://r2.voygent.app/handoffs/${handoffId}.pdf`;
  }

  /**
   * Export as JSON
   */
  static async exportJSON(handoff: HandoffDocument): Promise<string> {
    return JSON.stringify({
      handoff,
      exportTimestamp: new Date().toISOString(),
      apiVersion: '1.0'
    }, null, 2);
  }
}
