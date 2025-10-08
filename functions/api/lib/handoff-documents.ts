// Handoff Documents for Travel Agent Quotes
// Comprehensive trip context for B2B2C handoff to travel agents

export interface HandoffDocument {
  id: string;
  tripId: string;
  userId: string;

  // Complete trip context
  chatHistory: ChatMessage[];         // Last 100 messages
  researchSummary: string;            // Full AI research synthesis
  userPreferences: UserPreferences;   // Structured preferences

  // All travel options shown to user
  allFlightOptions: FlightOption[];   // Every flight shown
  selectedFlightId: string | null;
  allHotelOptions: HotelOption[];     // Every hotel shown
  selectedHotelIds: string[] | null;  // Array of selected hotel IDs
  allTransportOptions: TransportOption[] | null;
  selectedTransportIds: string[] | null;

  // Final itinerary
  dailyItinerary: DailyPlan[];
  totalEstimateUsd: number;
  marginPercent: number;

  // Agent interaction
  agentId: string | null;
  agentQuoteUsd: number | null;
  agentNotes: string | null;
  quoteStatus: 'pending' | 'quoted' | 'booked' | 'cancelled';

  // Export formats
  pdfUrl: string | null;              // Cloudflare R2 URL
  jsonExport: string | null;          // Complete structured data

  // Metadata
  createdAt: string;                  // ISO datetime
  quotedAt: string | null;
  expiresAt: string;                  // 30 days from creation
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface UserPreferences {
  luxuryLevel: string;
  activityLevel: string;
  transport: string;
  days: number;
  adults: number;
  children?: number;
  budgetUsd?: number;
  specialRequests?: string;
}

export interface FlightOption {
  id: string;
  category: 'cheapest' | 'shortest' | 'upgrade_comfort' | 'upgrade_business' | 'upgrade_first';
  from: {
    airportCode: string;
    city: string;
    terminal?: string;
  };
  to: {
    airportCode: string;
    city: string;
    terminal?: string;
  };
  departure: string;                  // ISO datetime
  arrival: string;                    // ISO datetime
  carrier: string;
  flightNumber: string;
  cabinClass: 'economy' | 'premium_economy' | 'business' | 'first';
  durationHours: number;
  stops: number;
  basePriceUsd: number;              // Amadeus price without margin
  estimatedPriceUsd: number;         // With margin applied
  marginAppliedUsd: number;
  baggage?: {
    carryOn: number;
    checked: number;
  };
}

export interface HotelOption {
  id: string;
  name: string;
  starRating: number;                 // 1-5
  address: string;
  distanceFromCenterKm: number;
  basePricePerNightUsd: number;
  estimatedPricePerNightUsd: number;
  estimatedTotalUsd: number;          // Per night × nights with margin
  amenities: string[];                // wifi, parking, breakfast, pool, etc.
  rating: number;                     // Guest rating (e.g., 4.5/5)
  reviewCount: number;
  images?: string[];
}

export interface TransportOption {
  id: string;
  type: 'rental_car' | 'train' | 'hired_driver' | 'bus' | 'ferry';
  provider: string;
  fromLocation: string;
  toLocation: string;
  departureTime?: string;
  arrivalTime?: string;
  durationHours?: number;
  vehicleType?: string;
  basePriceUsd: number;
  estimatedPriceUsd: number;
  marginAppliedUsd: number;
  notes?: string;
}

export interface DailyPlan {
  day: number;
  date: string;                       // YYYY-MM-DD
  location: string;
  activities: Activity[];
  whyWeSuggest: string;               // AI-generated explanation tied to trip theme
  meals: {
    breakfast?: string;
    lunch?: string;
    dinner?: string;
  };
  accommodation?: string;
  dailyTotalUsd: number;
}

export interface Activity {
  time: string;                       // HH:MM format
  activity: string;
  type: 'paid_tour' | 'free' | 'meal' | 'transport';
  costUsd: number;
}

// Database row interface
interface HandoffDocumentRow {
  id: string;
  trip_id: string;
  user_id: string;
  chat_history: string;               // JSON
  research_summary: string;
  user_preferences: string;           // JSON
  all_flight_options: string;         // JSON
  selected_flight_id: string | null;
  all_hotel_options: string;          // JSON
  selected_hotel_ids: string | null;  // JSON
  all_transport_options: string | null; // JSON
  selected_transport_ids: string | null; // JSON
  daily_itinerary: string;            // JSON
  total_estimate_usd: number;
  margin_percent: number;
  agent_id: string | null;
  agent_quote_usd: number | null;
  agent_notes: string | null;
  quote_status: string;
  pdf_url: string | null;
  json_export: string | null;
  created_at: string;
  quoted_at: string | null;
  expires_at: string;
}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function rowToHandoffDocument(row: HandoffDocumentRow): HandoffDocument {
  return {
    id: row.id,
    tripId: row.trip_id,
    userId: row.user_id,
    chatHistory: parseJson<ChatMessage[]>(row.chat_history) || [],
    researchSummary: row.research_summary,
    userPreferences: parseJson<UserPreferences>(row.user_preferences) || {} as UserPreferences,
    allFlightOptions: parseJson<FlightOption[]>(row.all_flight_options) || [],
    selectedFlightId: row.selected_flight_id,
    allHotelOptions: parseJson<HotelOption[]>(row.all_hotel_options) || [],
    selectedHotelIds: row.selected_hotel_ids ? parseJson<string[]>(row.selected_hotel_ids) : null,
    allTransportOptions: row.all_transport_options ? parseJson<TransportOption[]>(row.all_transport_options) : null,
    selectedTransportIds: row.selected_transport_ids ? parseJson<string[]>(row.selected_transport_ids) : null,
    dailyItinerary: parseJson<DailyPlan[]>(row.daily_itinerary) || [],
    totalEstimateUsd: row.total_estimate_usd,
    marginPercent: row.margin_percent,
    agentId: row.agent_id,
    agentQuoteUsd: row.agent_quote_usd,
    agentNotes: row.agent_notes,
    quoteStatus: row.quote_status as 'pending' | 'quoted' | 'booked' | 'cancelled',
    pdfUrl: row.pdf_url,
    jsonExport: row.json_export,
    createdAt: row.created_at,
    quotedAt: row.quoted_at,
    expiresAt: row.expires_at
  };
}

export async function getHandoffDocument(id: string, db: D1Database): Promise<HandoffDocument | null> {
  try {
    const row = await db.prepare(
      `SELECT * FROM handoff_documents WHERE id = ?`
    ).bind(id).first<HandoffDocumentRow>();

    if (row) {
      return rowToHandoffDocument(row);
    }
  } catch (error: any) {
    console.error(`[Handoff] Failed to load handoff document "${id}":`, error?.message || error);
  }

  return null;
}

export async function getHandoffDocumentByTripId(tripId: string, db: D1Database): Promise<HandoffDocument | null> {
  try {
    const row = await db.prepare(
      `SELECT * FROM handoff_documents WHERE trip_id = ? ORDER BY created_at DESC LIMIT 1`
    ).bind(tripId).first<HandoffDocumentRow>();

    if (row) {
      return rowToHandoffDocument(row);
    }
  } catch (error: any) {
    console.error(`[Handoff] Failed to load handoff for trip "${tripId}":`, error?.message || error);
  }

  return null;
}

export async function createHandoffDocument(
  db: D1Database,
  handoff: Omit<HandoffDocument, 'id' | 'createdAt' | 'expiresAt'>
): Promise<HandoffDocument> {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

  await db.prepare(
    `INSERT INTO handoff_documents (
      id, trip_id, user_id, chat_history, research_summary, user_preferences,
      all_flight_options, selected_flight_id, all_hotel_options, selected_hotel_ids,
      all_transport_options, selected_transport_ids, daily_itinerary,
      total_estimate_usd, margin_percent, agent_id, agent_quote_usd, agent_notes,
      quote_status, pdf_url, json_export, created_at, quoted_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    handoff.tripId,
    handoff.userId,
    JSON.stringify(handoff.chatHistory),
    handoff.researchSummary,
    JSON.stringify(handoff.userPreferences),
    JSON.stringify(handoff.allFlightOptions),
    handoff.selectedFlightId,
    JSON.stringify(handoff.allHotelOptions),
    handoff.selectedHotelIds ? JSON.stringify(handoff.selectedHotelIds) : null,
    handoff.allTransportOptions ? JSON.stringify(handoff.allTransportOptions) : null,
    handoff.selectedTransportIds ? JSON.stringify(handoff.selectedTransportIds) : null,
    JSON.stringify(handoff.dailyItinerary),
    handoff.totalEstimateUsd,
    handoff.marginPercent,
    handoff.agentId,
    handoff.agentQuoteUsd,
    handoff.agentNotes,
    handoff.quoteStatus,
    handoff.pdfUrl,
    handoff.jsonExport,
    createdAt,
    handoff.quotedAt,
    expiresAt
  ).run();

  const saved = await getHandoffDocument(id, db);
  if (!saved) {
    throw new Error('Failed to persist handoff document');
  }

  return saved;
}

export async function updateHandoffDocument(
  db: D1Database,
  id: string,
  updates: Partial<HandoffDocument>
): Promise<HandoffDocument> {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.agentId !== undefined) {
    fields.push('agent_id = ?');
    values.push(updates.agentId);
  }
  if (updates.agentQuoteUsd !== undefined) {
    fields.push('agent_quote_usd = ?');
    values.push(updates.agentQuoteUsd);
  }
  if (updates.agentNotes !== undefined) {
    fields.push('agent_notes = ?');
    values.push(updates.agentNotes);
  }
  if (updates.quoteStatus !== undefined) {
    fields.push('quote_status = ?');
    values.push(updates.quoteStatus);
  }
  if (updates.pdfUrl !== undefined) {
    fields.push('pdf_url = ?');
    values.push(updates.pdfUrl);
  }
  if (updates.jsonExport !== undefined) {
    fields.push('json_export = ?');
    values.push(updates.jsonExport);
  }
  if (updates.quotedAt !== undefined) {
    fields.push('quoted_at = ?');
    values.push(updates.quotedAt);
  }

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  values.push(id);

  await db.prepare(
    `UPDATE handoff_documents SET ${fields.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  const updated = await getHandoffDocument(id, db);
  if (!updated) {
    throw new Error('Failed to update handoff document');
  }

  return updated;
}

export async function listHandoffDocuments(
  db: D1Database,
  filters?: {
    agentId?: string;
    quoteStatus?: string;
    limit?: number;
    offset?: number;
  }
): Promise<HandoffDocument[]> {
  const conditions: string[] = [];
  const values: any[] = [];

  if (filters?.agentId) {
    conditions.push('agent_id = ?');
    values.push(filters.agentId);
  }
  if (filters?.quoteStatus) {
    conditions.push('quote_status = ?');
    values.push(filters.quoteStatus);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters?.limit || 20;
  const offset = filters?.offset || 0;

  values.push(limit, offset);

  try {
    const result = await db.prepare(
      `SELECT * FROM handoff_documents ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...values).all();

    const rows = (result.results || []) as HandoffDocumentRow[];
    return rows.map(rowToHandoffDocument);
  } catch (error: any) {
    console.error('[Handoff] Failed to list handoff documents:', error?.message || error);
    return [];
  }
}
